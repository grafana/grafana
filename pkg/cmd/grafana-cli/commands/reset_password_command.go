package commands

import (
	"fmt"

	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

const AdminUserId = 1

func resetPasswordCommand(c utils.CommandLine, sqlStore *sqlstore.SqlStore) error {
	newPassword := c.Args().First()

	password := models.Password(newPassword)
	if password.IsWeak() {
		return fmt.Errorf("new password is too short")
	}

	userQuery := models.GetUserByIdQuery{Id: AdminUserId}

	if err := bus.Dispatch(&userQuery); err != nil {
		return fmt.Errorf("could not read user from database. Error: %v", err)
	}

	passwordHashed, err := util.EncodePassword(newPassword, userQuery.Result.Salt)
	if err != nil {
		return err
	}

	cmd := models.ChangeUserPasswordCommand{
		UserId:      AdminUserId,
		NewPassword: passwordHashed,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return errutil.Wrapf(err, "failed to update user password")
	}

	logger.Infof("\n")
	logger.Infof("Admin password changed successfully %s", color.GreenString("✔"))

	return nil
}
