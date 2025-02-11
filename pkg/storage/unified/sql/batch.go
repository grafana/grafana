package sql

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/parquet"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	_ resource.BatchProcessingBackend = (*backend)(nil)
)

type batchRV struct {
	max     int64
	counter int64
}

func newBatchRV() *batchRV {
	t := time.Now().Truncate(time.Second * 10)
	return &batchRV{
		max:     (t.UnixMicro() / 10000000) * 10000000,
		counter: 0,
	}
}

func (x *batchRV) next(obj metav1.Object) int64 {
	ts := obj.GetCreationTimestamp().UnixMicro()
	anno := obj.GetAnnotations()
	if anno != nil {
		v := anno[utils.AnnoKeyUpdatedTimestamp]
		t, err := time.Parse(time.RFC3339, v)
		if err == nil {
			ts = t.UnixMicro()
		}
	}
	if ts > x.max || ts < 10000000 {
		ts = x.max
	}
	x.counter++
	return (ts/10000000)*10000000 + x.counter
}

type batchLock struct {
	running map[string]bool
	mu      sync.Mutex
}

func (x *batchLock) Start(keys []*resource.ResourceKey) error {
	x.mu.Lock()
	defer x.mu.Unlock()

	// First verify that it is not already running
	ids := make([]string, len(keys))
	for i, k := range keys {
		id := k.BatchID()
		if x.running[id] {
			return &apierrors.StatusError{ErrStatus: metav1.Status{
				Code:    http.StatusPreconditionFailed,
				Message: "batch export is already running",
			}}
		}
		ids[i] = id
	}

	// Then add the keys to the lock
	for _, k := range ids {
		x.running[k] = true
	}
	return nil
}

func (x *batchLock) Finish(keys []*resource.ResourceKey) {
	x.mu.Lock()
	defer x.mu.Unlock()
	for _, k := range keys {
		delete(x.running, k.BatchID())
	}
}

func (x *batchLock) Active() bool {
	x.mu.Lock()
	defer x.mu.Unlock()
	return len(x.running) > 0
}

func (b *backend) ProcessBatch(ctx context.Context, setting resource.BatchSettings, iter resource.BatchRequestIterator) *resource.BatchResponse {
	err := b.batchLock.Start(setting.Collection)
	if err != nil {
		return &resource.BatchResponse{
			Error: resource.AsErrorResult(err),
		}
	}
	defer b.batchLock.Finish(setting.Collection)

	// We may want to first write parquet, then read parquet
	if b.dialect.DialectName() == "sqlite" {
		file, err := os.CreateTemp("", "grafana-batch-export-*.parquet")
		if err != nil {
			return &resource.BatchResponse{
				Error: resource.AsErrorResult(err),
			}
		}

		writer, err := parquet.NewParquetWriter(file)
		if err != nil {
			return &resource.BatchResponse{
				Error: resource.AsErrorResult(err),
			}
		}

		// write batch to parquet
		rsp := writer.ProcessBatch(ctx, setting, iter)
		if rsp.Error != nil {
			return rsp
		}

		b.log.Info("using parquet buffer", "parquet", file)

		// Replace the iterator with one from parquet
		iter, err = parquet.NewParquetReader(file.Name(), 50)
		if err != nil {
			return &resource.BatchResponse{
				Error: resource.AsErrorResult(err),
			}
		}
	}

	return b.processBatch(ctx, setting, iter)
}

// internal batch process
func (b *backend) processBatch(ctx context.Context, setting resource.BatchSettings, iter resource.BatchRequestIterator) *resource.BatchResponse {
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
			logger:  logging.FromContext(ctx),
		}

		// Calculate the RV based on incoming request timestamps
		rv := newBatchRV()

		summaries := make(map[string]*resource.BatchResponse_Summary, len(setting.Collection)*4)

		// First clear everything in the transaction
		if setting.RebuildCollection {
			for _, key := range setting.Collection {
				summary, err := batch.deleteCollection(key)
				if err != nil {
					return rollbackWithError(err)
				}
				summaries[key.BatchID()] = summary
				rsp.Summary = append(rsp.Summary, summary)
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

			if req.Action == resource.BatchRequest_UNKNOWN {
				rsp.Rejected = append(rsp.Rejected, &resource.BatchResponse_Rejected{
					Key:    req.Key,
					Action: req.Action,
					Error:  "unknown action",
				})
				continue
			}

			err := obj.UnmarshalJSON(req.Value)
			if err != nil {
				rsp.Rejected = append(rsp.Rejected, &resource.BatchResponse_Rejected{
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
					Type:       resource.WatchEvent_Type(req.Action),
					Value:      req.Value,
					PreviousRV: -1, // Used for WATCH, but we want to skip watch events
				},
				Folder:          req.Folder,
				GUID:            uuid.NewString(),
				ResourceVersion: rv.next(obj),
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

			err := batch.syncCollection(key, summary)
			if err != nil {
				return err
			}

			// Make sure the collection RV is above our last written event
			_, err = b.resourceVersionAtomicInc(ctx, tx, key)
			if err != nil {
				b.log.Warn("error increasing RV", "error", err)
			}
		}
		return nil
	})
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
	}
	return rsp
}

type batchWroker struct {
	ctx     context.Context
	tx      db.ContextExecer
	dialect sqltemplate.Dialect
	logger  logging.Logger
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
	w.logger.Info("synchronize collection", "key", key.BatchID())
	_, err := dbutil.Exec(w.ctx, w.tx, sqlResourceInsertFromHistory, &sqlResourceInsertFromHistoryRequest{
		SQLTemplate: sqltemplate.New(w.dialect),
		Key:         key,
	})
	if err != nil {
		return err
	}

	w.logger.Info("get stats (still in transaction)", "key", key.BatchID())
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
