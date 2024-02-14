package commands

import (
	"bufio"
	"context"
	"fmt"
	"os"

	"github.com/fatih/color"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

const DefaultAdminUserId = 1

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
	return err
}

func resetPassword(adminId int64, newPassword user.Password, userSvc user.Service) error {
	userQuery := user.GetUserByIDQuery{ID: adminId}
	usr, err := userSvc.GetByID(context.Background(), &userQuery)
	if err != nil {
		return fmt.Errorf("could not read user from database. Error: %v", err)
	}
	if !usr.IsAdmin {
		return ErrMustBeAdmin
	}

	passwordHashed, err := util.EncodePassword(string(newPassword), usr.Salt)
	if err != nil {
		return err
	}

	cmd := user.ChangeUserPasswordCommand{
		UserID:      adminId,
		NewPassword: user.Password(passwordHashed),
	}

	if err := userSvc.ChangePassword(context.Background(), &cmd); err != nil {
		return fmt.Errorf("failed to update user password: %w", err)
	}

	return nil
}

var ErrMustBeAdmin = fmt.Errorf("reset-admin-password can only be used to reset an admin user account")
