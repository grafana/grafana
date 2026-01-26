package sql

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Support using SQL as fallback when the indexer is not running
var _ resourcepb.ResourceIndexServer = &backend{}

// GetStats implements resource.ResourceIndexServer.
// This will use the SQL index to count values
func (b *baseBackend) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.GetStats")
	defer span.End()

	sreq := &sqlStatsRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   req.Namespace,
		Folder:      req.Folder,
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

// Search is not supported by the SQL backend.
func (b *baseBackend) Search(context.Context, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	return &resourcepb.ResourceSearchResponse{
		Error: &resourcepb.ErrorResult{
			Code:    http.StatusNotImplemented,
			Message: "SQL backend does not implement Search",
		},
	}, nil
}

// RebuildIndexes is not supported by the SQL backend.
func (b *baseBackend) RebuildIndexes(context.Context, *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	return nil, fmt.Errorf("rebuild indexes not supported by unistore sql backend")
}
