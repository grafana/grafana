package grafanads

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store"
	testdatasource "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
)

// DatasourceName is the string constant used as the datasource name in requests
// to identify it as a Grafana DS command.
const DatasourceName = "-- Grafana --"

// DatasourceID is the fake datasource id used in requests to identify it as a
// Grafana DS command.
const DatasourceID = -1

// DatasourceUID is the fake datasource uid used in requests to identify it as a
// Grafana DS command.
const DatasourceUID = dashboard.GrafanaDatasourceUID

// Make sure Service implements required interfaces.
// This is important to do since otherwise we will only get a
// not implemented error response from plugin at runtime.
var (
	_ backend.QueryDataHandler   = (*Service)(nil)
	_ backend.CheckHealthHandler = (*Service)(nil)
)

// nolint:staticcheck
func ProvideService(store store.StorageService, features featuremgmt.FeatureToggles) *Service {
	return newService(store, features)
}

// nolint:staticcheck
func newService(store store.StorageService, features featuremgmt.FeatureToggles) *Service {
	s := &Service{
		store:    store,
		log:      log.New("grafanads"),
		features: features,
	}

	return s
}

// Service exists regardless of user settings
type Service struct {
	store    store.StorageService // nolint:staticcheck
	log      log.Logger
	features featuremgmt.FeatureToggles
}

func DataSourceModel(orgId int64) *datasources.DataSource {
	return &datasources.DataSource{
		ID:             DatasourceID,
		UID:            DatasourceUID,
		Name:           DatasourceName,
		Type:           "grafana",
		OrgID:          orgId,
		JsonData:       simplejson.New(),
		SecureJsonData: make(map[string][]byte),
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	response := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		switch q.QueryType {
		case queryTypeRandomWalk:
			response.Responses[q.RefID] = s.doRandomWalk(q)
		case queryTypeList:
			response.Responses[q.RefID] = s.doListQuery(ctx, q)
		default:
			response.Responses[q.RefID] = backend.DataResponse{
				Error: fmt.Errorf("unknown query type"),
			}
		}
	}

	return response, nil
}

func (s *Service) CheckHealth(_ context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "OK",
	}, nil
}

func (s *Service) doListQuery(ctx context.Context, query backend.DataQuery) backend.DataResponse {
	q := &listQueryModel{}
	response := backend.DataResponse{}
	err := json.Unmarshal(query.JSON, &q)
	if err != nil {
		response.Error = err
		return response
	}

	maxFiles := int(query.MaxDataPoints)
	listFrame, err := s.listPublicStatic(ctx, q.Path, maxFiles)
	response.Error = err
	if listFrame != nil {
		response.Frames = data.Frames{listFrame.Frame}
	}
	return response
}

// Icons are listed from the frontend build output (build/img/icons), the same copy the
// Icon component loads. The dev server keeps that output in memory rather than writing it
// to disk, so fall back to the source copy in img/icons.
func (s *Service) listPublicStatic(ctx context.Context, relPath string, maxFiles int) (*store.StorageListFrame, error) {
	if !strings.HasPrefix(relPath, "img/icons/") {
		return s.store.List(ctx, nil, store.RootPublicStatic+"/"+relPath, maxFiles) // nolint:staticcheck
	}

	frame, err := s.store.List(ctx, nil, store.RootPublicStatic+"/build/"+relPath, maxFiles) // nolint:staticcheck
	if err == nil && hasRows(frame) {
		return frame, nil
	}

	frame, err = s.store.List(ctx, nil, store.RootPublicStatic+"/"+relPath, maxFiles) // nolint:staticcheck
	if err == nil && !hasRows(frame) {
		s.log.Warn("No icons found in the frontend build output or source tree", "path", relPath)
	}
	return frame, err
}

func hasRows(frame *store.StorageListFrame) bool {
	return frame != nil && frame.Frame != nil && frame.Rows() > 0
}

func (s *Service) doRandomWalk(query backend.DataQuery) backend.DataResponse {
	response := backend.DataResponse{}

	model, err := testdatasource.GetJSONModel(json.RawMessage{})
	if err != nil {
		response.Error = err
		return response
	}
	response.Frames = data.Frames{testdatasource.RandomWalk(query, model, 0)}

	return response
}
