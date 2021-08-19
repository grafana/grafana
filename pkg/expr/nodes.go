package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/log"

	"gonum.org/v1/gonum/graph/simple"
)

var (
	logger = log.New("expr")
)

// baseNode includes commmon properties used across DPNodes.
type baseNode struct {
	id    int64
	refID string
}

type rawNode struct {
	RefID         string `json:"refId"`
	Query         map[string]interface{}
	QueryType     string
	TimeRange     TimeRange
	DatasourceUID string
}

func (rn *rawNode) GetDatasourceName() (string, error) {
	rawDs, ok := rn.Query["datasource"]
	if !ok {
		return "", nil
	}
	dsName, ok := rawDs.(string)
	if !ok {
		return "", fmt.Errorf("expted datasource identifier to be a string, got %T", rawDs)
	}
	return dsName, nil
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

// Execute runs the node and adds the results to vars. If the node requires
// other nodes they must have already been executed and their results must
// already by in vars.
func (gn *CMDNode) Execute(ctx context.Context, vars mathexp.Vars, s *Service) (mathexp.Results, error) {
	return gn.Command.Execute(ctx, vars)
}

func buildCMDNode(dp *simple.DirectedGraph, rn *rawNode) (*CMDNode, error) {
	commandType, err := rn.GetCommandType()
	if err != nil {
		return nil, fmt.Errorf("invalid expression command type in '%v'", rn.RefID)
	}

	node := &CMDNode{
		baseNode: baseNode{
			id:    dp.NewNode().ID(),
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
	default:
		return nil, fmt.Errorf("expression command type '%v' in '%v' not implemented", commandType, rn.RefID)
	}
	if err != nil {
		return nil, err
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
	query         json.RawMessage
	datasourceID  int64
	datasourceUID string

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

func (s *Service) buildDSNode(dp *simple.DirectedGraph, rn *rawNode, req *Request) (*DSNode, error) {
	encodedQuery, err := json.Marshal(rn.Query)
	if err != nil {
		return nil, err
	}

	dsNode := &DSNode{
		baseNode: baseNode{
			id:    dp.NewNode().ID(),
			refID: rn.RefID,
		},
		orgID:      req.OrgId,
		query:      json.RawMessage(encodedQuery),
		queryType:  rn.QueryType,
		intervalMS: defaultIntervalMS,
		maxDP:      defaultMaxDP,
		timeRange:  rn.TimeRange,
		request:    *req,
	}

	rawDsID, ok := rn.Query["datasourceId"]
	switch ok {
	case true:
		floatDsID, ok := rawDsID.(float64)
		if !ok {
			return nil, fmt.Errorf("expected datasourceId to be a float64, got type %T for refId %v", rawDsID, rn.RefID)
		}
		dsNode.datasourceID = int64(floatDsID)
	default:
		if rn.DatasourceUID == "" {
			return nil, fmt.Errorf("neither datasourceId or datasourceUid in expression data source request for refId %v", rn.RefID)
		}
		dsNode.datasourceUID = rn.DatasourceUID
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

// Execute runs the node and adds the results to vars. If the node requires
// other nodes they must have already been executed and their results must
// already by in vars.
func (dn *DSNode) Execute(ctx context.Context, vars mathexp.Vars, s *Service) (mathexp.Results, error) {
	pc := backend.PluginContext{
		OrgID: dn.orgID,
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			ID:  dn.datasourceID,
			UID: dn.datasourceUID,
		},
	}

	q := []backend.DataQuery{
		{
			RefID:         dn.refID,
			MaxDataPoints: dn.maxDP,
			Interval:      time.Duration(int64(time.Millisecond) * dn.intervalMS),
			JSON:          dn.query,
			TimeRange: backend.TimeRange{
				From: dn.timeRange.From,
				To:   dn.timeRange.To,
			},
			QueryType: dn.queryType,
		},
	}

	resp, err := s.queryData(ctx, &backend.QueryDataRequest{
		PluginContext: pc,
		Queries:       q,
		Headers:       dn.request.Headers,
	})

	if err != nil {
		return mathexp.Results{}, err
	}

	vals := make([]mathexp.Value, 0)
	for refID, qr := range resp.Responses {
		if qr.Error != nil {
			return mathexp.Results{}, fmt.Errorf("failed to execute query %v: %w", refID, qr.Error)
		}

		if len(qr.Frames) == 1 {
			frame := qr.Frames[0]
			if frame.TimeSeriesSchema().Type == data.TimeSeriesTypeNot && isNumberTable(frame) {
				logger.Debug("expression datasource query (numberSet)", "query", refID)
				numberSet, err := extractNumberSet(frame)
				if err != nil {
					return mathexp.Results{}, err
				}
				for _, n := range numberSet {
					vals = append(vals, n)
				}

				return mathexp.Results{
					Values: vals,
				}, nil
			}
		}

		for _, frame := range qr.Frames {
			logger.Debug("expression datasource query (seriesSet)", "query", refID)
			series, err := WideToMany(frame)
			if err != nil {
				return mathexp.Results{}, err
			}
			for _, s := range series {
				vals = append(vals, s)
			}
		}
	}
	return mathexp.Results{
		Values: vals,
	}, nil
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

		n := mathexp.NewNumber("", labels)
		n.SetValue(&val)
		numbers[rowIdx] = n
	}
	return numbers, nil
}

// WideToMany converts a data package wide type Frame to one or multiple Series. A series
// is created for each value type column of wide frame.
//
// This might not be a good idea long term, but works now as an adapter/shim.
func WideToMany(frame *data.Frame) ([]mathexp.Series, error) {
	tsSchema := frame.TimeSeriesSchema()
	if tsSchema.Type != data.TimeSeriesTypeWide {
		return nil, fmt.Errorf("input data must be a wide series but got type %s (input refid)", tsSchema.Type)
	}

	if len(tsSchema.ValueIndices) == 1 {
		s, err := mathexp.SeriesFromFrame(frame)
		if err != nil {
			return nil, err
		}
		return []mathexp.Series{s}, nil
	}

	series := []mathexp.Series{}
	for _, valIdx := range tsSchema.ValueIndices {
		l := frame.Rows()
		f := data.NewFrameOfFieldTypes(frame.Name, l, frame.Fields[tsSchema.TimeIndex].Type(), frame.Fields[valIdx].Type())
		f.Fields[0].Name = frame.Fields[tsSchema.TimeIndex].Name
		f.Fields[1].Name = frame.Fields[valIdx].Name
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
		series = append(series, s)
	}

	return series, nil
}
