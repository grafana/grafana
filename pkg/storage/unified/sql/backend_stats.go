package sql

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

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
		filtered := folders[:0:0]
		for _, f := range folders {
			if f != "" {
				filtered = append(filtered, f)
			}
		}
		folders = filtered
	}
	sreq := &sqlStatsRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   req.Namespace,
		Folders:     folders,
	}

	rsp := &resourcepb.ResourceStatsResponse{}
	err := b.db.WithTx(ctx, ReadCommittedRO, func(ctx context.Context, tx db.Tx) error {
		rows, err := dbutil.QueryRows(ctx, tx, sqlResourceStats, sreq)
		if err != nil {
			return err
		}
		for rows.Next() {
			row := resource.ResourceStats{}
			err = rows.Scan(&row.Namespace, &row.Group, &row.Resource, &row.Count, &row.ResourceVersion)
			if err != nil {
				return err
			}

			rsp.Stats = append(rsp.Stats, &resourcepb.ResourceStatsResponse_Stats{
				Group:    row.Group,
				Resource: row.Resource,
				Count:    row.Count,
			})
		}
		return err
	})
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
	}
	return rsp, nil
}
