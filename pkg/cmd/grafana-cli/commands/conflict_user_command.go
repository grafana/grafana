package commands

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"github.com/fatih/color"
	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func initConflictCfg(cmd *utils.ContextCommandLine) (*setting.Cfg, error) {
	configOptions := strings.Split(cmd.String("configOverrides"), " ")
	configOptions = append(configOptions, cmd.Args().Slice()...)
	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   cmd.ConfigFile(),
		HomePath: cmd.HomePath(),
		Args:     append(configOptions, "cfg:log.level=error"), // tailing arguments have precedence over the options string
	})

	if err != nil {
		return nil, err
	}
	return cfg, nil
}

func initializeConflictResolver(cmd *utils.ContextCommandLine, f Formatter, ctx *cli.Context) (*ConflictResolver, error) {
	cfg, err := initConflictCfg(cmd)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to load configuration", err)
	}
	s, err := getSqlStore(cfg)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to get to sql", err)
	}
	conflicts, err := GetUsersWithConflictingEmailsOrLogins(ctx, s)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to get users with conflicting logins", err)
	}
	quotaService := quotaimpl.ProvideService(s, cfg)
	userService, err := userimpl.ProvideService(s, nil, cfg, nil, nil, quotaService, supportbundlestest.NewFakeBundleService())
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to get user service", err)
	}
	routing := routing.ProvideRegister()
	featMgmt, err := featuremgmt.ProvideManagerService(cfg, nil)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to get feature management service", err)
	}
	acService, err := acimpl.ProvideService(cfg, s, routing, nil, nil, featMgmt)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to get access control", err)
	}
	resolver := ConflictResolver{Users: conflicts, Store: s, userService: userService, ac: acService}
	resolver.BuildConflictBlocks(conflicts, f)
	return &resolver, nil
}

func getSqlStore(cfg *setting.Cfg) (*sqlstore.SQLStore, error) {
	tracer, err := tracing.ProvideService(cfg)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to initialize tracer service", err)
	}
	bus := bus.ProvideBus(tracer)
	return sqlstore.ProvideService(cfg, nil, &migrations.OSSMigrations{}, bus, tracer)
}

func runListConflictUsers() func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		whiteBold := color.New(color.FgWhite).Add(color.Bold)
		r, err := initializeConflictResolver(cmd, whiteBold.Sprintf, context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to initialize conflict resolver", err)
		}
		if len(r.Users) < 1 {
			logger.Info(color.GreenString("No Conflicting users found.\n\n"))
			return nil
		}
		logger.Infof("\n\nShowing conflicts\n\n")
		logger.Infof(r.ToStringPresentation())
		logger.Infof("\n")
		if len(r.DiscardedBlocks) != 0 {
			r.logDiscardedUsers()
		}
		return nil
	}
}

func runGenerateConflictUsersFile() func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		r, err := initializeConflictResolver(cmd, fmt.Sprintf, context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to initialize conflict resolver", err)
		}
		if len(r.Users) < 1 {
			logger.Info(color.GreenString("No Conflicting users found.\n\n"))
			return nil
		}
		tmpFile, err := generateConflictUsersFile(r)
		if err != nil {
			return fmt.Errorf("generating file return error: %w", err)
		}
		logger.Infof("\n\ngenerated file\n")
		logger.Infof("%s\n\n", tmpFile.Name())
		logger.Infof("once the file is edited and resolved conflicts, you can either validate or ingest the file\n\n")
		if len(r.DiscardedBlocks) != 0 {
			r.logDiscardedUsers()
		}
		return nil
	}
}

func runValidateConflictUsersFile() func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		r, err := initializeConflictResolver(cmd, fmt.Sprintf, context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to initialize conflict resolver", err)
		}

		// read in the file to validate
		// read in the file to ingest
		arg := cmd.Args().First()
		if arg == "" {
			return fmt.Errorf("please specify a absolute path to file to read from")
		}
		b, err := os.ReadFile(filepath.Clean(arg))
		if err != nil {
			logger.Error(color.RedString("validation failed with an error"))
			return fmt.Errorf("could not read file with error %s", err)
		}
		validErr := getValidConflictUsers(r, b)
		if validErr != nil {
			logger.Error(color.RedString("validation failed with an error"))
			return fmt.Errorf("could not validate file with error:\n%s", validErr)
		}
		logger.Info(color.GreenString("File validation complete.\n"))
		logger.Info("File can be used with the `ingest-file` command.\n\n")
		return nil
	}
}

