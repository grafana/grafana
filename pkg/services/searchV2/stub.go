package searchV2

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/user"
)

type stubSearchService struct {
}

func (s *stubSearchService) doDashboardQuery(ctx context.Context, user *user.SignedInUser, orgId int64, query DashboardQuery) *backend.DataResponse {
	return s.DoDashboardQuery(ctx, nil, orgId, query)
}

func (s *stubSearchService) IsReady(ctx context.Context, orgId int64) IsSearchReadyResponse {
	return IsSearchReadyResponse{}
}

func (s *stubSearchService) IsDisabled() bool {
	return true
}

func (s *stubSearchService) TriggerReIndex() {
	// noop.
}

func NewStubSearchService() SearchService {
	return &stubSearchService{}
}

func (s *stubSearchService) DoDashboardQuery(ctx context.Context, user *backend.User, orgId int64, query DashboardQuery) *backend.DataResponse {
	rsp := &backend.DataResponse{}

	// dashboards
	fid := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	uid := data.NewFieldFromFieldType(data.FieldTypeString, 0)

	fid.Append(int64(2))
	uid.Append("hello")

	rsp.Frames = append(rsp.Frames, data.NewFrame("dasboards", fid, uid))

	return rsp
}

func (s *stubSearchService) RegisterDashboardIndexExtender(ext DashboardIndexExtender) {
	// noop
}

func (s *stubSearchService) Run(_ context.Context) error {
	return nil
}
