package sql

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	_ resource.BulkProcessingBackend = (*backend)(nil)
)

func (b *backend) ProcessBulk(ctx context.Context, setting resource.BulkSettings, iter resource.BulkRequestIterator) *resourcepb.BulkResponse {
	err := b.bulkLock.Start(setting.Collection)
	if err != nil {
		return &resourcepb.BulkResponse{
			Error: resource.AsErrorResult(err),
		}
	}
	defer b.bulkLock.Finish(setting.Collection)

	// We may want to first write parquet, then read parquet
	if b.dialect.DialectName() == "sqlite" {
		file, err := os.CreateTemp("", "grafana-bulk-export-*.parquet")
		if err != nil {
			return &resourcepb.BulkResponse{
				Error: resource.AsErrorResult(err),
			}
		}

		writer, err := parquet.NewParquetWriter(file)
		if err != nil {
			return &resourcepb.BulkResponse{
				Error: resource.AsErrorResult(err),
			}
		}

		// write bulk to parquet
		rsp := writer.ProcessBulk(ctx, setting, iter)
		if rsp.Error != nil {
			return rsp
		}

		b.log.Info("using parquet buffer", "parquet", file)

		// Replace the iterator with one from parquet
		iter, err = parquet.NewParquetReader(file.Name(), 50)
		if err != nil {
			return &resourcepb.BulkResponse{
				Error: resource.AsErrorResult(err),
			}
		}
	}

	return b.processBulk(ctx, setting, iter)
}

// internal bulk process
func (b *backend) processBulk(ctx context.Context, setting resource.BulkSettings, iter resource.BulkRequestIterator) *resourcepb.BulkResponse {
	rsp := &resourcepb.BulkResponse{}
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		rollbackWithError := func(err error) error {
			txerr := tx.Rollback()
			if txerr != nil {
				b.log.Warn("rollback", "error", txerr)
			} else {
				b.log.Info("rollback")
			}
			return err
		}
		bulk := &bulkWroker{
			ctx:     ctx,
			tx:      tx,
			dialect: b.dialect,
			logger:  logging.FromContext(ctx),
		}

		// Calculate the RV based on incoming request timestamps
		rv := resource.NewBulkRV()

		summaries := make(map[string]*resourcepb.BulkResponse_Summary, len(setting.Collection))

		// First clear everything in the transaction
		if setting.RebuildCollection {
			for _, key := range setting.Collection {
				summary, err := bulk.deleteCollection(key)
				if err != nil {
					return rollbackWithError(err)
				}
				summaries[resource.NSGR(key)] = summary
				rsp.Summary = append(rsp.Summary, summary)
			}
		} else {
			for _, key := range setting.Collection {
				summaries[resource.NSGR(key)] = &resourcepb.BulkResponse_Summary{
					Namespace: key.Namespace,
					Group:     key.Group,
					Resource:  key.Resource,
				}
			}
		}

		obj := &unstructured.Unstructured{}

		// Write each event into the history
		for iter.Next() {
			if iter.RollbackRequested() {
				return rollbackWithError(nil)
			}
			req := iter.Request()
			if req == nil {
				return rollbackWithError(fmt.Errorf("missing request"))
			}
			rsp.Processed++

			if req.Action == resourcepb.BulkRequest_UNKNOWN {
				rsp.Rejected = append(rsp.Rejected, &resourcepb.BulkResponse_Rejected{
					Key:    req.Key,
					Action: req.Action,
					Error:  "unknown action",
				})
				continue
			}

			err := obj.UnmarshalJSON(req.Value)
			if err != nil {
				rsp.Rejected = append(rsp.Rejected, &resourcepb.BulkResponse_Rejected{
					Key:    req.Key,
					Action: req.Action,
					Error:  "unable to unmarshal json",
				})
				continue
			}

			// Write the event to history
			if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
				SQLTemplate: sqltemplate.New(b.dialect),
				WriteEvent: resource.WriteEvent{
					Key:        req.Key,
					Type:       resourcepb.WatchEvent_Type(req.Action),
					Value:      req.Value,
					PreviousRV: -1, // Used for WATCH, but we want to skip watch events
				},
				Folder:          req.Folder,
				GUID:            uuid.New().String(),
				ResourceVersion: rv.Next(obj),
			}); err != nil {
				return rollbackWithError(fmt.Errorf("insert into resource history: %w", err))
			}
		}

		// Now update the resource table from history
		for _, key := range setting.Collection {
			k := fmt.Sprintf("%s/%s/%s", key.Namespace, key.Group, key.Resource)
			summary := summaries[k]
			if summary == nil {
				return rollbackWithError(fmt.Errorf("missing summary key for: %s", k))
			}

			err := bulk.syncCollection(key, summary)
			if err != nil {
				return err
			}

			// Make sure the collection RV is above our last written event
			_, err = b.rvManager.ExecWithRV(ctx, key, func(tx db.Tx) (string, error) {
				return "", nil
			})
			if err != nil {
				b.log.Warn("error increasing RV", "error", err)
			}

			// Update the last import time. This is important to trigger reindexing
			// of the resource for a given namespace.
			if err := b.updateLastImportTime(ctx, tx, key, time.Now()); err != nil {
				return rollbackWithError(err)
			}
		}
		return nil
	})
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
	}
	return rsp
}

