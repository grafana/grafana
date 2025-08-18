package expr

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"gonum.org/v1/gonum/graph/simple"

	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// label that is used when all mathexp.Series have 0 labels to make them identifiable by labels. The value of this label is extracted from value field names
const nameLabelName = "__name__"

var (
	logger = log.New("expr")
)

// baseNode includes common properties used across DPNodes.
type baseNode struct {
	id        int64
	refID     string
	isInputTo map[string]struct{}
}

type rawNode struct {
	RefID      string `json:"refId"`
	Query      map[string]any
	QueryRaw   []byte
	QueryType  string
	TimeRange  TimeRange
	DataSource *datasources.DataSource
	// We use this index as the id of the node graph so the order can remain during a the stable sort of the dependency graph execution order.
	// Some data sources, such as cloud watch, have order dependencies between queries.
	idx int64
}

func getExpressionCommandTypeString(rawQuery map[string]any) (string, error) {
	rawType, ok := rawQuery["type"]
	if !ok {
		return "", errors.New("no expression command type in query")
	}
	typeString, ok := rawType.(string)
	if !ok {
		return "", fmt.Errorf("expected expression command type to be a string, got type %T", rawType)
	}
	return typeString, nil
}

func GetExpressionCommandType(rawQuery map[string]any) (c CommandType, err error) {
	typeString, err := getExpressionCommandTypeString(rawQuery)
	if err != nil {
		return c, err
	}
	return ParseCommandType(typeString)
}

// String returns a string representation of the node. In particular for
// %v formatting in error messages.
func (b *baseNode) String() string {
	return b.refID
}

// CMDNode is a DPNode that holds an expression command.
type CMDNode struct {
	baseNode
	CMDType CommandType
	Command Command
}

// ID returns the id of the node so it can fulfill the gonum's graph Node interface.
func (b *baseNode) ID() int64 {
	return b.id
}

// RefID returns the refId of the node.
func (b *baseNode) RefID() string {
	return b.refID
}

func (b *baseNode) SetInputTo(refID string) {
	if b.isInputTo == nil {
		b.isInputTo = make(map[string]struct{})
	}
	b.isInputTo[refID] = struct{}{}
}

func (b *baseNode) IsInputTo() map[string]struct{} {
	return b.isInputTo
}

// NodeType returns the data pipeline node type.
func (gn *CMDNode) NodeType() NodeType {
	return TypeCMDNode
}

func (gn *CMDNode) NeedsVars() []string {
	return gn.Command.NeedsVars()
}

// Execute runs the node and adds the results to vars. If the node requires
// other nodes they must have already been executed and their results must
// already by in vars.
func (gn *CMDNode) Execute(ctx context.Context, now time.Time, vars mathexp.Vars, s *Service) (mathexp.Results, error) {
	return gn.Command.Execute(ctx, now, vars, s.tracer, s.metrics)
}

func buildCMDNode(ctx context.Context, rn *rawNode, toggles featuremgmt.FeatureToggles, cfg *setting.Cfg) (*CMDNode, error) {
	commandType, err := GetExpressionCommandType(rn.Query)
	if err != nil {
		return nil, fmt.Errorf("invalid command type in expression '%v': %w", rn.RefID, err)
	}

	if commandType == TypeSQL {
		if !toggles.IsEnabledGlobally(featuremgmt.FlagSqlExpressions) {
			return nil, fmt.Errorf("sql expressions are disabled")
		}
	}

	node := &CMDNode{
		baseNode: baseNode{
			id:    rn.idx,
			refID: rn.RefID,
		},
		CMDType: commandType,
	}

	if toggles.IsEnabledGlobally(featuremgmt.FlagExpressionParser) {
		rn.QueryType, err = getExpressionCommandTypeString(rn.Query)
		if err != nil {
			return nil, err // should not happen because the command was parsed first thing
		}

		// NOTE: this structure of this is weird now, because it is targeting a structure
		// where this is actually run in the root loop, however we want to verify the individual
		// node parsing before changing the full tree parser
		reader := NewExpressionQueryReader(toggles)
		iter, err := jsoniter.ParseBytes(jsoniter.ConfigDefault, rn.QueryRaw)
		if err != nil {
			return nil, err
		}
		q, err := reader.ReadQuery(ctx, data.NewDataQuery(map[string]any{
			"refId": rn.RefID,
			"type":  rn.QueryType,
		}), iter)
		if err != nil {
			return nil, err
		}
		node.Command = q.Command
		return node, err
	}

	switch commandType {
	case TypeMath:
		node.Command, err = UnmarshalMathCommand(rn)
	case TypeReduce:
		node.Command, err = UnmarshalReduceCommand(rn)
	case TypeResample:
		node.Command, err = UnmarshalResampleCommand(rn)
	case TypeClassicConditions:
		node.Command, err = classic.UnmarshalConditionsCmd(rn.Query, rn.RefID)
	case TypeThreshold:
		node.Command, err = UnmarshalThresholdCommand(rn)
	case TypeSQL:
		node.Command, err = UnmarshalSQLCommand(ctx, rn, cfg)
	default:
		return nil, fmt.Errorf("expression command type '%v' in expression '%v' not implemented", commandType, rn.RefID)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to parse expression '%v': %w", rn.RefID, err)
	}

	return node, nil
}