func runIngestConflictUsersFile() func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}
		r, err := initializeConflictResolver(cmd, fmt.Sprintf, context)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to initialize conflict resolver", err)
		}

		// read in the file to ingest
		arg := cmd.Args().First()
		if arg == "" {
			return errors.New("please specify a absolute path to file to read from")
		}
		b, err := os.ReadFile(filepath.Clean(arg))
		if err != nil {
			return fmt.Errorf("could not read file with error %e", err)
		}
		validErr := getValidConflictUsers(r, b)
		if validErr != nil {
			return fmt.Errorf("could not validate file with error:\n%s", validErr)
		}
		// should we rebuild blocks here?
		// kind of a weird thing maybe?
		if len(r.ValidUsers) == 0 {
			return fmt.Errorf("no users")
		}
		r.showChanges()
		if !confirm("\n\nWe encourage users to create a db backup before running this command. \n Proceed with operation") {
			return fmt.Errorf("user cancelled")
		}
		err = r.MergeConflictingUsers(context.Context)
		if err != nil {
			return fmt.Errorf("not able to merge with %e", err)
		}
		logger.Info("\n\nconflicts resolved.\n")
		return nil
	}
}

func getDocumentationForFile() string {
	return `# Conflicts File
# This file is generated by the grafana-cli command ` + color.CyanString("grafana-cli admin user-manager conflicts generate-file") + `.
#
# Commands:
# +, keep <user> = keep user
# -, delete <user> = delete user
#
# The fields conflict_email and conflict_login
# indicate that we see a conflict in email and/or login with another user.
# Both these fields can be true.
#
# There needs to be exactly one picked user per conflict block.
#
# The lines can be re-ordered.
#
# If you feel like you want to wait with a specific block,
# delete all lines regarding that conflict block.
# email - the user’s email
# login - the user’s login/username
# last_seen_at - the user’s last login
# auth_module - if the user was created/signed in using an authentication provider
# conflict_email - a boolean if we consider the email to be a conflict
# conflict_login - a boolean if we consider the login to be a conflict
#
`
}

func generateConflictUsersFile(r *ConflictResolver) (*os.File, error) {
	tmpFile, err := os.CreateTemp(os.TempDir(), "conflicting_user_*.diff")
	if err != nil {
		return nil, err
	}
	if _, err := tmpFile.WriteString(getDocumentationForFile()); err != nil {
		return nil, err
	}
	if _, err := tmpFile.WriteString(r.ToStringPresentation()); err != nil {
		return nil, err
	}
	return tmpFile, nil
}

func getValidConflictUsers(r *ConflictResolver, b []byte) error {
	newConflicts := make(ConflictingUsers, 0)
	// need to verify that id or email exists
	previouslySeenIds := map[string]bool{}
	previouslySeenEmails := map[string]bool{}
	previouslySeenLogins := map[string]bool{}
	for _, users := range r.Blocks {
		for _, u := range users {
			previouslySeenIds[strings.ToLower(u.ID)] = true
			previouslySeenEmails[strings.ToLower(u.Email)] = true
			previouslySeenLogins[strings.ToLower(u.Login)] = true
		}
	}
	// tested in https://regex101.com/r/una3zC/1
	diffPattern := `^[+-]`
	// compiling since in a loop
	matchingExpression, err := regexp.Compile(diffPattern)
	if err != nil {
		return fmt.Errorf("unable to compile regex %s: %w", diffPattern, err)
	}
	counterKeepUsersForBlock := map[string]int{}
	counterDeleteUsersForBlock := map[string]int{}
	currentBlock := ""
	for rowNumber, row := range strings.Split(string(b), "\n") {
		// end of file
		if row == "" {
			break
		}
		// if the row starts with a #, it is a comment
		if row[0] == '#' {
			continue
		}

		entryRow := matchingExpression.MatchString(row)
		// not an entry row -> is a conflict block row
		if !entryRow {
			// check for malformed row
			// rows should be of the form
			// conflict: <conflict>
			// or
			// + id: <id>
			// - id: <id>
			if (row[0] != '-') && (row[0] != '+') && (row[0] != 'c') {
				return fmt.Errorf("invalid start character (expected '+,-') found %c for row number %d", row[0], rowNumber+1)
			}

			// is a conflict block row
			// conflict: hej
			currentBlock = row
			continue
		}
		// need to track how many keep users we have for a block
		if _, ok := counterKeepUsersForBlock[currentBlock]; !ok {
			counterKeepUsersForBlock[currentBlock] = 0
		}
		if _, ok := counterDeleteUsersForBlock[currentBlock]; !ok {
			counterDeleteUsersForBlock[currentBlock] = 0
		}
		if row[0] == '+' {
			counterKeepUsersForBlock[currentBlock] += 1
		}
		if row[0] == '-' {
			counterDeleteUsersForBlock[currentBlock] += 1
		}
		newUser := &ConflictingUser{}
		err := newUser.Marshal(row)
		if err != nil {
			return fmt.Errorf("could not parse the content of the file with error %e", err)
		}
		if newUser.ConflictEmail != "" && !previouslySeenEmails[strings.ToLower(newUser.Email)] {
			return fmt.Errorf("not valid email: %s, email not seen in previous conflicts", newUser.Email)
		}
		if newUser.ConflictLogin != "" && !previouslySeenLogins[strings.ToLower(newUser.Login)] {
			return fmt.Errorf("not valid login: %s, login not seen in previous conflicts", newUser.Login)
		}
		// valid entry
		newConflicts = append(newConflicts, *newUser)
	}
	for block, count := range counterKeepUsersForBlock {
		// check if we only have one addition for each block
		if count != 1 {
			return fmt.Errorf("invalid number of users to keep, expected 1, got %d for block: %s", count, block)
		}
	}
	for block, count := range counterDeleteUsersForBlock {
		// check if we have at least one deletion for each block
		if count < 1 {
			return fmt.Errorf("invalid number of users to delete, should be at least 1, got %d for block %s", count, block)
		}
	}
	r.ValidUsers = newConflicts
	r.BuildConflictBlocks(newConflicts, fmt.Sprintf)
	return nil
}

