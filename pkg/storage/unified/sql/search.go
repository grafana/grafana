package sql

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Support using SQL as fallback when the indexer is not running
var _ resource.ResourceIndexServer = &backend{}

// GetStats implements resource.ResourceIndexServer.
// This will use the SQL index to count values
func (b *backend) GetStats(ctx context.Context, req *resource.ResourceStatsRequest) (*resource.ResourceStatsResponse, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+".GetStats")
	defer span.End()

	sreq := &sqlStatsRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   req.Namespace,
		Folder:      req.Folder,
	}

	rsp := &resource.ResourceStatsResponse{}
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

			rsp.Stats = append(rsp.Stats, &resource.ResourceStatsResponse_Stats{
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

// History implements resource.ResourceIndexServer.
func (b *backend) History(context.Context, *resource.HistoryRequest) (*resource.HistoryResponse, error) {
	return &resource.HistoryResponse{
		Error: &resource.ErrorResult{
			Code:    http.StatusNotImplemented,
			Message: "SQL backend does not implement History",
		},
	}, nil
}

// Origin implements resource.ResourceIndexServer.
func (b *backend) Origin(context.Context, *resource.OriginRequest) (*resource.OriginResponse, error) {
	return &resource.OriginResponse{
		Error: &resource.ErrorResult{
			Code:    http.StatusNotImplemented,
			Message: "SQL backend does not implement Origin",
		},
	}, nil
}

// Search implements resource.ResourceIndexServer.
func (b *backend) Search(context.Context, *resource.ResourceSearchRequest) (*resource.ResourceSearchResponse, error) {
	return &resource.ResourceSearchResponse{
		Error: &resource.ErrorResult{
			Code:    http.StatusNotImplemented,
			Message: "SQL backend does not implement Search",
		},
	}, nil
}