const (
	defaultIntervalMS = int64(64)
	defaultMaxDP      = int64(5000)
)

// DSNode is a DPNode that holds a datasource request.
type DSNode struct {
	baseNode
	query      json.RawMessage
	datasource *datasources.DataSource

	orgID      int64
	queryType  string
	timeRange  TimeRange
	intervalMS int64
	maxDP      int64
	request    Request

	isInputToSQLExpr bool
}

func (dn *DSNode) String() string {
	if dn.datasource == nil {
		return "unknown"
	}
	return dn.datasource.Type
}

// NodeType returns the data pipeline node type.
func (dn *DSNode) NodeType() NodeType {
	return TypeDatasourceNode
}

// NodeType returns the data pipeline node type.
func (dn *DSNode) NeedsVars() []string {
	return []string{}
}

func (s *Service) buildDSNode(_ *simple.DirectedGraph, rn *rawNode, req *Request) (*DSNode, error) {
	if rn.TimeRange == nil {
		return nil, fmt.Errorf("time range must be specified for refID %s", rn.RefID)
	}
	encodedQuery, err := json.Marshal(rn.Query)
	if err != nil {
		return nil, err
	}

	dsNode := &DSNode{
		baseNode: baseNode{
			id:    rn.idx,
			refID: rn.RefID,
		},
		orgID:      req.OrgId,
		query:      json.RawMessage(encodedQuery),
		queryType:  rn.QueryType,
		intervalMS: defaultIntervalMS,
		maxDP:      defaultMaxDP,
		timeRange:  rn.TimeRange,
		request:    *req,
		datasource: rn.DataSource,
	}

	var floatIntervalMS float64
	if rawIntervalMS, ok := rn.Query["intervalMs"]; ok {
		if floatIntervalMS, ok = rawIntervalMS.(float64); !ok {
			return nil, fmt.Errorf("expected intervalMs to be an float64, got type %T for refId %v", rawIntervalMS, rn.RefID)
		}
		dsNode.intervalMS = int64(floatIntervalMS)
	}

	var floatMaxDP float64
	if rawMaxDP, ok := rn.Query["maxDataPoints"]; ok {
		if floatMaxDP, ok = rawMaxDP.(float64); !ok {
			return nil, fmt.Errorf("expected maxDataPoints to be an float64, got type %T for refId %v", rawMaxDP, rn.RefID)
		}
		dsNode.maxDP = int64(floatMaxDP)
	}

	return dsNode, nil
}

// executeDSNodesGrouped groups datasource node queries by the datasource instance, and then sends them
// in a single request with one or more queries to the datasource.
func executeDSNodesGrouped(ctx context.Context, now time.Time, vars mathexp.Vars, s *Service, nodes []*DSNode) {
	type dsKey struct {
		uid   string // in theory I think this all I need for the key, but rather be safe
		id    int64
		orgID int64
	}
	byDS := make(map[dsKey][]*DSNode)
	for _, node := range nodes {
		k := dsKey{id: node.datasource.ID, uid: node.datasource.UID, orgID: node.orgID}
		byDS[k] = append(byDS[k], node)
	}

	for _, nodeGroup := range byDS {
		func() {
			ctx, span := s.tracer.Start(ctx, "SSE.ExecuteDatasourceQuery")
			defer span.End()
			firstNode := nodeGroup[0]
			pCtx, err := s.pCtxProvider.GetWithDataSource(ctx, firstNode.datasource.Type, firstNode.request.User, firstNode.datasource)
			if err != nil {
				for _, dn := range nodeGroup {
					vars[dn.refID] = mathexp.Results{Error: datasources.ErrDataSourceNotFound}
				}
				return
			}

			logger := logger.FromContext(ctx).New("datasourceType", firstNode.datasource.Type,
				"queryRefId", firstNode.refID,
				"datasourceUid", firstNode.datasource.UID,
				"datasourceVersion", firstNode.datasource.Version,
			)

			span.SetAttributes(
				attribute.String("datasource.type", firstNode.datasource.Type),
				attribute.String("datasource.uid", firstNode.datasource.UID),
			)

			req := &backend.QueryDataRequest{
				PluginContext: pCtx,
				Headers:       firstNode.request.Headers,
			}

			for _, dn := range nodeGroup {
				req.Queries = append(req.Queries, backend.DataQuery{
					RefID:         dn.refID,
					MaxDataPoints: dn.maxDP,
					Interval:      time.Duration(int64(time.Millisecond) * dn.intervalMS),
					JSON:          dn.query,
					TimeRange:     dn.timeRange.AbsoluteTime(now),
					QueryType:     dn.queryType,
				})
			}

			instrument := func(e error, rt string) {
				respStatus := "success"
				responseType := rt
				if e != nil {
					responseType = "error"
					respStatus = "failure"
					span.SetStatus(codes.Error, "failed to query data source")
					span.RecordError(e)
				}
				logger.Debug("Data source queried", "responseType", responseType)
				useDataplane := strings.HasPrefix(responseType, "dataplane-")
				s.metrics.DSRequests.WithLabelValues(respStatus, fmt.Sprintf("%t", useDataplane), firstNode.datasource.Type).Inc()
			}

			resp, err := s.dataService.QueryData(ctx, req)
			if err != nil {
				for _, dn := range nodeGroup {
					vars[dn.refID] = mathexp.Results{Error: MakeQueryError(firstNode.refID, firstNode.datasource.UID, err)}
				}
				instrument(err, "")
				return
			}

			for _, dn := range nodeGroup {
				dataFrames, err := getResponseFrame(logger, resp, dn.refID)
				if err != nil {
					vars[dn.refID] = mathexp.Results{Error: MakeQueryError(dn.refID, dn.datasource.UID, err)}
					instrument(err, "")
					return
				}

				var result mathexp.Results
				responseType, result, err := s.converter.Convert(ctx, dn.datasource.Type, dataFrames, dn.isInputToSQLExpr)
				if err != nil {
					result.Error = makeConversionError(dn.RefID(), err)
				}
				instrument(err, responseType)
				vars[dn.refID] = result
			}
		}()
	}
}

