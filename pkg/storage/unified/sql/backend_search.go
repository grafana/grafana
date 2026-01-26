package sql

import (
	"context"
	"iter"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/atomic"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Don't run deletion of "last import times" more often than this duration.
const limitLastImportTimesDeletion = 1 * time.Hour

// searchBackendImpl implements resource.SearchSupport.
// It embeds baseBackend to get StorageReader capabilities needed for index building.
type searchBackendImpl struct {
	*baseBackend // Embed base (provides StorageReader for index building)

	lastImportTimeMaxAge       time.Duration
	lastImportTimeDeletionTime atomic.Time
}

// searchBackendOptions contains options for creating a searchBackendImpl.
type searchBackendOptions struct {
	LastImportTimeMaxAge time.Duration
}

// newSearchBackendWithBase creates a search support backend using a pre-existing base backend.
func newSearchBackendWithBase(base *baseBackend, opts searchBackendOptions) (*searchBackendImpl, error) {
	return &searchBackendImpl{
		baseBackend:          base,
		lastImportTimeMaxAge: opts.LastImportTimeMaxAge,
	}, nil
}

// GetResourceStats implements resource.SearchSupport.
func (b *searchBackendImpl) GetResourceStats(ctx context.Context, nsr resource.NamespacedResource, minCount int) ([]resource.ResourceStats, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.GetResourceStats", trace.WithAttributes(
		attribute.String("namespace", nsr.Namespace),
		attribute.String("group", nsr.Group),
		attribute.String("resource", nsr.Resource),
	))
	defer span.End()

	req := &sqlStatsRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   nsr.Namespace,
		Group:       nsr.Group,
		Resource:    nsr.Resource,
		MinCount:    minCount, // not used in query... yet?
	}

	res := make([]resource.ResourceStats, 0, 100)
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		rows, err := dbutil.QueryRows(ctx, tx, sqlResourceStats, req)
		if err != nil {
			return err
		}
		for rows.Next() {
			row := resource.ResourceStats{}
			err = rows.Scan(&row.Namespace, &row.Group, &row.Resource, &row.Count, &row.ResourceVersion)
			if err != nil {
				return err
			}
			if row.Count > int64(minCount) {
				res = append(res, row)
			} else {
				b.log.Debug("skipping stats for resource with count less than min count", "namespace", row.Namespace, "group", row.Group, "resource", row.Resource, "count", row.Count, "minCount", minCount)
			}
		}
		return err
	})

	return res, err
}

// GetResourceLastImportTimes implements resource.SearchSupport.
func (b *searchBackendImpl) GetResourceLastImportTimes(ctx context.Context) iter.Seq2[resource.ResourceLastImportTime, error] {
	ctx, span := tracer.Start(ctx, "sql.backend.GetResourceLastImportTimes")
	defer span.End()

	// Delete old entries, if configured, and if enough time has passed since last deletion.
	if b.lastImportTimeMaxAge > 0 && time.Since(b.lastImportTimeDeletionTime.Load()) > limitLastImportTimesDeletion {
		now := time.Now()

		res, err := dbutil.Exec(ctx, b.db, sqlResourceLastImportTimeDelete, &sqlResourceLastImportTimeDeleteRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Threshold:   now.Add(-b.lastImportTimeMaxAge),
		})

		if err != nil {
			return func(yield func(resource.ResourceLastImportTime, error) bool) {
				yield(resource.ResourceLastImportTime{}, err)
			}
		}

		aff, err := res.RowsAffected()
		if err == nil && aff > 0 {
			b.log.Info("Deleted old last import times", "rows", aff)
		}

		b.lastImportTimeDeletionTime.Store(now)
	}

	rows, err := dbutil.QueryRows(ctx, b.db, sqlResourceLastImportTimeQuery, &sqlResourceLastImportTimeQueryRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
	})
	if err != nil {
		return func(yield func(resource.ResourceLastImportTime, error) bool) {
			yield(resource.ResourceLastImportTime{}, err)
		}
	}

	return func(yield func(resource.ResourceLastImportTime, error) bool) {
		closeOnDefer := true
		defer func() {
			if closeOnDefer {
				_ = rows.Close() // Close while ignoring errors.
			}
		}()

		for rows.Next() {
			// If context has finished, return early.
			if ctx.Err() != nil {
				yield(resource.ResourceLastImportTime{}, ctx.Err())
				return
			}

			row := resource.ResourceLastImportTime{}
			err = rows.Scan(&row.Namespace, &row.Group, &row.Resource, &row.LastImportTime)
			if err != nil {
				yield(resource.ResourceLastImportTime{}, err)
				return
			}

			if !yield(row, nil) {
				return
			}
		}

		closeOnDefer = false

		// Close and report error, if any.
		err := rows.Close()
		if err != nil {
			yield(resource.ResourceLastImportTime{}, err)
		}
	}
}

// ListModifiedSince implements resource.SearchSupport.
// It will return all resources that have changed since the given resource version.
// If a resource has changes, only the latest change will be returned.
func (b *searchBackendImpl) ListModifiedSince(ctx context.Context, key resource.NamespacedResource, sinceRv int64) (int64, iter.Seq2[*resource.ModifiedResource, error]) {
	// We don't use an explicit transaction for fetching LatestRV and subsequent fetching of resources.
	// To guarantee that we don't include events with RV > LatestRV, we include the check in SQL query.

	// Fetch latest RV.
	latestRv, err := b.fetchLatestRV(ctx, b.db, b.dialect, key.Group, key.Resource)
	if err != nil {
		return 0, func(yield func(*resource.ModifiedResource, error) bool) {
			yield(nil, err)
		}
	}

	// If latest RV equal or older than request RV, there's nothing to report, and we can avoid running another query.
	if latestRv <= sinceRv {
		return latestRv, func(yield func(*resource.ModifiedResource, error) bool) { /* nothing to return */ }
	}

	seen := make(map[string]struct{})
	seq := func(yield func(*resource.ModifiedResource, error) bool) {
		query := sqlResourceListModifiedSinceRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Namespace:   key.Namespace,
			Group:       key.Group,
			Resource:    key.Resource,
			SinceRv:     sinceRv,
			LatestRv:    latestRv,
		}

		rows, err := dbutil.QueryRows(ctx, b.db, sqlResourceHistoryListModifiedSince, query)
		if err != nil {
			yield(nil, err)
			return
		}
		if rows != nil {
			defer func() {
				if cerr := rows.Close(); cerr != nil {
					b.log.Warn("listSinceModified error closing rows", "error", cerr)
				}
			}()
		}

		for rows.Next() {
			mr := &resource.ModifiedResource{}
			if err := rows.Scan(&mr.Key.Namespace, &mr.Key.Group, &mr.Key.Resource, &mr.Key.Name, &mr.ResourceVersion, &mr.Action, &mr.Value); err != nil {
				if !yield(nil, err) {
					return
				}
				continue
			}

			// Deduplicate by name (namespace, group, and resource are always the same in the result set)
			if _, ok := seen[mr.Key.Name]; ok {
				continue
			}

			seen[mr.Key.Name] = struct{}{}
			if !yield(mr, nil) {
				return
			}
		}
	}

	return latestRv, seq
}