func (r *ConflictResolver) MergeConflictingUsers(ctx context.Context) error {
	for block, users := range r.Blocks {
		if len(users) < 2 {
			return fmt.Errorf("not enough users to perform merge, found %d for id %s, should be at least 2", len(users), block)
		}
		var intoUser user.User
		var intoUserId int64
		var fromUserIds []int64

		// creating a session for each block of users
		// we want to rollback incase something happens during update / delete
		if err := r.Store.InTransaction(ctx, func(ctx context.Context) error {
			for _, u := range users {
				if u.Direction == "+" {
					id, err := strconv.ParseInt(u.ID, 10, 64)
					if err != nil {
						return fmt.Errorf("could not convert id in +")
					}
					intoUserId = id
				} else if u.Direction == "-" {
					id, err := strconv.ParseInt(u.ID, 10, 64)
					if err != nil {
						return fmt.Errorf("could not convert id in -")
					}
					fromUserIds = append(fromUserIds, id)
				}
			}
			if _, err := r.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: intoUserId}); err != nil {
				return fmt.Errorf("could not find intoUser: %w", err)
			}
			for _, fromUserId := range fromUserIds {
				_, err := r.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: fromUserId})
				if err != nil && errors.Is(err, user.ErrUserNotFound) {
					fmt.Printf("user with id %d does not exist, skipping\n", fromUserId)
				}
				if err != nil {
					return fmt.Errorf("could not find fromUser: %w", err)
				}
				//  delete the user
				delErr := r.userService.Delete(ctx, &user.DeleteUserCommand{UserID: fromUserId})
				if delErr != nil {
					return fmt.Errorf("error during deletion of user: %w", delErr)
				}
				delACErr := r.ac.DeleteUserPermissions(ctx, 0, fromUserId)
				if delACErr != nil {
					return fmt.Errorf("error during deletion of user access control: %w", delACErr)
				}
			}

			updateMainCommand := &user.UpdateUserCommand{
				UserID: intoUser.ID,
				Login:  strings.ToLower(intoUser.Login),
				Email:  strings.ToLower(intoUser.Email),
			}
			updateErr := r.userService.Update(ctx, updateMainCommand)
			if updateErr != nil {
				return fmt.Errorf("could not update user: %w", updateErr)
			}

			return nil
		}); err != nil {
			return err
		}
	}
	return nil
}

