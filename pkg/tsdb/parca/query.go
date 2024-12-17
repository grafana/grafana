package parca

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	v1alpha1 "buf.build/gen/go/parca-dev/parca/protocolbuffers/go/parca/query/v1alpha1"
	"connectrpc.com/connect"
	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/ipc"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/grafana/grafana/pkg/tsdb/parca/kinds/dataquery"
)

type queryModel struct {
	dataquery.ParcaDataQuery
}

const (
	queryTypeProfile = string(dataquery.ParcaQueryTypeProfile)
	queryTypeMetrics = string(dataquery.ParcaQueryTypeMetrics)
	queryTypeBoth    = string(dataquery.ParcaQueryTypeBoth)
)

// query processes single Parca query transforming the response to data.Frame packaged in DataResponse
func (d *ParcaDatasource) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
	ctxLogger := logger.FromContext(ctx)
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.parca.query", trace.WithAttributes(attribute.String("query_type", query.QueryType)))
	defer span.End()

	var qm queryModel
	response := backend.DataResponse{}

	err := json.Unmarshal(query.JSON, &qm)
	if err != nil {
		response.Error = err
		ctxLogger.Error("Failed to unmarshall query", "error", err, "function", logEntrypoint())
		span.RecordError(response.Error)
		span.SetStatus(codes.Error, response.Error.Error())
		return response
	}

	if query.QueryType == queryTypeMetrics || query.QueryType == queryTypeBoth {
		seriesResp, err := d.client.QueryRange(ctx, makeMetricRequest(qm, query))
		if err != nil {
			response.Error = err
			ctxLogger.Error("Failed to process query", "error", err, "queryType", query.QueryType, "function", logEntrypoint())
			span.RecordError(response.Error)
			span.SetStatus(codes.Error, response.Error.Error())
			return response
		}

		response.Frames = append(response.Frames, seriesToDataFrame(seriesResp, utils.Depointerizer(qm.ProfileTypeId))...)
	}

	if query.QueryType == queryTypeProfile || query.QueryType == queryTypeBoth {
		ctxLogger.Debug("Querying SelectMergeStacktraces()", "queryModel", qm, "function", logEntrypoint())
		resp, err := d.client.Query(ctx, makeProfileRequest(qm, query))
		if err != nil {
			if strings.Contains(err.Error(), "invalid report type") {
				response.Error = fmt.Errorf("try updating Parca to v0.19+: %v", err)
			} else {
				response.Error = err
			}

			ctxLogger.Error("Failed to process query", "error", err, "queryType", query.QueryType, "function", logEntrypoint())
			span.RecordError(response.Error)
			span.SetStatus(codes.Error, response.Error.Error())
			return response
		}
		frame, err := responseToDataFrames(resp)
		if err != nil {
			response.Error = err
			ctxLogger.Error("Failed to convert the response to a data frame", "error", err, "queryType", query.QueryType)
			span.RecordError(response.Error)
			span.SetStatus(codes.Error, response.Error.Error())
			return response
		}
		response.Frames = append(response.Frames, frame)
	}

	return response
}

func makeProfileRequest(qm queryModel, query backend.DataQuery) *connect.Request[v1alpha1.QueryRequest] {
	return &connect.Request[v1alpha1.QueryRequest]{
		Msg: &v1alpha1.QueryRequest{
			Mode: v1alpha1.QueryRequest_MODE_MERGE,
			Options: &v1alpha1.QueryRequest_Merge{
				Merge: &v1alpha1.MergeProfile{
					Query: fmt.Sprintf("%s%s", utils.Depointerizer(qm.ProfileTypeId), utils.Depointerizer(qm.LabelSelector)),
					Start: &timestamppb.Timestamp{
						Seconds: query.TimeRange.From.Unix(),
					},
					End: &timestamppb.Timestamp{
						Seconds: query.TimeRange.To.Unix(),
					},
				},
			},
			// nolint:staticcheck
			ReportType: v1alpha1.QueryRequest_REPORT_TYPE_FLAMEGRAPH_ARROW,
		},
	}
}

func makeMetricRequest(qm queryModel, query backend.DataQuery) *connect.Request[v1alpha1.QueryRangeRequest] {
	return &connect.Request[v1alpha1.QueryRangeRequest]{
		Msg: &v1alpha1.QueryRangeRequest{
			Query: fmt.Sprintf("%s%s", utils.Depointerizer(qm.ProfileTypeId), utils.Depointerizer(qm.LabelSelector)),
			Start: &timestamppb.Timestamp{
				Seconds: query.TimeRange.From.Unix(),
			},
			End: &timestamppb.Timestamp{
				Seconds: query.TimeRange.To.Unix(),
			},
			Limit: uint32(query.MaxDataPoints),
		},
	}
}

