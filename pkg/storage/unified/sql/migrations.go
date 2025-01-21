package sql

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// This runs functions before the server is returned as healthy
func (b *backend) runStartupDataMigrations(ctx context.Context) error {
	if b.skipDataMigration {
		return nil
	}

	type migrateRow struct {
		GUID       string
		Marker     *unstructured.Unstructured
		Group      string
		Resource   string
		PreviousRV int64
	}

	// Migrate DeletedMarker to regular resource
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		req := &sqlMigrationQueryRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			MarkerQuery: `{"kind":"DeletedMarker"%`,
		}

		// 1. Find rows with the existing deletion marker
		rows, err := dbutil.QueryRows(ctx, tx, sqlMigratorGetDeletionMarkers, req)
		if err != nil {
			return err
		}
		migrateRows := make([]migrateRow, 0)
		for rows.Next() {
			item := migrateRow{Marker: &unstructured.Unstructured{}}
			err = rows.Scan(&item.GUID, &req.Value, &item.Group, &item.Resource, &item.PreviousRV)
			if err != nil {
				return err
			}

			err = item.Marker.UnmarshalJSON([]byte(req.Value))
			if err != nil {
				return err
			}

			migrateRows = append(migrateRows, item)
		}
		err = rows.Close()
		if err != nil {
			return err
		}

		for _, item := range migrateRows {
			// 2. Load the previous value referenced by that marker
			req := &sqlMigrationQueryRequest{
				SQLTemplate: sqltemplate.New(b.dialect),
				Group:       item.Group,
				Resource:    item.Resource,
				RV:          item.PreviousRV,
				GUID:        item.GUID,
			}
			rows, err = dbutil.QueryRows(ctx, tx, sqlMigratorGetValueFromRV, req)
			if err != nil {
				return err
			}
			if rows.Next() {
				err = rows.Scan(&req.Value)
				if err != nil {
					return err
				}
			}
			err = rows.Close()
			if err != nil {
				return err
			}
			req.Reset()

			if len(req.Value) > 0 {
				previous := &unstructured.Unstructured{}
				err = previous.UnmarshalJSON([]byte(req.Value))
				if err != nil {
					return err
				}

				// 3. Prepare a new payload
				metaMarker, _ := utils.MetaAccessor(item.Marker)
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
				req.Value = string(buff)

				// 4. Update the SQL row with this new value
				b.log.Info("Migrating DeletedMarker", "guid", req.GUID, "group", req.Group, "resource", req.Resource)
				_, err = dbutil.Exec(ctx, tx, sqlMigratorUpdateValueWithGUID, req)
				if err != nil {
					return err
				}
			} else {
				// 5. If the previous version is missing, we delete it -- there is nothing to help us restore anyway
				b.log.Warn("Removing orphan deletion marker", "guid", req.GUID, "group", req.Group, "resource", req.Resource)
				_, err = dbutil.Exec(ctx, tx, sqlResourceHistoryDelete, &sqlResourceHistoryDeleteRequest{
					SQLTemplate: sqltemplate.New(b.dialect),
					GUID:        req.GUID,
					Namespace:   item.Marker.GetNamespace(),
				})
				if err != nil {
					return err
				}
			}
		}

		return nil
	})

	return err
}
