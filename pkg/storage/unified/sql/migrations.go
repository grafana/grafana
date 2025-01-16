package sql

import (
	"context"
	"fmt"

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

		rows, err := dbutil.QueryRows(ctx, tx, sqlMigratorGetDeletionMarkers, req)
		if err != nil {
			return err
		}
		for rows.Next() {
			err = rows.Scan(&req.GUID, &req.Value, &req.Group, &req.Resource, &req.RV)
			if err != nil {
				return err
			}

			marker := &unstructured.Unstructured{}
			err = marker.UnmarshalJSON([]byte(req.Value))
			if err != nil {
				return err
			}

			req.Reset()
			find, err := dbutil.QueryRows(ctx, tx, sqlMigratorGetValueFromRV, req)
			if err != nil {
				return err
			}
			if find.Next() {
				err = find.Scan(&req.GUID, &req.Value)
				previous := &unstructured.Unstructured{}
				err = previous.UnmarshalJSON([]byte(req.Value))
				if err != nil {
					return err
				}

				metaMarker, _ := utils.MetaAccessor(marker)
				metaPrev, _ := utils.MetaAccessor(previous)
				metaPrev.SetDeletionTimestamp(metaMarker.GetDeletionTimestamp())
				metaPrev.SetFinalizers(nil)
				metaPrev.SetManagedFields(nil)
				metaPrev.SetGeneration(-1)
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

				fmt.Printf("TODO: %s/%d => %s\n", req.GUID, req.RV, req.Value)
				req.Reset()
			} else {
				// DELETE values that do not match the previous?
				fmt.Printf("????? %s\n", req.GUID)
			}
		}

		return nil
	})

	return err
}