type CustomMeta struct {
	ProfileTypeID string
}

// responseToDataFrames turns Parca response to data.Frame. We encode the data into a nested set format where we have
// [level, value, label] columns and by ordering the items in a depth first traversal order we can recreate the whole
// tree back.
func responseToDataFrames(resp *connect.Response[v1alpha1.QueryResponse]) (*data.Frame, error) {
	if flameResponse, ok := resp.Msg.Report.(*v1alpha1.QueryResponse_FlamegraphArrow); ok {
		return arrowToNestedSetDataFrame(flameResponse.FlamegraphArrow)
	} else {
		return nil, fmt.Errorf("unknown report type returned from query. update parca")
	}
}

func seriesToDataFrame(seriesResp *connect.Response[v1alpha1.QueryRangeResponse], profileTypeID string) []*data.Frame {
	frames := make([]*data.Frame, 0, len(seriesResp.Msg.Series))

	for _, series := range seriesResp.Msg.Series {
		frame := data.NewFrame("series")
		frame.Meta = &data.FrameMeta{PreferredVisualization: "graph"}
		frames = append(frames, frame)

		fields := data.Fields{}
		timeField := data.NewField("time", nil, []time.Time{})
		fields = append(fields, timeField)

		labels := data.Labels{}
		for _, label := range series.Labelset.Labels {
			labels[label.Name] = label.Value
		}

		valueField := data.NewField(strings.Split(profileTypeID, ":")[1], labels, []int64{})

		for _, sample := range series.Samples {
			timeField.Append(sample.Timestamp.AsTime())
			valueField.Append(sample.Value)
		}

		fields = append(fields, valueField)
		frame.Fields = fields
	}

	return frames
}

func arrowToNestedSetDataFrame(flamegraph *v1alpha1.FlamegraphArrow) (*data.Frame, error) {
	frame := data.NewFrame("response")
	frame.Meta = &data.FrameMeta{PreferredVisualization: "flamegraph"}

	levelField := data.NewField("level", nil, []int64{})
	valueField := data.NewField("value", nil, []int64{})
	valueField.Config = &data.FieldConfig{Unit: normalizeUnit(flamegraph.Unit)}
	selfField := data.NewField("self", nil, []int64{})
	selfField.Config = &data.FieldConfig{Unit: normalizeUnit(flamegraph.Unit)}
	labelField := data.NewField("label", nil, []string{})
	frame.Fields = data.Fields{levelField, valueField, selfField, labelField}

	arrowReader, err := ipc.NewReader(bytes.NewBuffer(flamegraph.GetRecord()))
	if err != nil {
		return nil, err
	}
	defer arrowReader.Release()

	arrowReader.Next()
	rec := arrowReader.Record()

	fi, err := newFlamegraphIterator(rec)
	if err != nil {
		return nil, fmt.Errorf("failed to create flamegraph iterator: %w", err)
	}

	fi.iterate(func(name string, level, value, self int64) {
		labelField.Append(name)
		levelField.Append(level)
		valueField.Append(value)
		selfField.Append(self)
	})

	return frame, nil
}

const (
	FlamegraphFieldMappingFile     = "mapping_file"
	FlamegraphFieldLocationAddress = "location_address"
	FlamegraphFieldFunctionName    = "function_name"
	FlamegraphFieldChildren        = "children"
	FlamegraphFieldCumulative      = "cumulative"
	FlamegraphFieldFlat            = "flat"
)

type flamegraphIterator struct {
	columnChildren         *array.List
	columnChildrenValues   *array.Uint32
	columnCumulative       func(i int) int64
	columnMappingFile      *array.Dictionary
	columnMappingFileDict  *array.Binary
	columnFunctionName     *array.Dictionary
	columnFunctionNameDict *array.Binary
	columnLocationAddress  *array.Uint64

	nameBuilder    *bytes.Buffer
	addressBuilder *bytes.Buffer
}

