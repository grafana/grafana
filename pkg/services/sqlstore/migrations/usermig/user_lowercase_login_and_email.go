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

	// Iterate over users
	for _, usr := range users {
		// Check if lower case login exists
		existingUser := &user.User{}
		has, err := sess.Table("user").Where("login = ?", strings.ToLower(usr.Login)).Get(existingUser)
		if err != nil {
			return err
		}
		// If lower case login does not exist, update the user's login to be in lower case
		if !has {
			uLogin := user.User{
				Name:  usr.Name,
				Login: strings.ToLower(usr.Login),
			}
			_, err := sess.ID(usr.ID).Update(&uLogin)
			if err != nil {
				fmt.Printf("Error updating login for user login %s: %s\n", usr.Login, err)
				return err
			}
		}
		// Check if lower case email exists
		existingUserEmail := &user.User{}
		has, err = sess.Table("user").Where("email = ?", strings.ToLower(usr.Email)).Get(existingUserEmail)
		if err != nil {
			return err
		}
		// If lower case email does not exist, update the user's email to be in lower case
		if !has {
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
	}
	return nil
}