// Execute runs the node and adds the results to vars. If the node requires
// other nodes they must have already been executed and their results must
// already by in vars.
func (dn *DSNode) Execute(ctx context.Context, now time.Time, _ mathexp.Vars, s *Service) (r mathexp.Results, e error) {
	logger := logger.FromContext(ctx).New("datasourceType", dn.datasource.Type, "queryRefId", dn.refID, "datasourceUid", dn.datasource.UID, "datasourceVersion", dn.datasource.Version)
	ctx, span := s.tracer.Start(ctx, "SSE.ExecuteDatasourceQuery")
	defer span.End()

	span.SetAttributes(
		attribute.String("datasource.type", dn.datasource.Type),
		attribute.String("datasource.uid", dn.datasource.UID),
	)

	req := &backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				RefID:         dn.refID,
				MaxDataPoints: dn.maxDP,
				Interval:      time.Duration(int64(time.Millisecond) * dn.intervalMS),
				JSON:          dn.query,
				TimeRange:     dn.timeRange.AbsoluteTime(now),
				QueryType:     dn.queryType,
			},
		},
		Headers: dn.request.Headers,
	}

	responseType := "unknown"
	respStatus := "success"
	defer func() {
		if e != nil {
			responseType = "error"
			respStatus = "failure"
			span.SetStatus(codes.Error, "failed to query data source")
			span.RecordError(e)
		}
		logger.Debug("Data source queried", "responseType", responseType)
		useDataplane := strings.HasPrefix(responseType, "dataplane-")
		s.metrics.DSRequests.WithLabelValues(respStatus, fmt.Sprintf("%t", useDataplane), dn.datasource.Type).Inc()
	}()

	var resp *backend.QueryDataResponse
	mtDSClient, ok := s.mtDatasourceClientBuilder.BuildClient(dn.datasource.Type, dn.datasource.UID)
	if !ok { // use single tenant client
		pCtx, err := s.pCtxProvider.GetWithDataSource(ctx, dn.datasource.Type, dn.request.User, dn.datasource)
		if err != nil {
			return mathexp.Results{}, err
		}
		req.PluginContext = pCtx
		resp, err = s.dataService.QueryData(ctx, req)
		if err != nil {
			return mathexp.Results{}, MakeQueryError(dn.refID, dn.datasource.UID, err)
		}
	} else {
		k8sReq, err := ConvertBackendRequestToDataRequest(req)
		if err != nil {
			return mathexp.Results{}, MakeQueryError(dn.refID, dn.datasource.UID, err)
		}

		// make the query with a mt client
		resp, err = mtDSClient.QueryData(ctx, *k8sReq)

		// handle error
		if err != nil {
			return mathexp.Results{}, MakeQueryError(dn.refID, dn.datasource.UID, err)
		}
	}

	dataFrames, err := getResponseFrame(logger, resp, dn.refID)
	if err != nil {
		return mathexp.Results{}, MakeQueryError(dn.refID, dn.datasource.UID, err)
	}

	var result mathexp.Results

	if dn.isInputToSQLExpr {
		result = handleSqlInput(dn.RefID(), dn.IsInputTo(), dataFrames)

	} else {
		responseType, result, err = s.converter.Convert(ctx, dn.datasource.Type, dataFrames, dn.isInputToSQLExpr)
		if err != nil {
			err = makeConversionError(dn.refID, err)
		}
	}

	return result, err
}
