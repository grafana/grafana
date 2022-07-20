package commands

import (
	"bufio"
	"context"
	"fmt"
	"os"
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
	"github.com/urfave/cli/v2"
)

// listRemoteCommand prints out all plugins in the remote repo with latest version supported on current platform.
// If there are no supported versions for plugin it is skipped.

/*
FIXME: wording from Conflicting to multiple as a user might have more than two emails/logins, could be confusing
to have the word Conflicting for this
new word for Conflicting : conflicting (prefered now) / multiple

	TODO: also consider same login and email but different ids:
		login == email, id.login != id.email

	user-manager command listConflictingUsers
		lists users w. Conflicting emails or logins as
		`ids   | Conflicting-emails |  Conflicting-logins`
		`{4,5} | {user@test.com, user@TEST.com} | {user@test.com}`
	user-manager command merge-Conflicting-users
	input -> users
	output -> ids, foundConflictingEmails, foundConflictingLogins, lastActive (maybe)


	// IDENTIFIER
	login = username + email

	# proposal 1 - one command to list and merge
	type conflictUser struct {
		ids []int
		login string
		conflictEmails []string
		conflictLogins []string
	}
	type conflictUsers []conflictUsers

	users, err := getUsersWithConflictingEmailsOrLogins()
	if len(users) == 0 {
		return "no users found"
	}

	// ask if user want to start merging
	for u in := range (users) {
		// they can now quit
		promptIfUserWantToMerge()

		// recursiveFunction to merge users

		// two options
		// updateUserDetails(login, newValue, field)
		//  ||
		// mergeInto(login)
		// NOTE: need to update all userIds in all tables for the one you mergeFrom
		// keep id of the mergeInto <- mergeFrom . update userId to mergeInto in the mergeFrom user
		mergeUser(u)
	}
*/

func runConflictingUsersCommand() func(context *cli.Context) error {
	return func(context *cli.Context) error {
		cmd := &utils.ContextCommandLine{Context: context}

		cfg, err := initCfg(cmd)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to load configuration", err)
		}
		tracer, err := tracing.ProvideService(cfg)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to initialize tracer service", err)
		}
		bus := bus.ProvideBus(tracer)
		sqlStore, err := sqlstore.ProvideService(cfg, nil, &migrations.OSSMigrations{}, bus, tracer)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to initialize SQL store", err)
		}

		conflicts, err := GetUsersWithConflictingEmailsOrLogins(context.Context, sqlStore)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get users with conflicting logins", err)
		}
		if len(conflicts) < 1 {
			logger.Info(color.GreenString("No Conflicting users found.\n\n"))
			return nil
		}

		for _, cUser := range conflicts {
			logger.Infof("A user conflict found. \n")

			cType := cUser.Conflict()
			switch cType {
			case Merge:
				// pretty print conflicting users
				cUser.Print()

				// waiting for user to choose which user to merge to
				logger.Infof("Choose which user to merge into:")
				scanner := bufio.NewScanner(os.Stdin)
				if ok := scanner.Scan(); !ok {
					if err := scanner.Err(); err != nil {
						return fmt.Errorf("can't read conflict option from stdin: %w", err)
					}
					return fmt.Errorf("can't read conflict option from stdin")
				}
				choosenUserToMergeInto := scanner.Text()
				if !strings.Contains(cUser.Ids, choosenUserToMergeInto) {
					return fmt.Errorf("not a conflicting user id")
				}
				v, err := strconv.ParseInt(choosenUserToMergeInto, 10, 64)
				if err != nil {
					return fmt.Errorf("could not parse id from string")
				}
				otherUsers := cUser.Ids
				logger.Infof("this will merge users %d into the choosen user %s\n\n", otherUsers, choosenUserToMergeInto)
				if confirm() {
					err = mergeUser(v, cUser, sqlStore)
					if err != nil {
						return fmt.Errorf("couldnt merge user with error %w", err)
					}
				}
			case SameIdentification:
				return fmt.Errorf("have not implemented ways to deal with non mergeable users")
			default:
				logger.Infof("could not identify the conflict resolution for found users %s", cUser.Ids)
				continue
			}
		}

		return nil
	}
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

func promptToMerge(cUser ConflictingUsers) (int64, error) {
	logger.Infof("Choose which user to merge into:")
	scanner := bufio.NewScanner(os.Stdin)
	if ok := scanner.Scan(); !ok {
		if err := scanner.Err(); err != nil {
			return -1, fmt.Errorf("can't read conflict option from stdin: %w", err)
		}
		return -1, fmt.Errorf("can't read conflict option from stdin")
	}
	chosenUser := scanner.Text()
	if !strings.Contains(cUser.Ids, chosenUser) {
		return -1, fmt.Errorf("not a conflicting user id")
	}
	v, err := strconv.ParseInt(chosenUser, 10, 64)
	if err != nil {
		return -1, fmt.Errorf("could not parse id from string")
	}
	return v, nil
}

