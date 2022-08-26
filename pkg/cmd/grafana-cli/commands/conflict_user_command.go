package commands

import (
	"fmt"
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
		resolver := ConflictResolver{Users: conflicts}
		resolver.BuildConflictBlocks(whiteBold.Sprintf)
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
		resolver := ConflictResolver{Users: conflicts}
		resolver.BuildConflictBlocks(fmt.Sprintf)
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

func (r *ConflictResolver) BuildConflictBlocks(f Formatter) {
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
	if len(values) != 5 {
		// fmt errror
		return fmt.Errorf("expected 5 values in entryrow")
	}
	id := strings.Split(values[0], ":")
	email := strings.Split(values[1], ":")
	login := strings.Split(values[2], ":")
	lastSeenAt := strings.TrimPrefix(values[3], "last_seen_at:")
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

func notServiceAccount(ss *sqlstore.SQLStore) string {
	return fmt.Sprintf("is_service_account = %s",
		ss.Dialect.BooleanStr(false))
}
