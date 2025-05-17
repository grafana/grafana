package usermig

import (
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const (
	LowerCaseUserLoginAndEmail = "update login and email fields to lowercase"
)

// AddLowerCaseUserLoginAndEmail adds a migration that updates the login and email fields of all users to be in lower case.
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
	err := sess.Table("user").Asc("created").Find(&users)
	if err != nil {
		return err
	}
	processedLogins := make(map[string]bool)
	processedEmails := make(map[string]bool)

	for _, usr := range users {
		/*
			LOGIN
		*/
		lowerLogin := strings.ToLower(usr.Login)
		// only work through if login is not already in lower case
		if usr.Login != lowerLogin && !processedLogins[lowerLogin] {
			// Check if lower login exists
			existingLowerCasedUserLogin := &user.User{}

			// lowercaseexists in database
			hasLowerCasedLogin, err := sess.Table("user").Where("login = ?", lowerLogin).Get(existingLowerCasedUserLogin)
			if err != nil {
				return err
			}

			// If exact login does not exist and lower case login does not exist, update the user's login to be in lower case
			if !hasLowerCasedLogin {
				uLogin := user.User{
					Name:  usr.Name,
					Login: lowerLogin,
				}
				_, err := sess.ID(usr.ID).Update(&uLogin)
				if err != nil {
					return err
				}
			}
		}
		processedLogins[lowerLogin] = true

		/*
			EMAIL
		*/
		lowerEmail := strings.ToLower(usr.Email)
		// only work through if email is not already in lower case
		if usr.Email != lowerEmail && !processedEmails[lowerEmail] {
			// Check if lower case email exists
			existingUserEmail := &user.User{}
			hasLowerCasedEmail, err := sess.Table("user").Where("email = ?", lowerEmail).Get(existingUserEmail)
			if err != nil {
				return err
			}
			// If lower case email does not exist, update the user's email to be in lower case
			if !hasLowerCasedEmail {
				uEmail := user.User{
					Name:  usr.Name,
					Email: lowerEmail,
				}
				_, err := sess.ID(usr.ID).Update(&uEmail)
				if err != nil {
					return err
				}
			}
		}
		processedEmails[lowerEmail] = true
	}
	return nil
}
