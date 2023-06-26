package expr

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/setting"
)

// DatasourceType is the string constant used as the datasource when the property is in Datasource.Type.
// Type in requests is used to identify what type of data source plugin the request belongs to.
const DatasourceType = "__expr__"

// DatasourceUID is the string constant used as the datasource name in requests
// to identify it as an expression command when use in Datasource.UID.
const DatasourceUID = DatasourceType

// DatasourceID is the fake datasource id used in requests to identify it as an
// expression command.
const DatasourceID = -100

// OldDatasourceUID is the datasource uid used in requests to identify it as an
// expression command. It goes with the query root level datasourceUID property. It was accidentally
// set to the Id and is now kept for backwards compatibility. The newer Datasource.UID property
// should be used instead and should be set to "__expr__".
const OldDatasourceUID = "-100"

// IsDataSource checks if the uid points to an expression query
func IsDataSource(uid string) bool {
	return uid == DatasourceUID || uid == OldDatasourceUID
}

// NodeTypeFromDatasourceUID returns NodeType depending on the UID of the data source: TypeCMDNode if UID is DatasourceUID
// or OldDatasourceUID, and TypeDatasourceNode otherwise.
func NodeTypeFromDatasourceUID(uid string) NodeType {
	if IsDataSource(uid) {
		return TypeCMDNode
	}
	return TypeDatasourceNode
}

// Service is service representation for expression handling.
type Service struct {
	cfg          *setting.Cfg
	dataService  backend.QueryDataHandler
	pCtxProvider *plugincontext.Provider
	features     featuremgmt.FeatureToggles

	pluginsClient backend.CallResourceHandler

	tracer  tracing.Tracer
	metrics *metrics
}

func ProvideService(cfg *setting.Cfg, pluginClient plugins.Client, pCtxProvider *plugincontext.Provider,
	features featuremgmt.FeatureToggles, registerer prometheus.Registerer, tracer tracing.Tracer) *Service {
	return &Service{
		cfg:           cfg,
		dataService:   pluginClient,
		pCtxProvider:  pCtxProvider,
		features:      features,
		tracer:        tracer,
		metrics:       newMetrics(registerer),
		pluginsClient: pluginClient,
	}
}

func (s *Service) isDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.ExpressionsEnabled
}

// BuildPipeline builds a pipeline from a request.
func (s *Service) BuildPipeline(req *Request) (DataPipeline, error) {
	return s.buildPipeline(req)
}

// ExecutePipeline executes an expression pipeline and returns all the results.
func (s *Service) ExecutePipeline(ctx context.Context, now time.Time, pipeline DataPipeline) (*backend.QueryDataResponse, error) {
	ctx, span := s.tracer.Start(ctx, "SSE.ExecutePipeline")
	defer span.End()
	res := backend.NewQueryDataResponse()
	vars, err := pipeline.execute(ctx, now, s)
	if err != nil {
		return nil, err
	}
	for refID, val := range vars {
		res.Responses[refID] = backend.DataResponse{
			Frames: val.Values.AsDataFrames(refID),
		}
	}
	return res, nil
}

// Create a datasources.DataSource struct from NodeType. Returns error if kind is TypeDatasourceNode or unknown one.
func DataSourceModelFromNodeType(kind NodeType) (*datasources.DataSource, error) {
	switch kind {
	case TypeCMDNode:
		return &datasources.DataSource{
			ID:             DatasourceID,
			UID:            DatasourceUID,
			Name:           DatasourceUID,
			Type:           DatasourceType,
			JsonData:       simplejson.New(),
			SecureJsonData: make(map[string][]byte),
		}, nil
	case TypeDatasourceNode:
		return nil, errors.New("cannot create expression data source for data source kind")
	default:
		return nil, fmt.Errorf("cannot create expression data source for '%s' kind", kind)
	}
}

// Deprecated. Use DataSourceModelFromNodeType instead
func DataSourceModel() *datasources.DataSource {
	d, _ := DataSourceModelFromNodeType(TypeCMDNode)
	return d
}
