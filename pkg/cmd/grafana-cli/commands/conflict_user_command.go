package commands

import (
	"context"
	"errors"
	"fmt"
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
	cfg.Logger = nil
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
		whiteBold := color.New(color.FgWhite).Add(color.Bold)
		resolver := ConflictResolver{}
		resolver.BuildConflictBlocks(conflicts, whiteBold.Sprintf)
		logger.Infof("\n\nShowing Conflicts\n\n")
		logger.Infof(resolver.ToStringPresentation())
		logger.Infof("\n")
		// TODO: remove line when finished
		// this is only for debugging
		if len(resolver.DiscardedBlocks) != 0 {
			resolver.logDiscardedUsers()
		}
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
		resolver := ConflictResolver{}
		resolver.BuildConflictBlocks(conflicts, fmt.Sprintf)
		tmpFile, err := generateConflictUsersFile(&resolver)
		if err != nil {
			return fmt.Errorf("generating file return error: %w", err)
		}
		logger.Infof("\n\ngenerated file\n")
		logger.Infof("%s\n\n", tmpFile.Name())
		logger.Infof("once the file is edited and resolved conflicts, you can either validate or ingest the file\n\n")
		if len(resolver.DiscardedBlocks) != 0 {
			resolver.logDiscardedUsers()
		}
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
		b, err := os.ReadFile(arg)
		if err != nil {
			return fmt.Errorf("could not read file with error %s", err)
		}
		// validation
		s, err := getSqlStore(context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get to sql", err)
		}
		conflicts, err := GetUsersWithConflictingEmailsOrLogins(context, s)
		if err != nil {
			return fmt.Errorf("%v: %w", "grafana error: sql error to get users with conflicts, abandoning validation", err)
		}
		resolver := ConflictResolver{Users: conflicts}
		resolver.BuildConflictBlocks(conflicts, fmt.Sprintf)
		b, err = os.ReadFile(arg)
		if err != nil {
			return fmt.Errorf("could not read file with error %e", err)
		}
		validErr := getValidConflictUsers(&resolver, b)
		if validErr != nil {
			return fmt.Errorf("could not validate file with error %s", err)
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

		s, err := getSqlStore(context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get to sql", err)
		}
		conflicts, err := GetUsersWithConflictingEmailsOrLogins(context, s)
		if err != nil {
			return fmt.Errorf("%v: %w", "grafana error: sql error to get users with conflicts, abandoning validation", err)
		}
		resolver := ConflictResolver{Users: conflicts}
		resolver.BuildConflictBlocks(conflicts, fmt.Sprintf)
		b, err := os.ReadFile(arg)
		if err != nil {
			return fmt.Errorf("could not read file with error %e", err)
		}
		validErr := getValidConflictUsers(&resolver, b)
		if validErr != nil {
			return fmt.Errorf("could not validate file with error %s", err)
		}
		// should we rebuild blocks here?
		// kind of a weird thing maybe?
		err = mergeUsers(context, &resolver)
		if err != nil {
			return fmt.Errorf("not able to merge")
		}
		return fmt.Errorf("not implemented")
	}
}

func generateConflictUsersFile(r *ConflictResolver) (*os.File, error) {
	tmpFile, err := os.CreateTemp(os.TempDir(), "conflicting_user_*.diff")
	if err != nil {
		return nil, err
	}
	if _, err := tmpFile.Write([]byte(r.ToStringPresentation())); err != nil {
		return nil, err
	}
	return tmpFile, nil
}

func mergeUsers(context *cli.Context, r *ConflictResolver) error {
	if len(r.ValidUsers) == 0 {
		return fmt.Errorf("no users")
	}
	// need to validate input again, just because
	sqlStore, err := getSqlStore(context)
	if err != nil {
		return fmt.Errorf("not able to get sqlstore for merging users with: %w", err)
	}
	r.Users.showChanges()
	if !confirm() {
		return fmt.Errorf("user cancelled")
	}
	return r.MergeConflictingUsers(context.Context, sqlStore)
}