/*
hej@test.com+hej@test.com
all of the permissions, roles and ownership will be transferred to the user.
+ id: 1, email: hej@test.com, login: hej@test.com
these user(s) will be deleted and their permissions transferred.
- id: 2, email: HEJ@TEST.COM, login: HEJ@TEST.COM
- id: 3, email: hej@TEST.com, login: hej@TEST.com
*/
func (r *ConflictResolver) showChanges() {
	if len(r.ValidUsers) == 0 {
		fmt.Println("no changes will take place as we have no valid users.")
		return
	}

	var b strings.Builder
	for block, users := range r.Blocks {
		if _, ok := r.DiscardedBlocks[block]; ok {
			// skip block
			continue
		}

		// looping as we want to can get these out of order (meaning the + and -)
		var mainUser ConflictingUser
		for _, u := range users {
			if u.Direction == "+" {
				mainUser = u
				break
			}
		}
		b.WriteString("Keep the following user.\n")
		b.WriteString(fmt.Sprintf("%s\n", block))
		b.WriteString(color.GreenString(fmt.Sprintf("id: %s, email: %s, login: %s\n", mainUser.ID, mainUser.Email, mainUser.Login)))
		for _, r := range fmt.Sprintf("%s%s", mainUser.Email, mainUser.Login) {
			if unicode.IsUpper(r) {
				b.WriteString("Will be change to:\n")
				b.WriteString(color.GreenString(fmt.Sprintf("id: %s, email: %s, login: %s\n", mainUser.ID, strings.ToLower(mainUser.Email), strings.ToLower(mainUser.Login))))
				break
			}
		}
		b.WriteString("\n\n")
		b.WriteString("The following user(s) will be deleted.\n")
		for _, user := range users {
			if user.ID == mainUser.ID {
				continue
			}
			// mergeable users
			b.WriteString(color.RedString(fmt.Sprintf("id: %s, email: %s, login: %s\n", user.ID, user.Email, user.Login)))
		}
		b.WriteString("\n\n")
	}
	logger.Info("\n\nChanges that will take place\n\n")
	logger.Infof(b.String())
}

// Formatter make it possible for us to write to terminal and to a file
// with different formats depending on the usecase
type Formatter func(format string, a ...interface{}) string

func shouldDiscardBlock(seenUsersInBlock map[string]string, block string, user ConflictingUser) bool {
	// loop through users to see if we should skip this block
	// we have some more tricky scenarios where we have more than two users that can have conflicts with each other
	// we have made the approach to discard any users that we have seen
	if _, ok := seenUsersInBlock[user.ID]; ok {
		// we have seen the user in different block than the current block
		if seenUsersInBlock[user.ID] != block {
			return true
		}
	}
	seenUsersInBlock[user.ID] = block
	return false
}

// BuildConflictBlocks builds blocks of users where each block is a unique email/login
// NOTE: currently this function assumes that the users are in order of grouping already
func (r *ConflictResolver) BuildConflictBlocks(users ConflictingUsers, f Formatter) {
	discardedBlocks := make(map[string]bool)
	seenUsersToBlock := make(map[string]string)
	blocks := make(map[string]ConflictingUsers)
	for _, user := range users {
		// conflict blocks is how we identify a conflict in the user base.
		var conflictBlock string
		// sqlite   generates string : ""/true
		// postgres generates string : false/true
		if user.ConflictEmail == "false" {
			user.ConflictEmail = ""
		}
		if user.ConflictLogin == "false" {
			user.ConflictLogin = ""
		}
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
		if u.ID == target.ID {
			return true
		}
	}
	return false
}

