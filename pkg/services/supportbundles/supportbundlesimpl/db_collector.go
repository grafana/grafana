package supportbundlesimpl

import (
	"bytes"
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/supportbundles"
)

func dbCollector(sql db.DB) supportbundles.Collector {
	collectorFn := func(ctx context.Context) (*supportbundles.SupportItem, error) {
		dbType := string(sql.GetDBType())

		// buffer writer
		bWriter := bytes.NewBuffer(nil)

		bWriter.WriteString("# Database information\n\n")
		bWriter.WriteString("dbType: " + dbType + "  \n")

		logItems := make([]migrator.MigrationLog, 0)
		version := []string{}
		err := sql.WithDbSession(ctx, func(sess *db.Session) error {
			rawSQL := ""
			if dbType == migrator.MySQL {
				rawSQL = "SELECT @@VERSION"
			} else if dbType == migrator.Postgres {
				rawSQL = "SELECT version()"
			} else if dbType == migrator.SQLite {
				rawSQL = "SELECT sqlite_version()"
			} else {
				return fmt.Errorf("unsupported dbType: %s", dbType)
			}

			return sess.Table("migration_log").SQL(rawSQL).Find(&version)
		})
		if err != nil {
			return nil, err
		}

		for _, v := range version {
			bWriter.WriteString("version: " + v + "  \n")
		}

		errD := sql.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.Table("migration_log").Find(&logItems)
		})
		if errD != nil {
			return nil, err
		}

		bWriter.WriteString("\n## Migration Log\n\n")

		for _, logItem := range logItems {
			bWriter.WriteString(fmt.Sprintf("**migrationId**: %s  \nsuccess: %t  \nerror: %s  \ntimestamp: %s\n\n",
				logItem.MigrationID, logItem.Success, logItem.Error, logItem.Timestamp.UTC()))
		}

		return &supportbundles.SupportItem{
			Filename:  "db.md",
			FileBytes: bWriter.Bytes(),
		}, nil
	}

	return supportbundles.Collector{
		UID:               "db",
		Description:       "Database information and migration log",
		DisplayName:       "Database and migration information",
		IncludedByDefault: false,
		Default:           true,
		Fn:                collectorFn,
	}
}
