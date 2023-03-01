package parca

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	v1alpha1 "buf.build/gen/go/parca-dev/parca/protocolbuffers/go/parca/query/v1alpha1"
	"github.com/bufbuild/connect-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/parca/kinds/dataquery"
	"google.golang.org/protobuf/types/known/timestamppb"
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
	var qm queryModel
	response := backend.DataResponse{}

	err := json.Unmarshal(query.JSON, &qm)
	if err != nil {
		response.Error = err
		return response
	}

	if query.QueryType == queryTypeMetrics || query.QueryType == queryTypeBoth {
		seriesResp, err := d.client.QueryRange(ctx, makeMetricRequest(qm, query))
		if err != nil {
			response.Error = err
			return response
		}
		response.Frames = append(response.Frames, seriesToDataFrame(seriesResp, qm.ProfileTypeId)...)
	}

	if query.QueryType == queryTypeProfile || query.QueryType == queryTypeBoth {
		logger.Debug("Querying SelectMergeStacktraces()", "queryModel", qm)
		resp, err := d.client.Query(ctx, makeProfileRequest(qm, query))
		if err != nil {
			response.Error = err
			return response
		}
		frame := responseToDataFrames(resp)
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
					Query: fmt.Sprintf("%s%s", qm.ProfileTypeId, qm.LabelSelector),
					Start: &timestamppb.Timestamp{
						Seconds: query.TimeRange.From.Unix(),
					},
					End: &timestamppb.Timestamp{
						Seconds: query.TimeRange.To.Unix(),
					},
				},
			},
			// We should change this to QueryRequest_REPORT_TYPE_FLAMEGRAPH_TABLE later on
			// nolint:staticcheck
			ReportType: v1alpha1.QueryRequest_REPORT_TYPE_FLAMEGRAPH_UNSPECIFIED,
		},
	}
}

func makeMetricRequest(qm queryModel, query backend.DataQuery) *connect.Request[v1alpha1.QueryRangeRequest] {
	return &connect.Request[v1alpha1.QueryRangeRequest]{
		Msg: &v1alpha1.QueryRangeRequest{
			Query: fmt.Sprintf("%s%s", qm.ProfileTypeId, qm.LabelSelector),
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
func responseToDataFrames(resp *connect.Response[v1alpha1.QueryResponse]) *data.Frame {
	if flameResponse, ok := resp.Msg.Report.(*v1alpha1.QueryResponse_Flamegraph); ok {
		frame := treeToNestedSetDataFrame(flameResponse.Flamegraph)
		frame.Meta = &data.FrameMeta{PreferredVisualization: "flamegraph"}
		return frame
	} else {
		panic("unknown report type returned from query")
	}
}

// treeToNestedSetDataFrame walks the tree depth first and adds items into the dataframe. This is a nested set format
// where by ordering the items in depth first order and knowing the level/depth of each item we can recreate the
// parent - child relationship without explicitly needing parent/child column and we can later just iterate over the
// dataFrame to again basically walking depth first over the tree/profile.
func treeToNestedSetDataFrame(tree *v1alpha1.Flamegraph) *data.Frame {
	frame := data.NewFrame("response")

	levelField := data.NewField("level", nil, []int64{})
	valueField := data.NewField("value", nil, []int64{})
	valueField.Config = &data.FieldConfig{Unit: normalizeUnit(tree.Unit)}
	selfField := data.NewField("self", nil, []int64{})
	selfField.Config = &data.FieldConfig{Unit: normalizeUnit(tree.Unit)}
	labelField := data.NewField("label", nil, []string{})
	frame.Fields = data.Fields{levelField, valueField, selfField, labelField}

	walkTree(tree.Root, func(level int64, value int64, name string, self int64) {
		levelField.Append(level)
		valueField.Append(value)
		labelField.Append(name)
		selfField.Append(self)
	})
	return frame
}

type Node struct {
	Node  *v1alpha1.FlamegraphNode
	Level int64
}

func walkTree(tree *v1alpha1.FlamegraphRootNode, fn func(level int64, value int64, name string, self int64)) {
	stack := make([]*Node, 0, len(tree.Children))
	var childrenValue int64 = 0

	for _, child := range tree.Children {
		childrenValue += child.Cumulative
		stack = append(stack, &Node{Node: child, Level: 1})
	}

	fn(0, tree.Cumulative, "total", tree.Cumulative-childrenValue)

	for {
		if len(stack) == 0 {
			break
		}

		// shift stack
		node := stack[0]
		stack = stack[1:]
		childrenValue = 0

		if node.Node.Children != nil {
			var children []*Node
			for _, child := range node.Node.Children {
				childrenValue += child.Cumulative
				children = append(children, &Node{Node: child, Level: node.Level + 1})
			}
			// Put the children first so we do depth first traversal
			stack = append(children, stack...)
		}
		fn(node.Level, node.Node.Cumulative, nodeName(node.Node), node.Node.Cumulative-childrenValue)
	}
}

func nodeName(node *v1alpha1.FlamegraphNode) string {
	if node.Meta == nil {
		return "<unknown>"
	}

	mapping := ""
	if node.Meta.Mapping != nil && node.Meta.Mapping.File != "" {
		mapping = "[" + getLastItem(node.Meta.Mapping.File) + "] "
	}

	if node.Meta.Function != nil && node.Meta.Function.Name != "" {
		return mapping + node.Meta.Function.Name
	}

	address := ""
	if node.Meta.Location != nil {
		address = fmt.Sprintf("0x%x", node.Meta.Location.Address)
	}

	if mapping == "" && address == "" {
		return "<unknown>"
	} else {
		return mapping + address
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
