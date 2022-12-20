package commands

import (
	"bufio"
	"context"
	"fmt"
	"os"

	"github.com/fatih/color"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/runner"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

const DefaultAdminUserId = 1

func resetPasswordCommand(c utils.CommandLine, runner runner.Runner) error {
	newPassword := ""
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
		newPassword = scanner.Text()
	} else {
		newPassword = c.Args().First()
	}

	password := models.Password(newPassword)
	if password.IsWeak() {
		return fmt.Errorf("new password is too short")
	}

	userQuery := user.GetUserByIDQuery{ID: adminId}
	usr, err := runner.UserService.GetByID(context.Background(), &userQuery)
	if err != nil {
		return fmt.Errorf("could not read user from database. Error: %v", err)
	}
	if !usr.IsAdmin {
		return fmt.Errorf("reset-admin-password can only be used to reset an admin user account")
	}

	passwordHashed, err := util.EncodePassword(newPassword, usr.Salt)
	if err != nil {
		return err
	}

	cmd := user.ChangeUserPasswordCommand{
		UserID:      adminId,
		NewPassword: passwordHashed,
	}

	if err := runner.UserService.ChangePassword(context.Background(), &cmd); err != nil {
		return fmt.Errorf("failed to update user password: %w", err)
	}

	logger.Infof("\n")
	logger.Infof("Admin password changed successfully %s", color.GreenString("✔"))

	return nil
}