func getValidConflictUsers(r *ConflictResolver, b []byte) error {
	newConflicts := make(ConflictingUsers, 0)
	// need to verify that id or email exists
	previouslySeenBlock := map[string]bool{}
	previouslySeenIds := map[string]bool{}
	previouslySeenEmails := map[string]bool{}
	for block, users := range r.Blocks {
		previouslySeenBlock[block] = true
		for _, u := range users {
			previouslySeenIds[strings.ToLower(u.Id)] = true
			previouslySeenEmails[strings.ToLower(u.Email)] = true
		}
	}

	// tested in https://regex101.com/r/Vgoe3r/1
	diffPattern := `^\+|\-`
	// compiling since in a loop
	matchingExpression, err := regexp.Compile(diffPattern)
	if err != nil {
		return fmt.Errorf("unable to complie regex %s: %w", diffPattern, err)
	}
	for _, row := range strings.Split(string(b), "\n") {
		if row == "" {
			// end of file
			break
		}
		entryRow := matchingExpression.Match([]byte(row))
		if err != nil {
			return fmt.Errorf("could not identify the row")
		}
		if !entryRow {
			// block row

			// evaluate that the blocks, actually exists since last time
			// example
			// conflict: hej
			// + id: 1, email: HEJ, login: hej, last_seen_at: 2012
			if !previouslySeenBlock[row] {
				return fmt.Errorf("did not recognize block \n%s\n\n terminated validation", row)
			}
			continue
		}

		switch {
		case strings.HasPrefix(row, "+"):
			newUser := &ConflictingUser{}
			newUser.Marshal(row)
			if !previouslySeenEmails[strings.ToLower(newUser.Email)] {
				return fmt.Errorf("not valid email: %s, email not in previous conflicts seen", newUser.Email)
			}
			if strings.ToLower(newUser.Email) != newUser.Email {
				return fmt.Errorf("not valid email: %s for user: %s, email needs to be lowercased", newUser.Email, newUser.Id)
			}
			if strings.ToLower(newUser.Login) != newUser.Login {
				return fmt.Errorf("not valid login for user: %s, login needs to be lowercased", newUser.Id)
			}
			// valid entry
			newConflicts = append(newConflicts, *newUser)
		case strings.HasPrefix(row, "-"):
			newUser := &ConflictingUser{}
			err := newUser.Marshal(row)
			if err != nil {
				return fmt.Errorf("unable to know which operation should be performed on the user")
			}
			if !previouslySeenEmails[strings.ToLower(newUser.Email)] {
				return fmt.Errorf("not valid email, email not in previous list")
			}
			// valid entry
			newConflicts = append(newConflicts, *newUser)
		default:
			return fmt.Errorf("filerow not identified, not valid file")
		}
	}
	// TODO:
	// make a human readable form for how we interpret the newConflicts
	// meaning how do we show have we will perform this operation
	// and the final output of the ingest operation
	r.ValidUsers = newConflicts
	r.BuildConflictBlocks(newConflicts, fmt.Sprintf)
	return nil
}

func (c *ConflictingUsers) showChanges() {
	// TODO:
	// use something like
	// diff --git a/pkg/cmd/grafana-cli/commands/commands.go b/pkg/cmd/grafana-cli/commands/commands.go
	logger.Info("show changes should be implemented\n")
}

// Formatter make it possible for us to write to terminal and to a file
// with different formats depending on the usecase
type Formatter func(format string, a ...interface{}) string

func BoldFormatter(format string, a ...interface{}) string {
	white := color.New(color.FgWhite)
	whiteBold := white.Add(color.Bold)
	return whiteBold.Sprintf(format, a...)
}

func shouldDiscardBlock(seenUsersInBlock map[string]string, block string, user ConflictingUser) bool {
	// loop through users to see if we should skip this block
	// we have some more tricky scenarios where we have more than two users that can have conflicts with each other
	// we have made the approach to discard any users that we have seen
	if _, ok := seenUsersInBlock[user.Id]; ok {
		// we have seen the user in different block than the current block
		if seenUsersInBlock[user.Id] != block {
			return true
		}
	}
	seenUsersInBlock[user.Id] = block
	return false
}

