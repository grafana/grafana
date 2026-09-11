package commands

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
)

// logLastMigration reports the most recent migration_log row. Migrations
// themselves are run inside runDbCommand via server.InitializeForCLI.
func logLastMigration(c utils.CommandLine, cfg *setting.Cfg, sqlStore db.DB) error {
	last, err := lastMigration(sqlStore)
	if err != nil {
		return err
	}
	if last != nil {
		logger.Infof("Last migration: %s (at %s)\n", last.MigrationID, last.Timestamp.UTC().Format(time.RFC3339))
	}
	return nil
}

type migrationLogRow struct {
	MigrationID string    `xorm:"migration_id"`
	Timestamp   time.Time `xorm:"timestamp"`
}

func lastMigration(sqlStore db.DB) (*migrationLogRow, error) {
	var (
		row migrationLogRow
		has bool
	)
	err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		var sErr error
		has, sErr = sess.Table("migration_log").
			Where("success = ?", sqlStore.GetDialect().BooleanValue(true)).
			OrderBy("timestamp DESC, id DESC").
			Limit(1).
			Get(&row)
		return sErr
	})
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, nil
	}
	return &row, nil
}
