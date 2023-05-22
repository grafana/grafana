package grafanads

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/services/store"
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
	_                                       backend.QueryDataHandler   = (*Service)(nil)
	_                                       backend.CheckHealthHandler = (*Service)(nil)
	namespace                                                          = "grafana"
	subsystem                                                          = "grafanads"
	dashboardSearchNotServedRequestsCounter                            = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "dashboard_search_requests_not_served_total",
			Help:      "A counter for dashboard search requests that could not be served due to an ongoing search engine indexing",
		},
		[]string{"reason"},
	)
)

func ProvideService(search searchV2.SearchService, store store.StorageService) *Service {
	return newService(search, store)
}

func newService(search searchV2.SearchService, store store.StorageService) *Service {
	s := &Service{
		search: search,
		store:  store,
		log:    log.New("grafanads"),
	}

	return s
}

// Service exists regardless of user settings
type Service struct {
	search searchV2.SearchService
	store  store.StorageService
	log    log.Logger
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
	listFrame, err := s.store.List(ctx, nil, path)
	response.Error = err
	if listFrame != nil {
		response.Frames = data.Frames{listFrame.Frame}
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
	searchReadinessCheckResp := s.search.IsReady(ctx, req.PluginContext.OrgID)
	if !searchReadinessCheckResp.IsReady {
		dashboardSearchNotServedRequestsCounter.With(prometheus.Labels{
			"reason": searchReadinessCheckResp.Reason,
		}).Inc()

		return backend.DataResponse{
			Frames: data.Frames{
				&data.Frame{
					Name: "Loading",
				},
			},
		}
	}

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
