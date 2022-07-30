package commands

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/user"
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

func runValidateConflictUsersFile() func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		arg := cmd.Args().First()
		if arg == "" {
			return errors.New("please specify a absolute path to file to read from")
		}
		b, err := ioutil.ReadFile(arg)
		if err != nil {
			return fmt.Errorf("could not read file with error %s", err)
		}
		// validation
		s, err := getSqlStore(context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get to sql", err)
		}
		_, validErr := getValidConflictUsers(context, s, b)
		if validErr != nil {
			return fmt.Errorf("could not validate file with error %s", validErr)
		}
		logger.Info("file valid for ingestion")
		return nil
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
		s, err := getSqlStore(context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get to sql", err)
		}
		newConflictUsers, validErr := getValidConflictUsers(context, s, b)
		if validErr != nil {
			return fmt.Errorf("could not validate file with error %s", err)
		}
		err = mergeUsers(context, &newConflictUsers)
		if err != nil {
			return fmt.Errorf("not able to merge")
		}
		return fmt.Errorf("not implemented")
	}
}

func mergeUsers(context *cli.Context, conflicts *ConflictingUsers) error {
	// need to validate input again, just because
	sqlStore, err := getSqlStore(context)
	if err != nil {
		return fmt.Errorf("not able to get sqlstore for merging users with: %w", err)
	}
	conflicts.showChanges()
	if !confirm() {
		return fmt.Errorf("user cancelled")
	}
	return conflicts.MergeConflictingUsers(context.Context, sqlStore)
}

func getValidConflictUsers(context *cli.Context, s *sqlstore.SQLStore, b []byte) (ConflictingUsers, error) {
	conflicts, err := GetUsersWithConflictingEmailsOrLogins(context, s)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "grafana error: sql error to get users with conflicts, abandoning validation", err)
	}
	conflictIDsInDB := map[string]bool{}
	conflictEmailsInDB := map[string]bool{}
	for _, uconflict := range conflicts {
		conflictIDsInDB[uconflict.UserIdentifier] = true
		conflictEmailsInDB[uconflict.Email] = true
	}

	newConflicts := make(ConflictingUsers, 0)
	regexPattern := `^\+|\-`
	matchingExpression, err := regexp.Compile(regexPattern)
	if err != nil {
		return nil, fmt.Errorf("unable to complie regex %s: %w", regexPattern, err)
	}
	for _, row := range strings.Split(string(b), "\n") {
		if row == "" {
			// end of file
			break
		}
		// tested in https://regex101.com/r/Vgoe3r/1
		entryRow := matchingExpression.Match([]byte(row))
		if err != nil {
			return nil, fmt.Errorf("could not identify the row")
		}
		if !entryRow {
			// identifier row

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
				return nil, fmt.Errorf("did not recognize id \n%s\n\n terminated validation", row)
			}
			continue
		}

		switch {
		case strings.HasPrefix(row, "+"):
			newUser := &ConflictingUser{}
			newUser.Marshal(row)
			if _, ok := conflictEmailsInDB[newUser.Email]; !ok {
				return nil, fmt.Errorf("not valid email, email not in previous list")
			}
			if !conflictEmailsInDB[newUser.Email] {
				return nil, fmt.Errorf("not valid email, email not in previous list")
			}
			if strings.ToLower(newUser.Email) != newUser.Email {
				return nil, fmt.Errorf("not valid email for user: %s, email needs to be lowercased", newUser.UserIdentifier)
			}
			if strings.ToLower(newUser.Login) != newUser.Login {
				return nil, fmt.Errorf("not valid login for user: %s, login needs to be lowercased", newUser.UserIdentifier)
			}
			// valid entry
			newConflicts = append(newConflicts, *newUser)
		case strings.HasPrefix(row, "-"):
			newUser := &ConflictingUser{}
			err := newUser.Marshal(row)
			if err != nil {
				return nil, fmt.Errorf("unable to know which operation should be performed on the user")
			}
			if !conflictEmailsInDB[newUser.Email] {
				return nil, fmt.Errorf("not valid email, email not in previous list")
			}
			// valid entry
			newConflicts = append(newConflicts, *newUser)
		case row != "":

		default:
			return nil, fmt.Errorf("filerow not identified, not valid file")
		}
	}
	// TODO:
	// make a human readable form for how we interpret the newConflicts
	// meaning how do we show have we will perform this operation
	// and the final output of the ingest operation
	return newConflicts, nil
}

