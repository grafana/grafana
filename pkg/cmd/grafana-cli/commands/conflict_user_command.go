package commands

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"strconv"
	"strings"

	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/urfave/cli/v2"
)

/*
	user-manager command merge-Conflicting-users
	input -> users
	output -> ids, foundConflictingEmails, foundConflictingLogins, lastActive (maybe)


	// IDENTIFIER
	login = username + email

	TODO:
*/

func getSqlStore(context *cli.Context) (*sqlstore.SQLStore, error) {
	cmd := &utils.ContextCommandLine{Context: context}
	cfg, err := initCfg(cmd)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to load configuration", err)
	}
	tracer, err := tracing.ProvideService(cfg)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to initialize tracer service", err)
	}
	bus := bus.ProvideBus(tracer)
	return sqlstore.ProvideService(cfg, nil, &migrations.OSSMigrations{}, bus, tracer)
}

func runListConflictUsers() func(context *cli.Context) error {
	return func(context *cli.Context) error {
		sqlStore, err := getSqlStore(context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get to sql", err)
		}
		conflicts, err := GetUsersWithConflictingEmailsOrLogins(context.Context, sqlStore)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get users with conflicting logins", err)
		}
		if len(conflicts) < 1 {
			logger.Info(color.GreenString("No Conflicting users found.\n\n"))
			return nil
		}
		logger.Infof("---------- Conflicts --------\n")
		logger.Infof(conflicts.String())
		logger.Infof("---------------------------\n")
		return nil
	}
}

func runGenerateConflictUsersFile() func(context *cli.Context) error {
	return func(context *cli.Context) error {
		sqlStore, err := getSqlStore(context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get to sql", err)
		}
		conflicts, err := GetUsersWithConflictingEmailsOrLogins(context.Context, sqlStore)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get users with conflicting logins", err)
		}
		if len(conflicts) < 1 {
			logger.Info(color.GreenString("No Conflicting users found.\n\n"))
			return nil
		}
		tmpFile, err := ioutil.TempFile(os.TempDir(), "conflicting_user_*.diff")
		if err != nil {
			return err
		}
		if _, err := tmpFile.Write([]byte(conflicts.ToStringFileRepresentation())); err != nil {
			return err
		}
		logger.Infof("edit the file \nvim %s\n\n", tmpFile.Name())
		logger.Infof("once edited the file, you can either validate or ingest the file\n\n")
		return nil
	}
}

func runValidateConflictUsersFile() func(context *cli.Context) error {
	return func(context *cli.Context) error { return fmt.Errorf("not implemented") }
}

func runIngestConflictUsersFile() func(context *cli.Context) error {
	return func(context *cli.Context) error {
		_, err := readFile()
		if err != nil {
			return fmt.Errorf("could not read file with error %s", err)
		}
		valid, err := validate()
		if !valid {
			return fmt.Errorf("could not validate file with error %s", err)
		}
		showChanges()
		if !confirm() {
			return fmt.Errorf("user cancelled")
		}
		err = mergeUsers()
		if err != nil {
			return fmt.Errorf("not able to merge")
		}
		return fmt.Errorf("not implemented")
	}
}

func mergeUsers() error {
	return fmt.Errorf("not implemented")
}

func validate() (bool, error) {
	// TODO:
	logger.Info("validating file")
	return false, nil
}

func readFile() (string, error) {
	// TODO:
	users := "users"
	logger.Info("read file")
	return users, nil
}

func showChanges() {
	// TODO:
	// use something like
	// diff --git a/pkg/cmd/grafana-cli/commands/commands.go b/pkg/cmd/grafana-cli/commands/commands.go
	logger.Info("show changes should be implemented\n")
}

// confirm function asks for user input
// returns bool
func confirm() bool {
	var input string
	fmt.Printf("Do you want to continue with this operation? [y|n]: ")
	_, err := fmt.Scanln(&input)
	if err != nil {
		panic(err)
	}
	input = strings.ToLower(input)
	if input == "y" || input == "yes" {
		return true
	}
	return false
}