func (r *ConflictResolver) logDiscardedUsers() {
	keys := make([]string, 0, len(r.DiscardedBlocks))
	for block := range r.DiscardedBlocks {
		for _, u := range r.Blocks[block] {
			keys = append(keys, u.ID)
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
	var b strings.Builder
	for block, users := range r.Blocks {
		if _, ok := r.DiscardedBlocks[block]; ok {
			// skip block
			continue
		}
		for _, user := range users {
			if !startOfBlock[block] {
				b.WriteString(fmt.Sprintf("%s\n", block))
				startOfBlock[block] = true
				b.WriteString(fmt.Sprintf("+ id: %s, email: %s, login: %s, last_seen_at: %s, auth_module: %s, conflict_email: %s, conflict_login: %s\n",
					user.ID,
					user.Email,
					user.Login,
					user.LastSeenAt,
					user.AuthModule,
					user.ConflictEmail,
					user.ConflictLogin,
				))
				continue
			}
			// mergeable users
			b.WriteString(fmt.Sprintf("- id: %s, email: %s, login: %s, last_seen_at: %s, auth_module: %s, conflict_email: %s, conflict_login: %s\n",
				user.ID,
				user.Email,
				user.Login,
				user.LastSeenAt,
				user.AuthModule,
				user.ConflictEmail,
				user.ConflictLogin,
			))
		}
	}
	return b.String()
}

type ConflictResolver struct {
	Store           *sqlstore.SQLStore
	userService     user.Service
	ac              accesscontrol.Service
	Config          *setting.Cfg
	Users           ConflictingUsers
	ValidUsers      ConflictingUsers
	Blocks          map[string]ConflictingUsers
	DiscardedBlocks map[string]bool
}

type ConflictingUser struct {
	// direction is the +/- which indicates if we should keep or delete the user
	Direction     string `xorm:"direction"`
	ID            string `xorm:"id"`
	Email         string `xorm:"email"`
	Login         string `xorm:"login"`
	LastSeenAt    string `xorm:"last_seen_at"`
	AuthModule    string `xorm:"auth_module"`
	ConflictEmail string `xorm:"conflict_email"`
	ConflictLogin string `xorm:"conflict_login"`
}

type ConflictingUsers []ConflictingUser

func (c *ConflictingUser) Marshal(filerow string) error {
	// example view of the file to ingest
	// +/- id: 1, email: hej, auth_module: LDAP
	trimmedSpaces := strings.ReplaceAll(filerow, " ", "")
	if trimmedSpaces[0] == '+' {
		c.Direction = "+"
	} else if trimmedSpaces[0] == '-' {
		c.Direction = "-"
	} else {
		return fmt.Errorf("unable to get which operation was chosen")
	}
	trimmed := strings.TrimLeft(trimmedSpaces, "+-")
	values := strings.Split(trimmed, ",")

	if len(values) < 3 {
		return fmt.Errorf("expected at least 3 values in entry row")
	}
	// expected fields
	id := strings.Split(values[0], ":")
	email := strings.Split(values[1], ":")
	login := strings.Split(values[2], ":")
	c.ID = id[1]
	c.Email = email[1]
	c.Login = login[1]

	// why trim values, 2022-08-20:19:17:12
	lastSeenAt := strings.TrimPrefix(values[3], "last_seen_at:")
	authModule := strings.Split(values[4], ":")
	if len(authModule) < 2 {
		c.AuthModule = ""
	} else {
		c.AuthModule = authModule[1]
	}
	c.LastSeenAt = lastSeenAt

	// which conflict
	conflictEmail := strings.Split(values[5], ":")
	conflictLogin := strings.Split(values[6], ":")
	if len(conflictEmail) < 2 {
		c.ConflictEmail = ""
	} else {
		c.ConflictEmail = conflictEmail[1]
	}
	if len(conflictLogin) < 2 {
		c.ConflictLogin = ""
	} else {
		c.ConflictLogin = conflictLogin[1]
	}
	return nil
}

func GetUsersWithConflictingEmailsOrLogins(ctx *cli.Context, s *sqlstore.SQLStore) (ConflictingUsers, error) {
	queryUsers := make([]ConflictingUser, 0)
	outerErr := s.WithDbSession(ctx.Context, func(dbSession *db.Session) error {
		var rawSQL string
		if s.GetDialect().DriverName() == migrator.Postgres {
			rawSQL = conflictUserEntriesSQLPostgres()
		} else if s.GetDialect().DriverName() == migrator.SQLite {
			rawSQL = conflictingUserEntriesSQL(s)
		}
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
			'true'
		FROM
			` + userDialect + `
		WHERE (LOWER(u1.email) = LOWER(u2.email)) AND(u1.email != u2.email)) AS conflict_email,
		( SELECT
			'true'
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

func conflictUserEntriesSQLPostgres() string {
	sqlQuery := `
SELECT DISTINCT
	u1.id,
	u1.email,
	u1.login,
	u1.last_seen_at,
	ua.auth_module,
	((LOWER(u1.email) = LOWER(u2.email))
		AND(u1.email != u2.email)) AS conflict_email,
	((LOWER(u1.login) = LOWER(u2.login))
		AND(u1.login != u2.login)) AS conflict_login
FROM
	"user" AS u1,
	"user" AS u2
	LEFT JOIN user_auth AS ua ON ua.user_id = u2.id
WHERE ((LOWER(u1.email) = LOWER(u2.email))
	AND(u1.email != u2.email)) IS TRUE
	OR((LOWER(u1.login) = LOWER(u2.login))
	AND(u1.login != u2.login)) IS TRUE
	AND(u1.is_service_account = FALSE)
ORDER BY
	conflict_email,
	conflict_login,
	u1.id;
;
	`
	return sqlQuery
}

func notServiceAccount(ss *sqlstore.SQLStore) string {
	return fmt.Sprintf("is_service_account = %s",
		ss.Dialect.BooleanStr(false))
}

// confirm function asks for user input
// returns bool
func confirm(confirmPrompt string) bool {
	var input string
	logger.Infof("%s? [y|n]: ", confirmPrompt)

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
