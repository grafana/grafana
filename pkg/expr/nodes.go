package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"
	"gonum.org/v1/gonum/graph/simple"

	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// label that is used when all mathexp.Series have 0 labels to make them identifiable by labels. The value of this label is extracted from value field names
const nameLabelName = "__name__"

var (
	logger = log.New("expr")
)

// baseNode includes common properties used across DPNodes.
type baseNode struct {
	id    int64
	refID string
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

func (rn *rawNode) GetCommandType() (c CommandType, err error) {
	rawType, ok := rn.Query["type"]
	if !ok {
		return c, fmt.Errorf("no expression command type in query for refId %v", rn.RefID)
	}
	typeString, ok := rawType.(string)
	if !ok {
		return c, fmt.Errorf("expected expression command type to be a string, got type %T", rawType)
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
	return gn.Command.Execute(ctx, now, vars, s.tracer)
}

func buildCMDNode(dp *simple.DirectedGraph, rn *rawNode) (*CMDNode, error) {
	commandType, err := rn.GetCommandType()
	if err != nil {
		return nil, fmt.Errorf("invalid command type in expression '%v': %w", rn.RefID, err)
	}

	node := &CMDNode{
		baseNode: baseNode{
			id:    rn.idx,
			refID: rn.RefID,
		},
		CMDType: commandType,
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
}

// NodeType returns the data pipeline node type.
func (dn *DSNode) NodeType() NodeType {
	return TypeDatasourceNode
}

// NodeType returns the data pipeline node type.
func (dn *DSNode) NeedsVars() []string {
	return []string{}
}

func (s *Service) buildDSNode(dp *simple.DirectedGraph, rn *rawNode, req *Request) (*DSNode, error) {
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

			span.SetAttributes("datasource.type", firstNode.datasource.Type, attribute.Key("datasource.type").String(firstNode.datasource.Type))
			span.SetAttributes("datasource.uid", firstNode.datasource.UID, attribute.Key("datasource.uid").String(firstNode.datasource.UID))

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

			responseType := "unknown"
			respStatus := "success"

			instrument := func(e error, rt string) {
				if e != nil {
					responseType = "error"
					respStatus = "failure"
					span.AddEvents([]string{"error", "message"},
						[]tracing.EventValue{
							{Str: fmt.Sprintf("%v", err)},
							{Str: "failed to query data source"},
						})
				}
				logger.Debug("Data source queried", "responseType", responseType)
				useDataplane := strings.HasPrefix(responseType, "dataplane-")
				s.metrics.dsRequests.WithLabelValues(respStatus, fmt.Sprintf("%t", useDataplane), firstNode.datasource.Type).Inc()
			}

			resp, err := s.dataService.QueryData(ctx, req)
			if err != nil {
				for _, dn := range nodeGroup {
					vars[dn.refID] = mathexp.Results{Error: MakeQueryError(firstNode.refID, firstNode.datasource.UID, err)}
				}
				instrument(err, "unknown")
				return
			}

			for _, dn := range nodeGroup {
				dataFrames, err := getResponseFrame(resp, dn.refID)
				if err != nil {
					vars[dn.refID] = mathexp.Results{Error: MakeQueryError(dn.refID, dn.datasource.UID, err)}
					instrument(err, "unknown")
					return
				}

				var result mathexp.Results
				responseType, result, err = convertDataFramesToResults(ctx, dataFrames, dn.datasource.Type, s, logger)
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

	pCtx, err := s.pCtxProvider.GetWithDataSource(ctx, dn.datasource.Type, dn.request.User, dn.datasource)
	if err != nil {
		return mathexp.Results{}, err
	}
	span.SetAttributes("datasource.type", dn.datasource.Type, attribute.Key("datasource.type").String(dn.datasource.Type))
	span.SetAttributes("datasource.uid", dn.datasource.UID, attribute.Key("datasource.uid").String(dn.datasource.UID))

	req := &backend.QueryDataRequest{
		PluginContext: pCtx,
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
			span.AddEvents([]string{"error", "message"},
				[]tracing.EventValue{
					{Str: fmt.Sprintf("%v", err)},
					{Str: "failed to query data source"},
				})
		}
		logger.Debug("Data source queried", "responseType", responseType)
		useDataplane := strings.HasPrefix(responseType, "dataplane-")
		s.metrics.dsRequests.WithLabelValues(respStatus, fmt.Sprintf("%t", useDataplane), dn.datasource.Type).Inc()
	}()

	resp, err := s.dataService.QueryData(ctx, req)
	if err != nil {
		return mathexp.Results{}, MakeQueryError(dn.refID, dn.datasource.UID, err)
	}

	dataFrames, err := getResponseFrame(resp, dn.refID)
	if err != nil {
		return mathexp.Results{}, MakeQueryError(dn.refID, dn.datasource.UID, err)
	}

	var result mathexp.Results
	responseType, result, err = convertDataFramesToResults(ctx, dataFrames, dn.datasource.Type, s, logger)
	if err != nil {
		err = makeConversionError(dn.refID, err)
	}
	return result, err
}

func getResponseFrame(resp *backend.QueryDataResponse, refID string) (data.Frames, error) {
	response, ok := resp.Responses[refID]
	if !ok {
		// This indicates that the RefID of the request was not included to the response, i.e. some problem in the data source plugin
		keys := make([]string, 0, len(resp.Responses))
		for refID := range resp.Responses {
			keys = append(keys, refID)
		}
		logger.Warn("Can't find response by refID. Return nodata", "responseRefIds", keys)
		return nil, nil
	}

	if response.Error != nil {
		return nil, response.Error
	}
	return response.Frames, nil
}

func convertDataFramesToResults(ctx context.Context, frames data.Frames, datasourceType string, s *Service, logger log.Logger) (string, mathexp.Results, error) {
	if len(frames) == 0 {
		return "no-data", mathexp.Results{Values: mathexp.Values{mathexp.NewNoData()}}, nil
	}

	var dt data.FrameType
	dt, useDataplane, _ := shouldUseDataplane(frames, logger, s.features.IsEnabled(featuremgmt.FlagDisableSSEDataplane))
	if useDataplane {
		logger.Debug("Handling SSE data source query through dataplane", "datatype", dt)
		result, err := handleDataplaneFrames(ctx, s.tracer, dt, frames)
		return fmt.Sprintf("dataplane-%s", dt), result, err
	}

	if isAllFrameVectors(datasourceType, frames) { // Prometheus Specific Handling
		vals, err := framesToNumbers(frames)
		if err != nil {
			return "", mathexp.Results{}, fmt.Errorf("failed to read frames as numbers: %w", err)
		}
		return "vector", mathexp.Results{Values: vals}, nil
	}

	if len(frames) == 1 {
		frame := frames[0]
		// Handle Untyped NoData
		if len(frame.Fields) == 0 {
			return "no-data", mathexp.Results{Values: mathexp.Values{mathexp.NoData{Frame: frame}}}, nil
		}

		// Handle Numeric Table
		if frame.TimeSeriesSchema().Type == data.TimeSeriesTypeNot && isNumberTable(frame) {
			numberSet, err := extractNumberSet(frame)
			if err != nil {
				return "", mathexp.Results{}, err
			}
			vals := make([]mathexp.Value, 0, len(numberSet))
			for _, n := range numberSet {
				vals = append(vals, n)
			}
			return "number set", mathexp.Results{
				Values: vals,
			}, nil
		}
	}

	filtered := make([]*data.Frame, 0, len(frames))
	totalLen := 0
	for _, frame := range frames {
		schema := frame.TimeSeriesSchema()
		// Check for TimeSeriesTypeNot in InfluxDB queries. A data frame of this type will cause
		// the WideToMany() function to error out, which results in unhealthy alerts.
		// This check should be removed once inconsistencies in data source responses are solved.
		if schema.Type == data.TimeSeriesTypeNot && datasourceType == datasources.DS_INFLUXDB {
			logger.Warn("Ignoring InfluxDB data frame due to missing numeric fields")
			continue
		}
		if schema.Type != data.TimeSeriesTypeWide {
			return "", mathexp.Results{}, fmt.Errorf("input data must be a wide series but got type %s (input refid)", schema.Type)
		}
		filtered = append(filtered, frame)
		totalLen += len(schema.ValueIndices)
	}

	if len(filtered) == 0 {
		return "no data", mathexp.Results{Values: mathexp.Values{mathexp.NoData{Frame: frames[0]}}}, nil
	}

	maybeFixerFn := checkIfSeriesNeedToBeFixed(filtered, datasourceType)

	vals := make([]mathexp.Value, 0, totalLen)
	for _, frame := range filtered {
		series, err := WideToMany(frame, maybeFixerFn)
		if err != nil {
			return "", mathexp.Results{}, err
		}
		for _, ser := range series {
			vals = append(vals, ser)
		}
	}
	dataType := "single frame series"
	if len(filtered) > 1 {
		dataType = "multi frame series"
	}
	return dataType, mathexp.Results{
		Values: vals,
	}, nil
}

func isAllFrameVectors(datasourceType string, frames data.Frames) bool {
	if datasourceType != datasources.DS_PROMETHEUS {
		return false
	}
	allVector := false
	for i, frame := range frames {
		if frame.Meta != nil && frame.Meta.Custom != nil {
			if sMap, ok := frame.Meta.Custom.(map[string]string); ok {
				if sMap != nil {
					if sMap["resultType"] == "vector" {
						if i != 0 && !allVector {
							break
						}
						allVector = true
					}
				}
			}
		}
	}
	return allVector
}

func framesToNumbers(frames data.Frames) ([]mathexp.Value, error) {
	vals := make([]mathexp.Value, 0, len(frames))
	for _, frame := range frames {
		if frame == nil {
			continue
		}
		if len(frame.Fields) == 2 && frame.Fields[0].Len() == 1 {
			// Can there be zero Len Field results that are being skipped?
			valueField := frame.Fields[1]
			if valueField.Type().Numeric() { // should be []float64
				val, err := valueField.FloatAt(0) // FloatAt should not err if numeric
				if err != nil {
					return nil, fmt.Errorf("failed to read value of frame [%v] (RefID %v) of type [%v] as float: %w", frame.Name, frame.RefID, valueField.Type(), err)
				}
				n := mathexp.NewNumber(frame.Name, valueField.Labels)
				n.SetValue(&val)
				vals = append(vals, n)
			}
		}
	}
	return vals, nil
}

func isNumberTable(frame *data.Frame) bool {
	if frame == nil || frame.Fields == nil {
		return false
	}
	numericCount := 0
	stringCount := 0
	otherCount := 0
	for _, field := range frame.Fields {
		fType := field.Type()
		switch {
		case fType.Numeric():
			numericCount++
		case fType == data.FieldTypeString || fType == data.FieldTypeNullableString:
			stringCount++
		default:
			otherCount++
		}
	}
	return numericCount == 1 && otherCount == 0
}

func extractNumberSet(frame *data.Frame) ([]mathexp.Number, error) {
	numericField := 0
	stringFieldIdxs := []int{}
	stringFieldNames := []string{}
	for i, field := range frame.Fields {
		fType := field.Type()
		switch {
		case fType.Numeric():
			numericField = i
		case fType == data.FieldTypeString || fType == data.FieldTypeNullableString:
			stringFieldIdxs = append(stringFieldIdxs, i)
			stringFieldNames = append(stringFieldNames, field.Name)
		}
	}
	numbers := make([]mathexp.Number, frame.Rows())

	for rowIdx := 0; rowIdx < frame.Rows(); rowIdx++ {
		val, _ := frame.FloatAt(numericField, rowIdx)
		var labels data.Labels
		for i := 0; i < len(stringFieldIdxs); i++ {
			if i == 0 {
				labels = make(data.Labels)
			}
			key := stringFieldNames[i] // TODO check for duplicate string column names
			val, _ := frame.ConcreteAt(stringFieldIdxs[i], rowIdx)
			labels[key] = val.(string) // TODO check assertion / return error
		}

		n := mathexp.NewNumber(frame.Fields[numericField].Name, labels)

		// The new value fields' configs gets pointed to the one in the original frame
		n.Frame.Fields[0].Config = frame.Fields[numericField].Config
		n.SetValue(&val)

		numbers[rowIdx] = n
	}
	return numbers, nil
}

// WideToMany converts a data package wide type Frame to one or multiple Series. A series
// is created for each value type column of wide frame.
//
// This might not be a good idea long term, but works now as an adapter/shim.
func WideToMany(frame *data.Frame, fixSeries func(series mathexp.Series, valueField *data.Field)) ([]mathexp.Series, error) {
	tsSchema := frame.TimeSeriesSchema()
	if tsSchema.Type != data.TimeSeriesTypeWide {
		return nil, fmt.Errorf("input data must be a wide series but got type %s", tsSchema.Type)
	}

	if len(tsSchema.ValueIndices) == 1 {
		s, err := mathexp.SeriesFromFrame(frame)
		if err != nil {
			return nil, err
		}
		if fixSeries != nil {
			fixSeries(s, frame.Fields[tsSchema.ValueIndices[0]])
		}
		return []mathexp.Series{s}, nil
	}

	series := make([]mathexp.Series, 0, len(tsSchema.ValueIndices))
	for _, valIdx := range tsSchema.ValueIndices {
		l := frame.Rows()
		f := data.NewFrameOfFieldTypes(frame.Name, l, frame.Fields[tsSchema.TimeIndex].Type(), frame.Fields[valIdx].Type())
		f.Fields[0].Name = frame.Fields[tsSchema.TimeIndex].Name
		f.Fields[1].Name = frame.Fields[valIdx].Name

		// The new value fields' configs gets pointed to the one in the original frame
		f.Fields[1].Config = frame.Fields[valIdx].Config

		if frame.Fields[valIdx].Labels != nil {
			f.Fields[1].Labels = frame.Fields[valIdx].Labels.Copy()
		}
		for i := 0; i < l; i++ {
			f.SetRow(i, frame.Fields[tsSchema.TimeIndex].CopyAt(i), frame.Fields[valIdx].CopyAt(i))
		}
		s, err := mathexp.SeriesFromFrame(f)
		if err != nil {
			return nil, err
		}
		if fixSeries != nil {
			fixSeries(s, frame.Fields[valIdx])
		}
		series = append(series, s)
	}

	return series, nil
}

// checkIfSeriesNeedToBeFixed scans all value fields of all provided frames and determines whether the resulting mathexp.Series
// needs to be updated so each series could be identifiable by labels.
// NOTE: applicable only to only datasources.DS_GRAPHITE and datasources.DS_TESTDATA data sources
// returns a function that patches the mathexp.Series with information from data.Field from which it was created if the all series need to be fixed. Otherwise, returns nil
func checkIfSeriesNeedToBeFixed(frames []*data.Frame, datasourceType string) func(series mathexp.Series, valueField *data.Field) {
	if !(datasourceType == datasources.DS_GRAPHITE || datasourceType == datasources.DS_TESTDATA) {
		return nil
	}

	// get all value fields
	var valueFields []*data.Field
	for _, frame := range frames {
		tsSchema := frame.TimeSeriesSchema()
		for _, index := range tsSchema.ValueIndices {
			field := frame.Fields[index]
			// if at least one value field contains labels, the result does not need to be fixed.
			if len(field.Labels) > 0 {
				return nil
			}
			if valueFields == nil {
				valueFields = make([]*data.Field, 0, len(frames)*len(tsSchema.ValueIndices))
			}
			valueFields = append(valueFields, field)
		}
	}

	// selectors are in precedence order.
	nameSelectors := []func(f *data.Field) string{
		func(f *data.Field) string {
			if f == nil || f.Config == nil {
				return ""
			}
			return f.Config.DisplayNameFromDS
		},
		func(f *data.Field) string {
			if f == nil || f.Config == nil {
				return ""
			}
			return f.Config.DisplayName
		},
		func(f *data.Field) string {
			return f.Name
		},
	}

	// now look for the first selector that would make all value fields be unique
	for _, selector := range nameSelectors {
		names := make(map[string]struct{}, len(valueFields))
		good := true
		for _, field := range valueFields {
			name := selector(field)
			if _, ok := names[name]; ok || name == "" {
				good = false
				break
			}
			names[name] = struct{}{}
		}
		if good {
			return func(series mathexp.Series, valueField *data.Field) {
				series.SetLabels(data.Labels{
					nameLabelName: selector(valueField),
				})
			}
		}
	}
	return nil
}
