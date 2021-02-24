package elasticsearch

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/tsdb"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

var logger = log.New("tsdb.elasticsearch")

var intervalCalculator tsdb.IntervalCalculator

type datasourceInfo struct {
	database string

	datasourceID int64
}

// Executor represents a handler for handling elasticsearch datasource request
type elasticsearchExecutor struct {
	im instancemgmt.InstanceManager
}

type ElasticsearchService struct {
	BackendPluginManager backendplugin.Manager `inject:""`
}

func newExecutor(im instancemgmt.InstanceManager) *elasticsearchExecutor {
	return &elasticsearchExecutor{
		im: im,
	}
}

func newInstanceSettings() datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {

		var jsonData map[string]string

		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		model := datasourceInfo{
			database: jsonData["database"],
		}

		return model, nil
	}
}

func init() {
	intervalCalculator = tsdb.NewIntervalCalculator(nil)

	registry.Register(&registry.Descriptor{
		Name:         "ElasticsearchService",
		InitPriority: registry.Low,
		Instance:     &ElasticsearchService{},
	})
}

func (s *ElasticsearchService) Init() error {
	logger.Debug("initializing plugin")

	im := datasource.NewInstanceManager(newInstanceSettings())

	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: newExecutor(im),
	})

	if err := s.BackendPluginManager.Register("elasticsearch", factory); err != nil {
		logger.Error("Failed to register plugin", "error", err)
	}

	return nil
}

// Query handles an elasticsearch datasource request
func (e *elasticsearchExecutor) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	model, err := simplejson.NewJson(req.Queries[0].JSON)
	if err != nil {
		return nil, err
	}

	queryType := model.Get("type").MustString("")

	// client, err := es.NewClient(ctx, dsInfo, tsdbQuery.TimeRange)
	// if err != nil {
	// 	return nil, err
	// }

	// if tsdbQuery.Debug {
	// 	client.EnableDebug()
	// }

	// var queryType string
	// var query queryEndpoint

	// if qt, ok := tsdbQuery.Queries[0].Model.CheckGet("queryType"); ok {
	// 	queryType = qt.MustString("timeseries")
	// }

	var result *backend.QueryDataResponse
	switch queryType {
	case "fields":
		// query = newFieldsQuery(client, tsdbQuery)
	// case "terms":
	// 	query = newTermsQuery(client, tsdbQuery)
	// case "annotation":
	// 	query = newAnnotationQuery(client, tsdbQuery)
	case "timeseries":
		fallthrough
	default:
		// result, err = newTimeSeriesQuery(client, tsdbQuery, intervalCalculator)
	}

	// res, err := query.execute()
	// if err != nil {
	// 	return res, err
	// }
	// enrichResponseWithMeta(client, tsdbQuery, res)

	return result, nil
}

// What is meta? Why we need this?
func enrichResponseWithMeta(client es.Client, tsdbQuery *tsdb.TsdbQuery, res *tsdb.Response) {
	meta := client.GetMeta()
	if len(meta) == 0 {
		return
	}

	firstQuery := tsdbQuery.Queries[0]

	if res == nil {
		res = &tsdb.Response{}
	}

	if len(res.Results) == 0 {
		res.Results = map[string]*tsdb.QueryResult{
			firstQuery.RefId: {
				Meta: simplejson.NewFromAny(meta),
			},
		}
	} else {
		if res.Results[firstQuery.RefId].Meta == nil {
			res.Results[firstQuery.RefId].Meta = simplejson.NewFromAny(meta)
		} else {
			for k, v := range res.Results[firstQuery.RefId].Meta.MustMap() {
				res.Results[firstQuery.RefId].Meta.Set(k, v)
				break
			}
		}
	}
}
