package commands

import (
	"context"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
)

func flushSeedAssignment(c utils.CommandLine, cfg *setting.Cfg, sqlStore db.DB) error {
	return sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		exists, err := sess.IsTableExist("seed_assignment")
		if err != nil {
			return err
		}
		if !exists {
			logger.Infof("seed_assignment table does not exist, skipping.")
			return nil
		}

		result, err := sess.Exec("DELETE FROM seed_assignment")
		if err != nil {
			return err
		}

		rowsAffected, _ := result.RowsAffected()
		logger.Infof("Flushed seed_assignment table (%d rows deleted).", rowsAffected)
		logger.Info("Restart Grafana to repopulate this table on next startup with the default RBAC assignments.")
		return nil
	})
}
