package commands

import (
	"fmt"
	"io/ioutil"
	"os"
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
		s, err := getSqlStore(context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get to sql", err)
		}
		conflicts, err := GetUsersWithConflictingEmailsOrLogins(context, s)
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
		s, err := getSqlStore(context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get to sql", err)
		}
		conflicts, err := GetUsersWithConflictingEmailsOrLogins(context, s)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get users with conflicting logins", err)
		}
		if len(conflicts) < 1 {
			logger.Info(color.GreenString("No Conflicting users found.\n\n"))
			return nil
		}
		tmpFile, err := generateConflictUsersFile(&conflicts)
		if err != nil {
			return fmt.Errorf("generating file return error: %w", err)
		}
		logger.Infof("edit the file \nvim %s\n\n", tmpFile.Name())
		logger.Infof("once edited the file, you can either validate or ingest the file\n\n")
		return nil
	}
}

func generateConflictUsersFile(conflicts *ConflictingUsers) (*os.File, error) {
	tmpFile, err := ioutil.TempFile(os.TempDir(), "conflicting_user_*.diff")
	if err != nil {
		return nil, err
	}
	if _, err := tmpFile.Write([]byte(conflicts.ToStringFileRepresentation())); err != nil {
		return nil, err
	}
	fmt.Printf("%s", conflicts.ToStringFileRepresentation())
	return tmpFile, nil
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

type ConflictingUser struct {
	// IDENTIFIER
	// userIdentifier = login+email
	Direction      string `xorm:"direction"`
	UserIdentifier string `xorm:"user_identification"`
	// FIXME: refactor change to correct type int64
	Id    string `xorm:"id"`
	Email string `xorm:"email"`
	Login string `xorm:"login"`
	// FIXME: refactor change to correct type <>
	LastSeenAt string `xorm:"last_seen_at"`
	AuthModule string `xorm:"auth_module"`
	// currently not really used for anything
	ConflictLoginEmail string `xorm:"conflict_login_email"`
	ConflictId         bool   `xorm:"conflict_id"`
}

// always better to have a slice of the object
// not a pointer for slice type ConflictingUsers []*ConflictingUser
type ConflictingUsers []ConflictingUser

func (c *ConflictingUser) Marshal(filerow string) error {
	// +/- id: 1, email: hej,
	trimmedSpaces := strings.ReplaceAll(filerow, " ", "")
	if trimmedSpaces[0] == '+' {
		c.Direction = "+"
	} else if trimmedSpaces[0] == '-' {
		c.Direction = "-"
	} else {
		return fmt.Errorf("unable to get which operation the user would receive")
	}
	trimmed := strings.TrimLeft(trimmedSpaces, "+-")
	values := strings.Split(trimmed, ",")
	if len(values) != 5 {
		// fmt errror
		return fmt.Errorf("expected 5 values in entryrow")
	}
	id := strings.Split(values[0], ":")
	email := strings.Split(values[1], ":")
	login := strings.Split(values[2], ":")
	lastSeenAt := strings.TrimLeft(values[3], "last_seen_at:")
	authModule := strings.Split(values[4], ":")
	// optional field
	if len(authModule) < 2 {
		c.AuthModule = ""
	} else {
		c.AuthModule = authModule[1]
	}
	// expected fields
	c.Id = id[1]
	c.Email = email[1]
	c.Login = login[1]
	c.LastSeenAt = lastSeenAt
	return nil
}

func GetUsersWithConflictingEmailsOrLogins(ctx *cli.Context, s *sqlstore.SQLStore) (ConflictingUsers, error) {
	users := make([]ConflictingUser, 0)
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
