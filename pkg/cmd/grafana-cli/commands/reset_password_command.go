package commands

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/fatih/color"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/user"
)

const DefaultAdminUserId = 1

var (
	ErrMustBeAdmin        = fmt.Errorf("reset-admin-password can only be used to reset an admin user account")
	ErrAdminCannotBeFound = errors.New("admin user cannot be found")
)

func resetPasswordCommand(c utils.CommandLine, runner server.Runner) error {
	var newPassword user.Password
	adminId := int64(c.Int("user-id"))

	if c.Bool("password-from-stdin") {
		logger.Infof("New Password: ")

		scanner := bufio.NewScanner(os.Stdin)
		if ok := scanner.Scan(); !ok {
			if err := scanner.Err(); err != nil {
				return fmt.Errorf("can't read password from stdin: %w", err)
			}
			return fmt.Errorf("can't read password from stdin")
		}
		newPassword = user.Password(scanner.Text())
	} else {
		newPassword = user.Password(c.Args().First())
	}

	if err := newPassword.Validate(runner.Cfg); err != nil {
		return fmt.Errorf("the new password doesn't meet the password policy criteria")
	}

	err := resetPassword(adminId, newPassword, runner.UserService)
	if err == nil {
		logger.Infof("\n")
		logger.Infof("Admin password changed successfully %s", color.GreenString("✔"))
	}

	if errors.Is(err, ErrAdminCannotBeFound) {
		logger.Infof("\n")
		logger.Infof("Admin user cannot be found %s. \n", color.RedString("✘"))
		admins, err := listAdminUsers(runner.UserService)
		if err != nil {
			return fmt.Errorf("failed to list admin users: %w", err)
		}

		logger.Infof("\n")
		logger.Infof("Please try to run the command again specifying a user-id (--user-id) from the list below:\n")
		for _, u := range admins {
			logger.Infof("\t Username: %s ID: %d\n", u.Login, u.ID)
		}
	}

	return nil
}

func resetPassword(adminId int64, password user.Password, userSvc user.Service) error {
	userQuery := user.GetUserByIDQuery{ID: adminId}
	usr, err := userSvc.GetByID(context.Background(), &userQuery)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return ErrAdminCannotBeFound
		}
		return fmt.Errorf("could not read user from database. Error: %v", err)
	}

	if !usr.IsAdmin {
		return ErrMustBeAdmin
	}

	if err := userSvc.Update(context.Background(), &user.UpdateUserCommand{UserID: adminId, Password: &password}); err != nil {
		return fmt.Errorf("failed to update user password: %w", err)
	}

	return nil
}

func listAdminUsers(userSvc user.Service) ([]*user.UserSearchHitDTO, error) {
	searchAdminsQuery := user.SearchUsersQuery{
		Filters: []user.Filter{&adminFilter{}},
		SignedInUser: &user.SignedInUser{
			Permissions: map[int64]map[string][]string{0: {"users:read": {"global.users:*"}}},
		},
	}

	admins, err := userSvc.Search(context.Background(), &searchAdminsQuery)
	if err != nil {
		return nil, fmt.Errorf("could not read user from database. Error: %v", err)
	}

	return admins.Users, nil
}

type adminFilter struct{}

func (f *adminFilter) WhereCondition() *user.WhereCondition {
	return &user.WhereCondition{
		Condition: "is_admin = 1",
	}
}

func (f *adminFilter) JoinCondition() *user.JoinCondition {
	return nil
}

func (f *adminFilter) InCondition() *user.InCondition {
	return nil
}