func newFlamegraphIterator(rec arrow.Record) (*flamegraphIterator, error) {
	schema := rec.Schema()

	columnChildren := rec.Column(schema.FieldIndices(FlamegraphFieldChildren)[0]).(*array.List)
	columnChildrenValues := columnChildren.ListValues().(*array.Uint32)
	columnCumulative := uintValue(rec.Column(schema.FieldIndices(FlamegraphFieldCumulative)[0]))

	columnMappingFile := rec.Column(schema.FieldIndices(FlamegraphFieldMappingFile)[0]).(*array.Dictionary)
	columnMappingFileDict := columnMappingFile.Dictionary().(*array.Binary)
	columnFunctionName := rec.Column(schema.FieldIndices(FlamegraphFieldFunctionName)[0]).(*array.Dictionary)
	columnFunctionNameDict := columnFunctionName.Dictionary().(*array.Binary)
	columnLocationAddress := rec.Column(schema.FieldIndices(FlamegraphFieldLocationAddress)[0]).(*array.Uint64)

	return &flamegraphIterator{
		columnChildren:         columnChildren,
		columnChildrenValues:   columnChildrenValues,
		columnCumulative:       columnCumulative,
		columnMappingFile:      columnMappingFile,
		columnMappingFileDict:  columnMappingFileDict,
		columnFunctionName:     columnFunctionName,
		columnFunctionNameDict: columnFunctionNameDict,
		columnLocationAddress:  columnLocationAddress,

		nameBuilder:    &bytes.Buffer{},
		addressBuilder: &bytes.Buffer{},
	}, nil
}

func (fi *flamegraphIterator) iterate(fn func(name string, level, value, self int64)) {
	type rowNode struct {
		row   int
		level int64
	}
	childrenStart, childrenEnd := fi.columnChildren.ValueOffsets(0)
	stack := make([]rowNode, 0, childrenEnd-childrenStart)
	var childrenValue int64 = 0

	for i := int(childrenStart); i < int(childrenEnd); i++ {
		child := int(fi.columnChildrenValues.Value(i))
		childrenValue += fi.columnCumulative(child)
		stack = append(stack, rowNode{row: child, level: 1})
	}

	cumulative := fi.columnCumulative(0)
	fn("total", 0, cumulative, cumulative-childrenValue)

	for {
		if len(stack) == 0 {
			break
		}

		// shift stack
		node := stack[0]
		stack = stack[1:]
		childrenValue = 0

		// Get the children for this node and add them to the stack if they exist.
		start, end := fi.columnChildren.ValueOffsets(node.row)
		children := make([]rowNode, 0, end-start)
		for i := start; i < end; i++ {
			child := fi.columnChildrenValues.Value(int(i))
			if fi.columnChildrenValues.IsValid(int(child)) {
				childrenValue += fi.columnCumulative(int(child))
				children = append(children, rowNode{row: int(child), level: node.level + 1})
			}
		}
		// prepend the new children to the top of the stack
		stack = append(children, stack...)

		cumulative := fi.columnCumulative(node.row)
		name := fi.nodeName(node.row)
		fn(name, node.level, cumulative, cumulative-childrenValue)
	}
}

func (fi *flamegraphIterator) nodeName(row int) string {
	fi.nameBuilder.Reset()
	fi.addressBuilder.Reset()

	if fi.columnMappingFile.IsValid(row) {
		m := fi.columnMappingFileDict.ValueString(fi.columnMappingFile.GetValueIndex(row))
		fi.nameBuilder.WriteString("[")
		fi.nameBuilder.WriteString(getLastItem(m))
		fi.nameBuilder.WriteString("]")
		fi.nameBuilder.WriteString(" ")
	}
	if fi.columnFunctionName.IsValid(row) {
		if f := fi.columnFunctionNameDict.ValueString(fi.columnFunctionName.GetValueIndex(row)); f != "" {
			fi.nameBuilder.WriteString(f)
			return fi.nameBuilder.String()
		}
	}

	if fi.columnLocationAddress.IsValid(row) {
		a := fi.columnLocationAddress.Value(row)
		fi.addressBuilder.WriteString("0x")
		fi.addressBuilder.WriteString(strconv.FormatUint(a, 16))
	}

	if fi.nameBuilder.Len() == 0 && fi.addressBuilder.Len() == 0 {
		return "<unknown>"
	} else {
		return fi.nameBuilder.String() + fi.addressBuilder.String()
	}
}

// uintValue is a wrapper to read different uint sizes.
// Parca returns values encoded depending on the max value in an array.
func uintValue(arr arrow.Array) func(i int) int64 {
	switch b := arr.(type) {
	case *array.Uint64:
		return func(i int) int64 {
			return int64(b.Value(i))
		}
	case *array.Uint32:
		return func(i int) int64 {
			return int64(b.Value(i))
		}
	case *array.Uint16:
		return func(i int) int64 {
			return int64(b.Value(i))
		}
	case *array.Uint8:
		return func(i int) int64 {
			return int64(b.Value(i))
		}
	default:
		panic(fmt.Errorf("unsupported type %T", b))
	}
}

func getLastItem(path string) string {
	parts := strings.Split(path, "/")
	return parts[len(parts)-1]
}

func normalizeUnit(unit string) string {
	if unit == "nanoseconds" {
		return "ns"
	}
	if unit == "count" {
		return "short"
	}
	return unit
}
