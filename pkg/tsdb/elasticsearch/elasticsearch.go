package elasticsearch

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
	"github.com/grafana/grafana/pkg/tsdb/interval"
)

var eslog = log.New("tsdb.elasticsearch")

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "ElasticSearchService",
		InitPriority: registry.Low,
		Instance:     &Service{},
	})
}

type Service struct {
	BackendPluginManager backendplugin.Manager `inject:""`
	Cfg                  *setting.Cfg          `inject:""`
	HTTPClientProvider   httpclient.Provider   `inject:""`
	httpClientProvider   httpclient.Provider
	intervalCalculator   interval.Calculator
	im                   instancemgmt.InstanceManager
	cfg                  *setting.Cfg
}

func (s *Service) Init() error {
	eslog.Debug("initializing")
	im := datasource.NewInstanceManager(newInstanceSettings())
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: newExecutor(im, s.Cfg, s.HTTPClientProvider),
	})
	if err := s.BackendPluginManager.Register("elasticsearch", factory); err != nil {
		eslog.Error("Failed to register plugin", "error", err)
	}
	return nil
}

// newExecutor creates a new executor func.
func newExecutor(im instancemgmt.InstanceManager, cfg *setting.Cfg, httpClientProvider httpclient.Provider) *Service {
	return &Service{
		im:                 im,
		cfg:                cfg,
		httpClientProvider: httpClientProvider,
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		return &backend.QueryDataResponse{}, fmt.Errorf("query contains no queries")
	}

	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	client, err := es.NewClient(ctx, s.httpClientProvider, dsInfo, req.Queries[0].TimeRange)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	query := newTimeSeriesQuery(client, req.Queries, s.intervalCalculator)
	return query.execute()
}

func newInstanceSettings() datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData := map[string]interface{}{}
		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		model := models.DataSource{
			JsonData: simplejson.NewFromAny(jsonData),
			Id:       settings.ID,
			Url:      settings.URL,
		}
		return model, nil
	}
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*models.DataSource, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance := i.(models.DataSource)

	return &instance, nil
}