func (b *backend) updateLastImportTime(ctx context.Context, tx db.Tx, key *resourcepb.ResourceKey, now time.Time) error {
	if _, err := dbutil.Exec(ctx, tx, sqlResourceLastImportTimeInsert, sqlResourceLastImportTimeInsertRequest{
		SQLTemplate:    sqltemplate.New(b.dialect),
		Namespace:      key.Namespace,
		Group:          key.Group,
		Resource:       key.Resource,
		LastImportTime: now.UTC(),
	}); err != nil {
		return fmt.Errorf("insert resource last import time: %w", err)
	}
	return nil
}

type bulkWroker struct {
	ctx     context.Context
	tx      db.ContextExecer
	dialect sqltemplate.Dialect
	logger  logging.Logger
}

// This will remove everything from the `resource` and `resource_history` table for a given namespace/group/resource
func (w *bulkWroker) deleteCollection(key *resourcepb.ResourceKey) (*resourcepb.BulkResponse_Summary, error) {
	summary := &resourcepb.BulkResponse_Summary{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}

	// First delete history
	res, err := dbutil.Exec(w.ctx, w.tx, sqlResourceHistoryDelete, &sqlResourceHistoryDeleteRequest{
		SQLTemplate: sqltemplate.New(w.dialect),
		Namespace:   key.Namespace,
		Group:       key.Group,
		Resource:    key.Resource,
	})
	if err != nil {
		return nil, err
	}

	summary.PreviousHistory, err = res.RowsAffected()
	if err != nil {
		return nil, err
	}

	// Next delete the active resource table
	res, err = dbutil.Exec(w.ctx, w.tx, sqlResourceDelete, &sqlResourceRequest{
		SQLTemplate: sqltemplate.New(w.dialect),
		WriteEvent: resource.WriteEvent{
			Key: key,
		},
	})
	if err != nil {
		return nil, err
	}
	summary.PreviousCount, err = res.RowsAffected()
	return summary, err
}

// Copy the latest value from history into the active resource table
func (w *bulkWroker) syncCollection(key *resourcepb.ResourceKey, summary *resourcepb.BulkResponse_Summary) error {
	w.logger.Info("synchronize collection", "key", resource.NSGR(key))
	_, err := dbutil.Exec(w.ctx, w.tx, sqlResourceInsertFromHistory, &sqlResourceInsertFromHistoryRequest{
		SQLTemplate: sqltemplate.New(w.dialect),
		Key:         key,
	})
	if err != nil {
		return err
	}

	w.logger.Info("get stats (still in transaction)", "key", resource.NSGR(key))
	rows, err := dbutil.QueryRows(w.ctx, w.tx, sqlResourceStats, &sqlStatsRequest{
		SQLTemplate: sqltemplate.New(w.dialect),
		Namespace:   key.Namespace,
		Group:       key.Group,
		Resource:    key.Resource,
	})
	if err != nil {
		return err
	}
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if rows.Next() {
		row := resource.ResourceStats{}
		return rows.Scan(&row.Namespace, &row.Group, &row.Resource,
			&summary.Count,
			&summary.ResourceVersion)
	}
	return err
}
