package sql

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	_ resource.BatchProcessingBackend = (*backend)(nil)
)

func (b *backend) ProcessBatch(ctx context.Context, setting resource.BatchSettings, iter resource.BatchRequestIterator) (*resource.BatchResponse, error) {
	rsp := &resource.BatchResponse{}
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
		batch := &batchWroker{
			ctx:     ctx,
			tx:      tx,
			dialect: b.dialect,
		}

		// Use the max RV from all resources
		// We are in a transaction so as long as the individual values increase we are set
		rv := int64(0)

		summaries := make(map[string]*resource.BatchResponse_Summary, len(setting.Collection)*4)

		// First clear everything in the transaction
		if setting.RebuildCollection {
			for _, key := range setting.Collection {
				summary, err := batch.deleteCollection(key)
				if err != nil {
					return rollbackWithError(err)
				}
				k := fmt.Sprintf("%s/%s/%s", key.Namespace, key.Group, key.Resource)
				summaries[k] = summary
				rsp.Summary = append(rsp.Summary, summary)

				// get the RV for this resource
				tmp, err := b.resourceVersionAtomicInc(ctx, tx, key)
				if err != nil {
					return rollbackWithError(fmt.Errorf("increment resource version: %w", err))
				}
				if tmp > rv {
					rv = tmp
				}
			}
		}
		if rv < 100 {
			return rollbackWithError(fmt.Errorf("expected resource version to be set"))
		}

		// Write each event into the history
		for iter.Next() {
			if iter.RollbackRequested() {
				return rollbackWithError(nil)
			}
			req := iter.Request()
			if req == nil {
				return rollbackWithError(fmt.Errorf("missing request"))
			}

			if req.Action == resource.BatchRequest_UNKNOWN {
				return rollbackWithError(fmt.Errorf("unknown action"))
			}
			rv++ // Increment the resource version
			rsp.Processed++
			eventType := resource.WatchEvent_Type(req.Action)

			// Write the event to history
			if _, err := dbutil.Exec(ctx, tx, sqlResourceHistoryInsert, sqlResourceRequest{
				SQLTemplate: sqltemplate.New(b.dialect),
				WriteEvent: resource.WriteEvent{
					Key:        req.Key,
					Type:       eventType,
					Value:      req.Value,
					PreviousRV: -1, // Used for WATCH, but we want to skip watch events
				},
				Folder:          req.Folder,
				GUID:            uuid.NewString(),
				ResourceVersion: rv,
			}); err != nil {
				return rollbackWithError(fmt.Errorf("insert into resource history: %w", err))
			}

			fmt.Printf("WROTE %d/%s\n", rv, req.Key.Name)
		}

		// Now update the resource table from history
		for _, key := range setting.Collection {
			k := fmt.Sprintf("%s/%s/%s", key.Namespace, key.Group, key.Resource)
			summary := summaries[k]
			if summary == nil {
				return rollbackWithError(fmt.Errorf("missing summary key for: %s", k))
			}

			err := batch.syncCollection(key, summary)
			if err != nil {
				return err
			}

			// Make sure the collection RV is above our last written event
			for {
				crv, _ := b.resourceVersionAtomicInc(ctx, tx, key)
				if crv > rv {
					break
				}
				time.Sleep(10 * time.Millisecond)
			}
		}
		fmt.Printf("DONE (SQL)\n")
		return nil
	})
	return rsp, err
}

type batchWroker struct {
	ctx     context.Context
	tx      db.Tx
	dialect sqltemplate.Dialect
}

// This will remove everything from the `resource` and `resource_history` table for a given namespace/group/resource
func (w *batchWroker) deleteCollection(key *resource.ResourceKey) (*resource.BatchResponse_Summary, error) {
	summary := &resource.BatchResponse_Summary{
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
func (w *batchWroker) syncCollection(key *resource.ResourceKey, summary *resource.BatchResponse_Summary) error {
	_, err := dbutil.Exec(w.ctx, w.tx, sqlResourceInsertFromHistory, &sqlResourceInsertFromHistoryRequest{
		SQLTemplate: sqltemplate.New(w.dialect),
		Key:         key,
	})
	if err != nil {
		return err
	}

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
