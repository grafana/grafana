package commands

import (
	"context"
	"fmt"

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
	// present all users
	showUsers()

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

		users, err := GetUsersWithConflictingEmailsOrLogins(context.Context, sqlStore)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to get users with conflicting logins", err)
		}

		if len(users) < 1 {
			logger.Info(color.GreenString("No Conflicting users found.\n\n"))
			return nil
		}
		// present all users
		showUsers()

		for _, u := range users {
			logger.Infof("id: %v version: %s\n", u.UserIdentifier, u.Ids)
		}

		return nil
	}
}

func showUsers() {
	// TODO: present users elegantly :D
	logger.Info(color.GreenString("users here"))
}

type conflictUser struct {
	Ids string `xorm:"ids"`
	// IDENTIFIER
	// userIdentifier = login + email
	UserIdentifier string `xorm:"user_identification"`
	ConflictEmails string `xorm:"conflicting_emails"`
	ConflictLogins string `xorm:"conflicting_logins"`
}
type conflictUsers []conflictUser

func GetUsersWithConflictingEmailsOrLogins(ctx context.Context, s *sqlstore.SQLStore) (conflictUsers, error) {
	var stats conflictUsers
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
		AND(u1.email != u2.email)) AS dup_email, (
		SELECT
			u1.login
		FROM
			` + userDialect + `
		WHERE (LOWER(u1.login) = LOWER(u2.login)
			AND(u1.login != u2.login))) AS dup_login, (
		SELECT
			u1.id
		FROM
			` + userDialect + `
		WHERE ((u1.login = u2.login)
			AND(u1.email = u2.email)
			AND(u1.id != u2.id))) AS dup_ids
	FROM
		 ` + userDialect + ` AS u1, ` + userDialect + ` AS u2
	WHERE (dup_email IS NOT NULL
		OR dup_login IS NOT NULL OR dup_ids IS NOT NULL)
GROUP BY
	LOWER(user_identification);
	`
	return sqlQuery
}
