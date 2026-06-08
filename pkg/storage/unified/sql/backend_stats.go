package sql

import (
	"context"
	"slices"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// folderBatchSize caps how many folder UIDs are bound into a single IN (...)
// clause. SQLite's default SQLITE_MAX_VARIABLE_NUMBER is 999, so 500 leaves
// headroom for other placeholders and stays well under MySQL/Postgres limits.
const folderBatchSize = 500

// Support getting resource stats using SQL as fallback when the indexer is not running
var _ resource.StatsGetter = &backend{}

// GetStats implements resource.ResourceIndexServer.
// This will use the SQL index to count values
func (b *backend) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.GetStats")
	defer span.End()

	folders := req.Folder
	if len(folders) > 0 {
		// Drop empty entries so they don't match rows with no folder.
		filtered := make([]string, 0, len(folders))
		for _, f := range folders {
			if f != "" {
				filtered = append(filtered, f)
			}
		}
		folders = filtered
	}

	rsp := &resourcepb.ResourceStatsResponse{}
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		// Aggregate across chunks so the response remains a single row per
		// (namespace, group, resource) triple regardless of how many batches
		// the folder list was split into.
		type key struct{ ns, group, resource string }
		agg := map[key]*resourcepb.ResourceStatsResponse_Stats{}

		queryChunk := func(chunk []string) error {
			sreq := &sqlStatsRequest{
				SQLTemplate: sqltemplate.New(b.dialect),
				Namespace:   req.Namespace,
				Folders:     chunk,
			}
			rows, err := dbutil.QueryRows(ctx, tx, sqlResourceStats, sreq)
			if err != nil {
				return err
			}
			for rows.Next() {
				row := resource.ResourceStats{}
				if err := rows.Scan(&row.Namespace, &row.Group, &row.Resource, &row.Count, &row.ResourceVersion); err != nil {
					return err
				}
				k := key{row.Namespace, row.Group, row.Resource}
				if s, ok := agg[k]; ok {
					s.Count += row.Count
				} else {
					agg[k] = &resourcepb.ResourceStatsResponse_Stats{
						Group:    row.Group,
						Resource: row.Resource,
						Count:    row.Count,
					}
				}
			}
			return rows.Err()
		}

		if len(folders) == 0 {
			if err := queryChunk(nil); err != nil {
				return err
			}
		} else {
			for chunk := range slices.Chunk(folders, folderBatchSize) {
				if err := queryChunk(chunk); err != nil {
					return err
				}
			}
		}

		for _, s := range agg {
			rsp.Stats = append(rsp.Stats, s)
		}
		return nil
	})
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
	}
	return rsp, nil
}
