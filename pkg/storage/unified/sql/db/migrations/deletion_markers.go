package migrations

import (
	"context"
	"database/sql"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	migrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
)

type deletionMarkerMigrator struct {
	migrator.MigrationBase
}

func (m *deletionMarkerMigrator) SQL(dialect migrator.Dialect) string {
	return `Find rows in resource_history with value LIKE {"kind":"DeletedMarker"%`
}

func (m *deletionMarkerMigrator) Exec(ctx context.Context, queryer migrator.Queryer, mg *migrator.Migrator) error {
	logger := log.New("deletion-marker-migrator")
	type model struct {
		GUID       string
		Value      string
		Group      string
		Resource   string
		PreviousRV string
	}

	logger.Info("finding any deletion markers")
	query := fmt.Sprintf(
		`SELECT %s, %s, %s, %s, %s FROM resource_history WHERE action = 3 AND value LIKE '%s'`,
		mg.Dialect.Quote("guid"),
		mg.Dialect.Quote("value"),
		mg.Dialect.Quote("group"),
		mg.Dialect.Quote("resource"),
		mg.Dialect.Quote("previous_resource_version"),
		`{"kind":"DeletedMarker"%`,
	)
	rows, err := queryer.QueryContext(ctx, query)
	if err != nil {
		return err
	}
	defer func() { _ = rows.Close() }()

	models := make([]model, 0)
	for rows.Next() {
		row := model{}
		if err := rows.Scan(&row.GUID, &row.Value, &row.Group, &row.Resource, &row.PreviousRV); err != nil {
			return err
		}
		models = append(models, row)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	if len(models) > 0 {
		logger.Info("updating markers with a real resource", "count", len(models))
		for _, row := range models {
			tmp := &model{}
			prevQuery := fmt.Sprintf(
				`SELECT %s FROM resource_history WHERE %s = '%s' AND %s = '%s' AND resource_version = %s LIMIT 1`,
				mg.Dialect.Quote("value"),
				mg.Dialect.Quote("group"),
				escapeSQLString(row.Group),
				mg.Dialect.Quote("resource"),
				escapeSQLString(row.Resource),
				row.PreviousRV,
			)
			err := queryer.QueryRowContext(ctx, prevQuery).Scan(&tmp.Value)
			if err != nil && err != sql.ErrNoRows {
				return err
			}
			if err == nil && len(tmp.Value) > 1 {
				previous := &unstructured.Unstructured{}
				err = previous.UnmarshalJSON([]byte(tmp.Value))
				if err != nil {
					return err
				}

				marker := &unstructured.Unstructured{}
				err = marker.UnmarshalJSON([]byte(row.Value))
				if err != nil {
					return err
				}

				// 3. Prepare a new payload
				metaMarker, _ := utils.MetaAccessor(marker)
				metaPrev, _ := utils.MetaAccessor(previous)
				metaPrev.SetDeletionTimestamp(metaMarker.GetDeletionTimestamp())
				metaPrev.SetFinalizers(nil)
				metaPrev.SetManagedFields(nil)
				metaPrev.SetGeneration(utils.DeletedGeneration)
				metaPrev.SetAnnotation(utils.AnnoKeyKubectlLastAppliedConfig, "") // clears it
				ts, _ := metaMarker.GetUpdatedTimestamp()
				if ts != nil {
					metaPrev.SetUpdatedTimestamp(ts)
				}
				buff, err := previous.MarshalJSON()
				if err != nil {
					return err
				}

				updateQuery := fmt.Sprintf(
					`UPDATE resource_history SET %s = '%s' WHERE %s = '%s'`,
					mg.Dialect.Quote("value"),
					escapeSQLString(string(buff)),
					mg.Dialect.Quote("guid"),
					escapeSQLString(row.GUID),
				)
				result, err := queryer.ExecContext(ctx, updateQuery)
				if err != nil {
					return err
				}
				count, err := result.RowsAffected()
				if count == 1 {
					logger.Info("Updated", "GUID", row.GUID)
				} else {
					return fmt.Errorf("error updating")
				}
			} else {
				deleteQuery := fmt.Sprintf(
					`DELETE FROM resource_history WHERE %s = '%s'`,
					mg.Dialect.Quote("guid"),
					escapeSQLString(row.GUID),
				)
				if _, err := queryer.ExecContext(ctx, deleteQuery); err != nil {
					return err
				}
				logger.Info("Removed", "GUID", row.GUID)
			}
		}
	}
	return nil
}
