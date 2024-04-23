package usermig

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"xorm.io/xorm"
)

const (
	LowerCaseUserLoginAndEmail = "update login and email fields to lowercase"
)

// Service accounts login were not unique per org. this migration is part of making it unique per org
// to be able to create service accounts that are unique per org
func AddLowerCaseUserLoginAndEmail(mg *migrator.Migrator) {
	mg.AddMigration(LowerCaseUserLoginAndEmail, &UsersLowerCaseLoginAndEmail{})
}

var _ migrator.CodeMigration = new(UsersLowerCaseLoginAndEmail)

type UsersLowerCaseLoginAndEmail struct {
	migrator.MigrationBase
}

func (p *UsersLowerCaseLoginAndEmail) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (p *UsersLowerCaseLoginAndEmail) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	// Get all users
	users := make([]*user.User, 0)
	err := sess.Table("user").Find(&users)
	if err != nil {
		return err
	}

	// Map to track processed logins
	processedLogins := make(map[string]bool)

	for _, usr := range users {
		// If login has been processed before, skip this user
		if processedLogins[usr.Login] {
			continue
		}
		lowerLogin := strings.ToLower(usr.Login)

		// Check if lower login exists
		existingLowerCasedUserLogin := &user.User{}

		// lowercaseexists in database
		hasLowerCasedLogin, err := sess.Table("user").Where("login = ?", lowerLogin).Get(existingLowerCasedUserLogin)
		if err != nil {
			return err
		}

		// If exact login does not exist and lower case login does not exist, update the user's login to be in lower case
		if !hasLowerCasedLogin {
			fmt.Printf("updating user login %s: %s\n", usr.Login, err)
			uLogin := user.User{
				Name:  usr.Name,
				Login: lowerLogin,
			}
			_, err := sess.ID(usr.ID).Update(&uLogin)
			if err != nil {
				return err
			}
		}

		// Check if lower case email exists
		existingUserEmail := &user.User{}
		hasLowerCasedEmail, err := sess.Table("user").Where("email = ?", strings.ToLower(usr.Email)).Get(existingUserEmail)
		if err != nil {
			return err
		}
		// If lower case email does not exist, update the user's email to be in lower case
		if !hasLowerCasedEmail {
			uEmail := user.User{
				Name:  usr.Name,
				Email: strings.ToLower(usr.Email),
			}
			_, err := sess.ID(usr.ID).Update(&uEmail)
			if err != nil {
				fmt.Printf("Error updating email for user email %s: %s\n", usr.Email, err)
				return err
			}
		}

		// Mark this login as processed
		processedLogins[usr.Login] = true
	}
	return nil
}