func (r *ConflictResolver) BuildConflictBlocks(users ConflictingUsers, f Formatter) {
	r.Users = users
	discardedBlocks := make(map[string]bool)
	seenUsersToBlock := make(map[string]string)
	blocks := make(map[string]ConflictingUsers)
	for _, user := range r.Users {
		// conflict blocks is how we identify a conflict in the user base.
		var conflictBlock string
		if user.ConflictEmail != "" {
			conflictBlock = f("conflict: %s", strings.ToLower(user.Email))
		} else if user.ConflictLogin != "" {
			conflictBlock = f("conflict: %s", strings.ToLower(user.Login))
		} else if user.ConflictEmail != "" && user.ConflictLogin != "" {
			// both conflicts
			// should not be here unless changed in sql
			conflictBlock = f("conflict: %s%s", strings.ToLower(user.Email), strings.ToLower(user.Login))
		}

		// discard logic
		if shouldDiscardBlock(seenUsersToBlock, conflictBlock, user) {
			discardedBlocks[conflictBlock] = true
		}

		// adding users to blocks
		if _, ok := blocks[conflictBlock]; !ok {
			blocks[conflictBlock] = []ConflictingUser{user}
			continue
		}
		// skip user thats already part of the block
		// since we get duplicate entries
		if contains(blocks[conflictBlock], user) {
			continue
		}
		blocks[conflictBlock] = append(blocks[conflictBlock], user)
	}
	r.Blocks = blocks
	r.DiscardedBlocks = discardedBlocks
}

func contains(cu ConflictingUsers, target ConflictingUser) bool {
	for _, u := range cu {
		if u.Id == target.Id {
			return true
		}
	}
	return false
}

func (r *ConflictResolver) logDiscardedUsers() {
	keys := make([]string, 0, len(r.DiscardedBlocks))
	for block := range r.DiscardedBlocks {
		for _, u := range r.Blocks[block] {
			keys = append(keys, u.Id)
		}
	}
	warn := color.YellowString("Note: We discarded some conflicts that have multiple conflicting types involved.")
	logger.Infof(`
%s

users discarded with more than one conflict:
ids: %s

Solve conflicts and run the command again to see other conflicts.
`, warn, strings.Join(keys, ","))
}

// handling tricky cases::
// if we have seen a user already
// note the conflict of that user
// discard that conflict for next time that the user runs the command

// only present one conflict per user
// go through each conflict email/login
// if any has ids that have already been seen
// discard that conflict
// make note to the user to run again after fixing these conflicts
func (r *ConflictResolver) ToStringPresentation() string {
	/*
		hej@test.com+hej@test.com
		+ id: 1, email: hej@test.com, login: hej@test.com
		- id: 2, email: HEJ@TEST.COM, login: HEJ@TEST.COM
		- id: 3, email: hej@TEST.com, login: hej@TEST.com
	*/
	startOfBlock := make(map[string]bool)
	fileString := ""
	for block, users := range r.Blocks {
		if _, ok := r.DiscardedBlocks[block]; ok {
			// skip block
			continue
		}
		for _, user := range users {
			if !startOfBlock[block] {
				fileString += fmt.Sprintf("%s\n", block)
				startOfBlock[block] = true
				fileString += fmt.Sprintf("+ id: %s, email: %s, login: %s\n", user.Id, user.Email, user.Login)
				continue
			}
			// mergable users
			fileString += fmt.Sprintf("- id: %s, email: %s, login: %s\n", user.Id, user.Email, user.Login)
		}
	}
	return fileString
}

type ConflictResolver struct {
	Users           ConflictingUsers
	ValidUsers      ConflictingUsers
	Blocks          map[string]ConflictingUsers
	DiscardedBlocks map[string]bool
}

