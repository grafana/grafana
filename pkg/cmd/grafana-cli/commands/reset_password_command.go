package commands

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func resetPasswordCommand(c CommandLine) error {
	newPassword := c.Args().First()

	if len(newPassword) < 4 {
		return fmt.Errorf("New password too short")
	}

	userQuery := models.GetUserByIdQuery{Id: 1}

	if err := bus.Dispatch(&userQuery); err != nil {
		return fmt.Errorf("Could not read user from database. Error: %v", err)
	}

	passwordHashed := util.EncodePassword(newPassword, userQuery.Result.Salt)

	cmd := models.ChangeUserPasswordCommand{
		UserId:      1,
		NewPassword: passwordHashed,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return fmt.Errorf("Failed to update user password")
	}

	logger.Infof("Admin password changed successfully %s", color.GreenString("✔"))

	return nil
}
