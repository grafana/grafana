package searchV2

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type StandardSearchService struct {
	sql *sqlstore.SQLStore
}

func ProvideService(sql *sqlstore.SQLStore) SearchService {
	return &StandardSearchService{
		sql: sql,
	}
}

func (s *StandardSearchService) DoDashboardQuery(ctx context.Context, query DashboardQuery) *backend.DataResponse {
	rsp := &backend.DataResponse{}

	// dashboards
	fid := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	uid := data.NewFieldFromFieldType(data.FieldTypeString, 0)

	fid.Append(int64(2))
	uid.Append("hello")

	rsp.Frames = append(rsp.Frames, data.NewFrame("dasboards", fid, uid))

	return rsp
}
