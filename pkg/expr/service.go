package expr

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"

	mysql "github.com/dolthub/go-mysql-server/sql"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/metrics"
	"github.com/grafana/grafana/pkg/expr/sql"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/mtdsclient"
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
	if uid == MLDatasourceUID {
		return TypeMLNode
	}
	return TypeDatasourceNode
}

// Service is service representation for expression handling.
type Service struct {
	cfg          *setting.Cfg
	dataService  backend.QueryDataHandler
	pCtxProvider pluginContextProvider
	features     featuremgmt.FeatureToggles
	converter    *ResultConverter

	pluginsClient backend.CallResourceHandler

	tracer                    tracing.Tracer
	metrics                   *metrics.ExprMetrics
	mtDatasourceClientBuilder mtdsclient.MTDatasourceClientBuilder
}

type pluginContextProvider interface {
	Get(ctx context.Context, pluginID string, user identity.Requester, orgID int64) (backend.PluginContext, error)
	GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error)
}

func ProvideService(cfg *setting.Cfg, pluginClient plugins.Client, pCtxProvider *plugincontext.Provider,
	features featuremgmt.FeatureToggles, registerer prometheus.Registerer, tracer tracing.Tracer, builder mtdsclient.MTDatasourceClientBuilder) *Service {
	return &Service{
		cfg:           cfg,
		dataService:   pluginClient,
		pCtxProvider:  pCtxProvider,
		features:      features,
		tracer:        tracer,
		metrics:       metrics.NewSSEMetrics(registerer),
		pluginsClient: pluginClient,
		converter: &ResultConverter{
			Features: features,
			Tracer:   tracer,
		},
		mtDatasourceClientBuilder: builder,
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
	// TODO: REMOVE
	if req != nil {
		_, _ = s.GetSQLSchemas(context.Background(), *req) // temp hack until endpoint for local dev
	}
	return s.buildPipeline(req)
}

// BasicColumn is a simplified version of mysql.Column used for SQL expression schemas.
type BasicColumn struct {
	Name     string
	Type     mysql.Type
	Nullable bool
}

// GetSQLSchemas returns what the schemas are for SQL expressions for all DS queries
// in the request. It executes the queries to get the schemas.
// TODO: DTO for mysql.Schema?
// Intended use is for autocomplete and AI, so used during the authoring/editing experience only.
func (s *Service) GetSQLSchemas(ctx context.Context, req Request) (map[string][]BasicColumn, error) {
	// Extract DS Nodes and Execute Them
	// Building the pipeline is maybe not best, as it can have more errors.
	filtered := make([]Query, 0, len(req.Queries))
	for _, q := range req.Queries {
		if NodeTypeFromDatasourceUID(q.DataSource.UID) == TypeDatasourceNode {
			filtered = append(filtered, q)
		}
	}
	req.Queries = filtered
	pipeline, err := s.buildPipeline(&req)
	if err != nil {
		return nil, err
	}

	var schemas = make(map[string][]BasicColumn)

	for _, node := range pipeline {
		// For now, execute calls convert at the end, so we are being lazy and running the full conversion. Longer run we want to run without
		// full conversion and just get the schema. Maybe conversion should be
		dsNode := node.(*DSNode)
		// Make all input to SQL
		dsNode.isInputToSQLExpr = true

		// TODO: check where time is coming from, don't recall
		res, err := dsNode.Execute(ctx, time.Now(), mathexp.Vars{}, s)
		if err != nil || res.Error != nil {
			continue
			// we want to continue and get the schemas we can
		}

		frames := res.Values.AsDataFrames(dsNode.RefID())
		schema := sql.SchemaFromFrame(frames[0])
		columns := make([]BasicColumn, 0, len(schema))
		for _, col := range schema {
			columns = append(columns, BasicColumn{
				Name:     col.Name,
				Type:     col.Type,
				Nullable: col.Nullable,
			})
		}
		schemas[dsNode.RefID()] = columns
	}

	// TODO: REMOVE
	spew.Dump(schemas)

	return schemas, nil
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
			Error:  val.Error,
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
	case TypeMLNode:
		return &datasources.DataSource{
			ID:             mlDatasourceID,
			UID:            MLDatasourceUID,
			Name:           DatasourceUID,
			Type:           mlPluginID,
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
