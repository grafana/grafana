package grafanads

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
)

// DatasourceName is the string constant used as the datasource name in requests
// to identify it as a Grafana DS command.
const DatasourceName = "-- Grafana --"

// DatasourceID is the fake datasource id used in requests to identify it as a
// Grafana DS command.
const DatasourceID = -1

// DatasourceUID is the fake datasource uid used in requests to identify it as a
// Grafana DS command.
const DatasourceUID = "grafana"

// Make sure Service implements required interfaces.
// This is important to do since otherwise we will only get a
// not implemented error response from plugin at runtime.
var (
	_ backend.QueryDataHandler   = (*Service)(nil)
	_ backend.CheckHealthHandler = (*Service)(nil)
)

func ProvideService(cfg *setting.Cfg, search searchV2.SearchService, store store.StorageService) *Service {
	return newService(cfg, search, store)
}

func newService(cfg *setting.Cfg, search searchV2.SearchService, store store.StorageService) *Service {
	s := &Service{
		search: search,
		store:  store,
	}

	return s
}

// Service exists regardless of user settings
type Service struct {
	search searchV2.SearchService
	store  store.StorageService
}

func DataSourceModel(orgId int64) *datasources.DataSource {
	return &datasources.DataSource{
		Id:             DatasourceID,
		Uid:            DatasourceUID,
		Name:           DatasourceName,
		Type:           "grafana",
		OrgId:          orgId,
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
		case queryTypeRead:
			response.Responses[q.RefID] = s.doReadQuery(ctx, q)
		case queryTypeSearch:
			response.Responses[q.RefID] = s.doSearchQuery(ctx, req, q)
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

	path := store.RootPublicStatic + "/" + q.Path
	frame, err := s.store.List(ctx, nil, path)
	response.Error = err
	if frame != nil {
		response.Frames = data.Frames{frame}
	}
	return response
}

func (s *Service) doReadQuery(ctx context.Context, query backend.DataQuery) backend.DataResponse {
	q := &readQueryModel{}
	response := backend.DataResponse{}
	err := json.Unmarshal(query.JSON, &q)
	if err != nil {
		response.Error = err
		return response
	}

	if filepath.Ext(q.Path) != ".csv" {
		response.Error = fmt.Errorf("unsupported file type")
		return response
	}

	path := store.RootPublicStatic + "/" + q.Path
	file, err := s.store.Read(ctx, nil, path)
	if err != nil {
		response.Error = err
		return response
	}

	frame, err := testdatasource.LoadCsvContent(bytes.NewReader(file.Contents), filepath.Base(path))
	if err != nil {
		response.Error = err
		return response
	}
	response.Frames = data.Frames{frame}
	return response
}

func (s *Service) doRandomWalk(query backend.DataQuery) backend.DataResponse {
	response := backend.DataResponse{}

	model := simplejson.New()
	response.Frames = data.Frames{testdatasource.RandomWalk(query, model, 0)}

	return response
}

func (s *Service) doSearchQuery(ctx context.Context, req *backend.QueryDataRequest, query backend.DataQuery) backend.DataResponse {
	m := requestModel{}
	err := json.Unmarshal(query.JSON, &m)
	if err != nil {
		return backend.DataResponse{
			Error: err,
		}
	}
	return *s.search.DoDashboardQuery(ctx, req.PluginContext.User, req.PluginContext.OrgID, m.Search)
}

type requestModel struct {
	QueryType string                  `json:"queryType"`
	Search    searchV2.DashboardQuery `json:"search,omitempty"`
}
