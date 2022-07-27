package commands

import (
	"context"
	"errors"
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
		conflicts, err := GetUsersWithConflictingEmailsOrLogins(context)
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
		conflicts, err := GetUsersWithConflictingEmailsOrLogins(context)
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
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		arg := cmd.Args().First()
		if arg == "" {
			return errors.New("please specify a absolute path to file to read from")
		}
		b, err := ioutil.ReadFile(arg)
		if err != nil {
			return fmt.Errorf("could not read file with error %e", err)
		}

		// validation
		return validate(context, b)
	}
}

func runIngestConflictUsersFile() func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		arg := cmd.Args().First()
		if arg == "" {
			return errors.New("please specify a absolute path to file to read from")
		}
		b, err := ioutil.ReadFile(arg)
		if err != nil {
			return fmt.Errorf("could not read file with error %e", err)
		}
		validErr := validate(context, b)
		if validErr != nil {
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

func validate(context *cli.Context, b []byte) error {
	// hej+hej
	// + id: 1, email: hej, login: hej, last_seen_at: 2012
	conflicts, err := GetUsersWithConflictingEmailsOrLogins(context)
	if err != nil {
		return fmt.Errorf("%v: %w", "grafana error: sql error to get users with conflicts, abandoning validation", err)
	}
	conflictIDsInDB := map[string]bool{}
	conflictEmailsInDB := map[string]bool{}
	conflictIDToEmail := map[string]string{}
	for _, uconflict := range conflicts {
		conflictIDsInDB[uconflict.UserIdentifier] = true
		conflictEmailsInDB[uconflict.Email] = true
		// id -> lower(email) for verifying we have same id to email as previously
		conflictIDToEmail[uconflict.Id] = strings.ToLower(uconflict.Email)
	}
	for _, row := range strings.Split(string(b), "\n") {
		switch {
		case strings.HasPrefix(row, "+"):
			cuser := &ConflictingUser{}
			cuser.Marshal(row)
			fmt.Printf("cuser.Email %s\n", cuser.Email)
			fmt.Printf("conflictEmailsInDB %v+\n", conflictEmailsInDB)
			if !conflictEmailsInDB[cuser.Email] {
				return fmt.Errorf("not valid email, email not in previous list")
			}
			if strings.ToLower(cuser.Email) != cuser.Email {
				return fmt.Errorf("not valid email for user: %s, email needs to be lowercased", cuser.UserIdentifier)
			}
			if strings.ToLower(cuser.Login) != cuser.Login {
				return fmt.Errorf("not valid login for user: %s, login needs to be lowercased", cuser.UserIdentifier)
			}
			// id -> lower(email) for verifying we have same id to email as previously
			if conflictIDToEmail[cuser.Id] != cuser.Email {
				return fmt.Errorf("not valid for user: %s, Id to email is not the same as previously", cuser.UserIdentifier)
			}
			// TODO:
			// validateEmail()
		case strings.HasPrefix(row, "-"):
			// non-identifier row
			// user
			// TODO: validation here
			// - should there be at least one positive and one negative?
			// - should we validate the email?
			// - should we validate the ability to merge for this specific entry?AA
			continue
		case row != "":
			// identifier row
			// found identifier row
			fmt.Printf("row: \n%s\n\n", row)
			// evaluate that the ids, actually exists since last time
			// do they need to be the same here?
			// * what if the user has changed the email and the identifer to match the new email?

			// example
			// HEJ+hej
			// + id: 1, email: HEJ, login: hej, last_seen_at: 2012
			// new
			// hej+hej
			// + id: 1, email: hej, login: hej, last_seen_at: 2012
			if !conflictIDsInDB[row] {
				return fmt.Errorf("did not recognize id \n%s\n\n terminated validation", row)
			}
		default:
			return fmt.Errorf("filerow not identified, not valid file")
		}
		if row == "" {
			// end of file
			break
		}
	}
	logger.Info("file valid for ingestion")
	return nil
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
	userIdentifiersSeen := make(map[string]bool, 0)
	str := ""
	for _, user := range *c {
		// print
		if !userIdentifiersSeen[user.UserIdentifier] {
			str += fmt.Sprintf("%s\n", user.UserIdentifier)
			userIdentifiersSeen[user.UserIdentifier] = true
		}
		str += fmt.Sprintf("id: %s, email: %s, login: %s, last_seen_at: %s, auth_module: %s\n", user.Id, user.Email, user.Login, user.LastSeenAt, user.AuthModule)
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
	userIdentifiersSeen := make(map[string]bool, 0)
	str := ""
	for _, user := range *c {
		// print
		if !userIdentifiersSeen[user.UserIdentifier] {
			str += fmt.Sprintf("%s\n", user.UserIdentifier)
			userIdentifiersSeen[user.UserIdentifier] = true
			str += fmt.Sprintf("+ id: %s, email: %s, login: %s, last_seen_at: %s, auth_module: %s\n", user.Id, user.Email, user.Login, user.LastSeenAt, user.AuthModule)
			continue
		}
		// mergable users
		str += fmt.Sprintf("- id: %s, email: %s, login: %s, last_seen_at: %s, auth_module: %s\n", user.Id, user.Email, user.Login, user.LastSeenAt, user.AuthModule)
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
	UserIdentifier string `xorm:"user_identification"`
	Id             string `xorm:"id"`
	Email          string `xorm:"email"`
	Login          string `xorm:"login"`
	LastSeenAt     string `xorm:"last_seen_at"`
	AuthModule     string `xorm:"auth_module"`
	// currently not really used for anything
	ConflictLoginEmail string `xorm:"conflict_login_email"`
	ConflictId         bool   `xorm:"conflict_id"`
}

type ConflictingUsers []*ConflictingUser

func (c *ConflictingUser) Marshal(filerow string) {
	// +/- id: 1, email: hej,
	trimmed := strings.TrimLeft(filerow, "+- ")
	values := strings.Split(trimmed, ",")
	fmt.Printf("raw %s\n", filerow)
	fmt.Printf("trimmed %s\n", trimmed)
	fmt.Printf("%v+\n\n", values)
	c.Id = values[0]
	c.Email = values[1]
	c.Login = values[2]
	c.LastSeenAt = values[3]
	c.AuthModule = values[4]
}

func GetUsersWithConflictingEmailsOrLogins(ctx *cli.Context) (ConflictingUsers, error) {
	users := make([]*ConflictingUser, 0)
	s, err := getSqlStore(ctx)
	if err != nil {
		return users, fmt.Errorf("%v: %w", "failed to get to sql", err)
	}
	outerErr := s.WithDbSession(ctx.Context, func(dbSession *sqlstore.DBSession) error {
		rawSQL := conflictingUserEntriesSQL(s)
		err := dbSession.SQL(rawSQL).Find(&users)
		return err
	})
	if outerErr != nil {
		return users, outerErr
	}
	return users, nil
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