func (c *ConflictingUsers) showChanges() {
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
	userIdentifiersSeen := make(map[string]bool)
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

// MergeUser sets the user Server Admin flag
func (c *ConflictingUsers) MergeConflictingUsers(ctx context.Context, ss *sqlstore.SQLStore) error {
	grouped := map[string]ConflictingUsers{}
	for _, user := range *c {
		grouped[user.UserIdentifier] = append(grouped[user.UserIdentifier], user)
	}
	for k, v := range grouped {
		if len(v) < 2 {
			return fmt.Errorf("not enough users to perform merge, found %d for id %s, should be at least 2", len(v), k)
		}
		sess := ss.NewSession(ctx)
		defer sess.Close()
		// add Begin() before any action
		err := sess.Begin()
		if err != nil {
			return fmt.Errorf("could not open a sess: %w", err)
		}
		err = ss.InTransaction(ctx, func(ctx context.Context) error {
			var intoUser user.User
			var intoUserId int64
			var fromUserIds []int64
			for _, u := range v {
				if u.Direction == "+" {
					id, err := strconv.ParseInt(u.Id, 10, 64)
					if err != nil {
						return fmt.Errorf("could not convert id in +")
					}
					intoUserId = id
				} else if u.Direction == "-" {
					id, err := strconv.ParseInt(u.Id, 10, 64)
					if err != nil {
						return fmt.Errorf("could not convert id in -")
					}
					fromUserIds = append(fromUserIds, id)
				}
			}
			if _, err := sess.ID(intoUserId).Where(sqlstore.NotServiceAccountFilter(ss)).Get(&intoUser); err != nil {
				return fmt.Errorf("could not find intoUser: %w", err)
			}

			for _, fromUserId := range fromUserIds {
				var fromUser user.User
				if _, err := sess.ID(fromUserId).Where(sqlstore.NotServiceAccountFilter(ss)).Get(&fromUser); err != nil {
					return fmt.Errorf("could not find from userId: %w", err)
				}

				// update intoUserId email and log

				// update all tables fromUserIds to intoUserIds
				err := updateUserIds(intoUser, fromUser, sess)
				if err != nil {
					return fmt.Errorf("error during updating userIds: %w", err)
				}

				// deletes the from user

				// TODO: make test verify that before deleting a user, we make sure that that reference is not present in any tables
				delErr := ss.DeleteUserInSession(ctx, sess, &models.DeleteUserCommand{UserId: fromUserId})
				if delErr != nil {
					return fmt.Errorf("error during deletion of user: %w", delErr)
				}
			}
			return nil
		})
		if err != nil {
			return fmt.Errorf("unable to perform db operation on useridentification: %s: %w", k, err)
		}
		commitErr := sess.Commit()
		if commitErr != nil {
			return fmt.Errorf("could not commit operation for useridentification %s: %w", k, commitErr)
		}
	}
	return nil
}

func updateUserIds(intoUser user.User, fromUser user.User, sess *sqlstore.DBSession) error {
	// TODO:
	/*
		tables that have user_id references

			tbl_name |
			--- |
			temp_user |
			star |
			org_user |
			dashboard_snapshot |
			quota |
			preferences |
			annotation |
			team_member |
			dashboard_acl |
			user_auth |
			user_auth_token |
			user_role |
			query_history_star |

			tables take using this query
			```sql
			select tbl_name, sql from sqlite_master where sql like '%CREATE TABLE%%user_id%'
			and type = 'table';
			```
	*/
	// -------------- approach 1 ---------
	// ONE sql to rule them all

	// approach taken from https://stackoverflow.com/a/32082037
	// namedParameters := func(format string, args ...string) string {
	// 	r := strings.NewReplacer(args...)
	// 	return r.Replace(format)
	// }
	// innerJoinSql := namedParameters(`UPDATE user
	// INNER JOIN team_member ON team_member.user_id = u.id
	// INNER JOIN org_user ON org_user.user_id = u.id
	// SET team_member.user_id = {intoUserID},
	// org_user.user_id = {intoUserID}
	// WHERE user.id = {fromUserID};`,
	// 	"{intoUserID}", fmt.Sprintf("%d", intoUser.ID), "{fromUserID}", fmt.Sprintf("%d", fromUser.ID))

	// -------------- approach 2 ---------
	// updates for each table, will have multiple updates in one sql query
	//
	//
	_, err := sess.Table("team_member").ID(fromUser.ID).Update(map[string]interface{}{"user_id": intoUser.ID})
	if err != nil {
		return err
	}
	_, err = sess.Table("org_user").ID(fromUser.ID).Update(map[string]interface{}{"user_id": intoUser.ID})
	if err != nil {
		return err
	}

	return nil

}