type ConflictingUser struct {
	// IDENTIFIER
	// TODO: should have conflict block in sql for performance and stability
	Direction string `xorm:"direction"`
	// FIXME: refactor change to correct type int64
	Id    string `xorm:"id"`
	Email string `xorm:"email"`
	Login string `xorm:"login"`
	// FIXME: refactor change to correct type <>
	LastSeenAt string `xorm:"last_seen_at"`
	AuthModule string `xorm:"auth_module"`
	// currently not really used for anything
	ConflictEmail string `xorm:"conflict_email"`
	ConflictLogin string `xorm:"conflict_login"`
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

	if len(values) < 3 {
		return fmt.Errorf("expected at least 3 values in entryrow")
	}
	// expected fields
	id := strings.Split(values[0], ":")
	email := strings.Split(values[1], ":")
	login := strings.Split(values[2], ":")
	c.Id = id[1]
	c.Email = email[1]
	c.Login = login[1]

	// optional fields
	if len(values) == 5 {
		// why trim values, 2022-08-20:19:17:12
		lastSeenAt := strings.TrimPrefix(values[3], "last_seen_at:")
		authModule := strings.Split(values[4], ":")
		if len(authModule) < 2 {
			c.AuthModule = ""
		} else {
			c.AuthModule = authModule[1]
		}
		c.LastSeenAt = lastSeenAt
	}
	return nil
}

func GetUsersWithConflictingEmailsOrLogins(ctx *cli.Context, s *sqlstore.SQLStore) (ConflictingUsers, error) {
	queryUsers := make([]ConflictingUser, 0)
	outerErr := s.WithDbSession(ctx.Context, func(dbSession *sqlstore.DBSession) error {
		rawSQL := conflictingUserEntriesSQL(s)
		err := dbSession.SQL(rawSQL).Find(&queryUsers)
		return err
	})
	if outerErr != nil {
		return queryUsers, outerErr
	}
	return queryUsers, nil
}

// conflictingUserEntriesSQL orders conflicting users by their user_identification
// sorts the users by their useridentification and ids
func conflictingUserEntriesSQL(s *sqlstore.SQLStore) string {
	userDialect := db.DB.GetDialect(s).Quote("user")
	sqlQuery := `
	SELECT DISTINCT
	u1.id,
	u1.email,
	u1.login,
	u1.last_seen_at,
	user_auth.auth_module,
		( SELECT
			'conflict_email'
		FROM
			` + userDialect + `
		WHERE (LOWER(u1.email) = LOWER(u2.email)) AND(u1.email != u2.email)) AS conflict_email,
		( SELECT
			'conflict_login'
		FROM
			` + userDialect + `
		WHERE (LOWER(u1.login) = LOWER(u2.login) AND(u1.login != u2.login))) AS conflict_login
	FROM
		 ` + userDialect + ` AS u1, ` + userDialect + ` AS u2
	LEFT JOIN user_auth on user_auth.user_id = u1.id
	WHERE (conflict_email IS NOT NULL
		OR conflict_login IS NOT NULL)
		AND (u1.` + notServiceAccount(s) + `)
	ORDER BY conflict_email, conflict_login, u1.id`
	return sqlQuery
}

// MergeUser sets the user Server Admin flag
func (r *ConflictResolver) MergeConflictingUsers(ctx context.Context, ss *sqlstore.SQLStore) error {
	for block, users := range r.Blocks {
		if len(users) < 2 {
			return fmt.Errorf("not enough users to perform merge, found %d for id %s, should be at least 2", len(users), block)
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
			for _, u := range users {
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
			return fmt.Errorf("unable to perform db operation on useridentification: %s: %w", block, err)
		}
		commitErr := sess.Commit()
		if commitErr != nil {
			return fmt.Errorf("could not commit operation for useridentification %s: %w", block, commitErr)
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

func notServiceAccount(ss *sqlstore.SQLStore) string {
	return fmt.Sprintf("is_service_account = %s",
		ss.Dialect.BooleanStr(false))
}

// confirm function asks for user input
// returns bool
func confirm() bool {
	var input string
	logger.Infof("Do you want to continue with this operation? [y|n]: ")

	_, err := fmt.Scanln(&input)
	if err != nil {
		logger.Infof("could not parse input from user for confirmation")
		return false
	}
	input = strings.ToLower(input)
	if input == "y" || input == "yes" {
		return true
	}

	return false

}