func promptSameIdentification(cUser ConflictingUsers) (int64, error) {
	logger.Infof("Found same identification for users, choose which user to keep and update:")
	scanner := bufio.NewScanner(os.Stdin)
	if ok := scanner.Scan(); !ok {
		if err := scanner.Err(); err != nil {
			return -1, fmt.Errorf("can't read conflict option from stdin: %w", err)
		}
		return -1, fmt.Errorf("can't read conflict option from stdin")
	}
	chosenUser := scanner.Text()
	if !strings.Contains(cUser.Ids, chosenUser) {
		return -1, fmt.Errorf("not a conflicting user id")
	}
	v, err := strconv.ParseInt(chosenUser, 10, 64)
	if err != nil {
		return -1, fmt.Errorf("could not parse id from string")
	}
	return v, nil
}

func (c ConflictingUsers) Print() {
	ids := strings.Split(c.Ids, ",")
	emails := strings.Split(c.ConflictEmails, ",")
	logins := strings.Split(c.ConflictLogins, ",")
	fmt.Printf("\n")
	for i := 0; i < len(ids); i++ {
		s := fmt.Sprintf("Id: %s, Email: %s, Login: %s\n---\n", ids[i], emails[i], logins[i])
		logger.Info(color.HiYellowString((s)))
	}
}

type conflictType string

const (
	Merge              conflictType = "merge"
	SameIdentification conflictType = "same_identification"
)

func (cUser ConflictingUsers) Conflict() conflictType {
	// FIXME:
	// need to make sure that we get same identification when that happens instead of email/logins cased
	var cType conflictType
	if cUser.SameIdentificationConflictIds {
		cType = SameIdentification
	} else if cUser.ConflictEmails != "" || cUser.ConflictLogins != "" {
		cType = Merge
	}
	return cType
}

func mergeUser(mergeIntoUser int64, cUser ConflictingUsers, sqlStore *sqlstore.SQLStore) error {
	stringIds := strings.Split(cUser.Ids, ",")
	fromUserIds := make([]int64, 0, len(stringIds))
	for _, raw := range stringIds {
		v, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return fmt.Errorf("could not parse id from string")
		}
		fromUserIds = append(fromUserIds, v)
	}
	return sqlStore.MergeUser(mergeIntoUser, fromUserIds)
}

type ConflictingUsers struct {
	Ids string `xorm:"ids"`
	// IDENTIFIER
	// userIdentifier = login + email
	UserIdentifier                string `xorm:"user_identification"`
	ConflictEmails                string `xorm:"conflicting_emails"`
	ConflictLogins                string `xorm:"conflicting_logins"`
	SameIdentificationConflictIds bool   `xorm:"same_identification_conflict_ids"`
}
type allConflictingUserAggregates []ConflictingUsers

func GetUsersWithConflictingEmailsOrLogins(ctx context.Context, s *sqlstore.SQLStore) (allConflictingUserAggregates, error) {
	var stats allConflictingUserAggregates
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

func conflictingUserEntriesSQL(s *sqlstore.SQLStore) string {
	userDialect := db.DB.GetDialect(s).Quote("user")
	// this query counts how many users have the same login or email.
	// which might be confusing, but gives a good indication
	// we want this query to not require too much cpu
	sqlQuery := `
	SELECT
	u1.login || u1.email AS user_identification,
	group_concat(u1.id, ',') AS ids,
	group_concat(u1.email, ',') AS conflicting_emails,
	group_concat(u1.login, ',') AS conflicting_logins,
	(
		SELECT
			u1.email
		FROM
			` + userDialect + `
		WHERE (LOWER(u1.email) = LOWER(u2.email))
		AND(u1.email != u2.email)) AS conflict_email, (
		SELECT
			u1.login
		FROM
			` + userDialect + `
		WHERE (LOWER(u1.login) = LOWER(u2.login)
			AND(u1.login != u2.login))) AS conflict_login, (
		SELECT
			u1.id
		FROM
			` + userDialect + `
		WHERE ((u1.login = u2.login)
			AND(u1.email = u2.email)
			AND(u1.id != u2.id))) AS same_identification_conflict_ids
	FROM
		 ` + userDialect + ` AS u1, ` + userDialect + ` AS u2
	WHERE (conflict_email IS NOT NULL
		OR conflict_login IS NOT NULL OR same_identification_conflict_ids IS NOT NULL)
GROUP BY
	LOWER(user_identification);
	`
	return sqlQuery
}
