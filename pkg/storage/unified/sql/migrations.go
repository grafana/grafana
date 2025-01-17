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
func (b *backend) runStartupMigrations(ctx context.Context) error {
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

		migrateItems := make([]sqlMigrationQueryRequest, 0)
		for rows.Next() {
			err = rows.Scan(&req.GUID, &req.Value, &req.Group, &req.Resource, &req.RV)
			if err != nil {
				return err
			}
			migrateItems = append(migrateItems, *req)
			req.Reset()
		}
		rows.Close()

		for _, req := range migrateItems {
			// 2. Load the previous value referenced by that marker
			req.Reset()
			find, err := dbutil.QueryRows(ctx, tx, sqlMigratorGetValueFromRV, req)
			if err != nil {
				return err
			}
			if find.Next() {
				marker := &unstructured.Unstructured{}
				err = marker.UnmarshalJSON([]byte(req.Value))
				if err != nil {
					return err
				}

				err = find.Scan(&req.Value)
				if err != nil {
					return err
				}
				find.Close()
				previous := &unstructured.Unstructured{}
				err = previous.UnmarshalJSON([]byte(req.Value))
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
				metaPrev.SetAnnotation("kubectl.kubernetes.io/last-applied-configuration", "") // clears it
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
				req.Reset()
				b.log.Info("Migrating DeletedMarker", "guid", req.GUID, "group", req.Group, "resource", req.Resource)
				_, err = dbutil.Exec(ctx, tx, sqlMigratorUpdateValueWithGUID, req)
				if err != nil {
					return err
				}
			} else {
				find.Close()
				// 5. If the previous version is missing, we delete it -- there is nothing to help us restore anyway
				b.log.Warn("Removing orphan deletion marker", "guid", req.GUID, "group", req.Group, "resource", req.Resource)
				_, err = dbutil.Exec(ctx, tx, sqlResourceHistoryDelete, &sqlResourceHistoryDeleteRequest{
					SQLTemplate: sqltemplate.New(b.dialect),
					GUID:        req.GUID,
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