func (c *ConflictingUsers) String() string {
	/*
		hej@test.com+hej@test.com
		id: 1, email: hej@test.com, login: hej@test.com
		id: 2, email: HEJ@TEST.COM, login: HEJ@TEST.COM
		id: 3, email: hej@TEST.com, login: hej@TEST.com
	*/
	userIdentifiersSeen := make(map[string]bool)
	str := ""
	for _, user := range *c {
		// print
		if !userIdentifiersSeen[user.UserIdentifier] {
			str += fmt.Sprintf("%s\n", user.UserIdentifier)
			userIdentifiersSeen[user.UserIdentifier] = true
		}
		str += fmt.Sprintf("id: %s, email: %s, login: %s\n", user.Id, user.Email, user.Login)
	}
	return str
}

func (c *ConflictingUsers) ToStringFileRepresentation() string {
	/*
		hej@test.com+hej@test.com
		+ id: 1, email: hej@test.com, login: hej@test.com
		- id: 2, email: HEJ@TEST.COM, login: HEJ@TEST.COM
		- id: 3, email: hej@TEST.com, login: hej@TEST.com
	*/
	userIdentifiersSeen := make(map[string]bool)
	str := ""
	for _, user := range *c {
		// print
		if !userIdentifiersSeen[user.UserIdentifier] {
			str += fmt.Sprintf("%s\n", user.UserIdentifier)
			userIdentifiersSeen[user.UserIdentifier] = true
			str += fmt.Sprintf("+ id: %s, email: %s, login: %s\n", user.Id, user.Email, user.Login)
			continue
		}
		// mergable users
		str += fmt.Sprintf("- id: %s, email: %s, login: %s\n", user.Id, user.Email, user.Login)
	}
	return str
}

type conflictType string

const (
	Merge              conflictType = "merge"
	SameIdentification conflictType = "same_identification"
)

func mergeUser(ctx context.Context, mergeIntoUser int64, cUser ConflictingUsers, sqlStore *sqlstore.SQLStore) error {
	stringIds := []string{""}
	fromUserIds := make([]int64, 0, len(stringIds))
	for _, raw := range stringIds {
		v, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return fmt.Errorf("could not parse id from string")
		}
		fromUserIds = append(fromUserIds, v)
	}
	return sqlStore.MergeUser(ctx, mergeIntoUser, fromUserIds)
}

type ConflictingUser struct {
	// IDENTIFIER
	// userIdentifier = login+email
	UserIdentifier     string `xorm:"user_identification"`
	Id                 string `xorm:"id"`
	Email              string `xorm:"email"`
	Login              string `xorm:"login"`
	LastSeenAt         string `xorm:"last_seen_at"`
	ConflictLoginEmail string `xorm:"conflict_login_email"`
	ConflictId         bool   `xorm:"conflict_id"`
}

type ConflictingUsers []*ConflictingUser

func GetUsersWithConflictingEmailsOrLogins(ctx context.Context, s *sqlstore.SQLStore) (ConflictingUsers, error) {
	stats := make([]*ConflictingUser, 0)
	outerErr := s.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		rawSQL := conflictingUserEntriesSQL(s)
		err := dbSession.SQL(rawSQL).Find(&stats)
		return err
	})
	if outerErr != nil {
		return stats, outerErr
	}
	return stats, nil
}

// conflictingUserEntriesSQL orders conflicting users by their user_identification
// sorts the users by their useridentification and ids
func conflictingUserEntriesSQL(s *sqlstore.SQLStore) string {
	userDialect := db.DB.GetDialect(s).Quote("user")
	sqlQuery := `
	SELECT
	LOWER(u1.login || '+' ||  u1.email) AS user_identification,
	u1.id,
	u1.email,
	u1.login,
	u1.last_seen_at,
	user_auth.auth_module,
		( SELECT
			u1.email
		FROM
			` + userDialect + `
		WHERE (LOWER(u1.email) = LOWER(u2.email)) AND(u1.email != u2.email)) AS conflict_email,
		( SELECT
			u1.login
		FROM
			` + userDialect + `
		WHERE (LOWER(u1.login) = LOWER(u2.login) AND(u1.login != u2.login))) AS conflict_login,
		( SELECT u1.id
			FROM ` + userDialect + `
		WHERE ((u1.login = u2.login) AND(u1.email = u2.email) AND(u1.id != u2.id))) AS conflict_id
	FROM
		 ` + userDialect + ` AS u1, ` + userDialect + ` AS u2
	LEFT JOIN user_auth on user_auth.user_id = u1.id
	WHERE (conflict_email IS NOT NULL
		OR conflict_login IS NOT NULL OR conflict_id IS NOT NULL)
	ORDER BY user_identification, u1.id`
	return sqlQuery
}
