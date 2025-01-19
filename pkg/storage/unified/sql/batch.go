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

func (b *backend) ProcessBatch(ctx context.Context, setting resource.BatchSettings, next func() *resource.BatchRequest) (*resource.BatchResponse, error) {
	rsp := &resource.BatchResponse{}
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		batch := &batchWroker{
			ctx:     ctx,
			tx:      tx,
			dialect: b.dialect,
		}

		// Use the max RV from all resources
		// We are in a transaction so as long as the individual values increase we are set
		rv := int64(0)

		// First clear everything in the transaction
		if setting.RebuildCollection {
			for _, key := range setting.Collection {
				summary, err := batch.deleteCollection(key)
				if summary != nil {
					rsp.Summary = append(rsp.Summary, summary...)
				}
				if err != nil {
					return err
				}

				// get the RV for this resource
				tmp, err := b.resourceVersionAtomicInc(ctx, tx, key)
				if err != nil {
					return fmt.Errorf("increment resource version: %w", err)
				}
				if tmp > rv {
					rv = tmp
				}
			}
		}
		if rv < 100 {
			return fmt.Errorf("expected resource version to be set")
		}

		summary := make(map[string]*resource.BatchResponse_Summary, len(setting.Collection)*4)

		// Write each event into the history
		for req := next(); req != nil; req = next() {
			if req.Action == resource.BatchRequest_UNKNOWN {
				return fmt.Errorf("unknown action")
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
				return fmt.Errorf("insert into resource history: %w", err)
			}

			// Add summary statistics
			k := fmt.Sprintf("%s/%s/%s - %d", req.Key.Namespace, req.Key.Group, req.Key.Resource, eventType)
			s, ok := summary[k]
			if !ok {
				req.Key.Name = ""
				s = &resource.BatchResponse_Summary{
					Action:  resource.BatchResponse_Summary_WRITE_EVENT,
					Key:     req.Key,
					Details: fmt.Sprintf("Type %s", eventType.String()),
				}
				rsp.Summary = append(rsp.Summary, s)
				summary[k] = s
			}
			s.Count++

			fmt.Printf("WROTE %d/%s (%s/%d)\n", rv, req.Key.Name, s.Action, s.Count)
		}

		// Now update the resource table from history
		for _, key := range setting.Collection {
			summary, err := batch.syncCollection(key)
			if summary != nil {
				rsp.Summary = append(rsp.Summary, summary)
			}
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

func (w *batchWroker) deleteCollection(key *resource.ResourceKey) ([]*resource.BatchResponse_Summary, error) {
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
	history := &resource.BatchResponse_Summary{
		Action: resource.BatchResponse_Summary_DELETE_HISTORY,
		Key:    key,
	}
	history.Count, err = res.RowsAffected()
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
	resources := &resource.BatchResponse_Summary{
		Action: resource.BatchResponse_Summary_DELETE_RESOURCE,
		Key:    key,
	}
	resources.Count, err = res.RowsAffected()
	return []*resource.BatchResponse_Summary{history, resources}, err
}

func (w *batchWroker) syncCollection(key *resource.ResourceKey) (*resource.BatchResponse_Summary, error) {
	res, err := dbutil.Exec(w.ctx, w.tx, sqlResourceInsertFromHistory, &sqlResourceInsertFromHistoryRequest{
		SQLTemplate: sqltemplate.New(w.dialect),
		Key:         key,
	})
	if err != nil {
		return nil, err
	}
	summary := &resource.BatchResponse_Summary{
		Action: resource.BatchResponse_Summary_SYNC_RESOURCE,
		Key:    key,
	}
	summary.Count, err = res.RowsAffected()
	return summary, err
}
