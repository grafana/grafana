package phlare

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/grafana/grafana/pkg/tsdb/phlare/kinds/dataquery"
	"github.com/xlab/treeprint"

	googlev1 "github.com/grafana/phlare/api/gen/proto/go/google/v1"
	querierv1 "github.com/grafana/phlare/api/gen/proto/go/querier/v1"
)

type queryModel struct {
	WithStreaming bool
	dataquery.PhlareDataQuery
}

type dsJsonModel struct {
	MinStep string `json:"minStep"`
}

const (
	queryTypeProfile = string(dataquery.PhlareQueryTypeProfile)
	queryTypeMetrics = string(dataquery.PhlareQueryTypeMetrics)
	queryTypeBoth    = string(dataquery.PhlareQueryTypeBoth)
)

// query processes single Phlare query transforming the response to data.Frame packaged in DataResponse
func (d *PhlareDatasource) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
	var qm queryModel
	response := backend.DataResponse{}

	err := json.Unmarshal(query.JSON, &qm)
	if err != nil {
		response.Error = fmt.Errorf("error unmarshaling query model: %v", err)
		return response
	}

	if query.QueryType == queryTypeMetrics || query.QueryType == queryTypeBoth {
		var dsJson dsJsonModel
		err = json.Unmarshal(pCtx.DataSourceInstanceSettings.JSONData, &dsJson)
		if err != nil {
			response.Error = fmt.Errorf("error unmarshaling datasource json model: %v", err)
			return response
		}

		parsedInterval := time.Second * 15
		if dsJson.MinStep != "" {
			parsedInterval, err = gtime.ParseDuration(dsJson.MinStep)
			if err != nil {
				parsedInterval = time.Second * 15
				logger.Debug("Failed to parse the MinStep using default", "MinStep", dsJson.MinStep)
			}
		}
		req := connect.NewRequest(&querierv1.SelectSeriesRequest{
			ProfileTypeID: qm.ProfileTypeId,
			LabelSelector: qm.LabelSelector,
			Start:         query.TimeRange.From.UnixMilli(),
			End:           query.TimeRange.To.UnixMilli(),
			Step:          math.Max(query.Interval.Seconds(), parsedInterval.Seconds()),
			GroupBy:       qm.GroupBy,
		})

		logger.Debug("Sending SelectSeriesRequest", "request", req, "queryModel", qm)
		seriesResp, err := d.client.SelectSeries(ctx, req)
		if err != nil {
			logger.Error("Querying SelectSeries()", "err", err)
			response.Error = err
			return response
		}
		// add the frames to the response.
		response.Frames = append(response.Frames, seriesToDataFrames(seriesResp, qm.ProfileTypeId)...)
	}

	if query.QueryType == queryTypeProfile || query.QueryType == queryTypeBoth {
		req := makeRequest(qm, query)
		logger.Debug("Sending SelectMergeProfile", "request", req, "queryModel", qm)
		resp, err := d.client.SelectMergeProfile(ctx, req)
		if err != nil {
			logger.Error("Querying SelectMergeProfile()", "err", err)
			response.Error = err
			return response
		}
		frame := responseToDataFrames(resp, qm.ProfileTypeId)
		response.Frames = append(response.Frames, frame)

		// If query called with streaming on then return a channel
		// to subscribe on a client-side and consume updates from a plugin.
		// Feel free to remove this if you don't need streaming for your datasource.
		if qm.WithStreaming {
			channel := live.Channel{
				Scope:     live.ScopeDatasource,
				Namespace: pCtx.DataSourceInstanceSettings.UID,
				Path:      "stream",
			}
			frame.SetMeta(&data.FrameMeta{Channel: channel.String()})
		}
	}

	return response
}

func makeRequest(qm queryModel, query backend.DataQuery) *connect.Request[querierv1.SelectMergeProfileRequest] {
	return &connect.Request[querierv1.SelectMergeProfileRequest]{
		Msg: &querierv1.SelectMergeProfileRequest{
			ProfileTypeID: qm.ProfileTypeId,
			LabelSelector: qm.LabelSelector,
			Start:         query.TimeRange.From.UnixMilli(),
			End:           query.TimeRange.To.UnixMilli(),
		},
	}
}

// responseToDataFrames turns Phlare response to data.Frame. We encode the data into a nested set format where we have
// [level, value, label] columns and by ordering the items in a depth first traversal order we can recreate the whole
// tree back.
func responseToDataFrames(resp *connect.Response[googlev1.Profile], profileTypeID string) *data.Frame {
	tree := profileAsTree(resp.Msg)
	return treeToNestedSetDataFrame(tree, profileTypeID)
}

type ProfileTree struct {
	Level      int
	Value      int64
	Self       int64
	Function   *Function
	Inlined    []*Function
	locationID uint64

	Nodes  []*ProfileTree
	Parent *ProfileTree
}

type Function struct {
	FunctionName string
	FileName     string // optional
	Line         int64  // optional
}

func (f Function) String() string {
	return fmt.Sprintf("%s:%s:%d", f.FileName, f.FunctionName, f.Line)
}

func (pt ProfileTree) String() string {
	type branch struct {
		nodes []*ProfileTree
		treeprint.Tree
	}
	tree := treeprint.New()
	for _, n := range []ProfileTree{pt} {
		b := tree.AddBranch(fmt.Sprintf("%s: level %d self %d total %d", n.Function, n.Level, n.Self, n.Value))
		remaining := append([]*branch{}, &branch{nodes: n.Nodes, Tree: b})
		for len(remaining) > 0 {
			current := remaining[0]
			remaining = remaining[1:]
			for _, n := range current.nodes {
				if len(n.Nodes) > 0 {
					remaining = append(remaining,
						&branch{
							nodes: n.Nodes, Tree: current.Tree.AddBranch(fmt.Sprintf("%s: level %d self %d total %d", n.Function, n.Level, n.Self, n.Value)),
						},
					)
				} else {
					current.Tree.AddNode(fmt.Sprintf("%s: level %d self %d total %d", n.Function, n.Level, n.Self, n.Value))
				}
			}
		}
	}
	return tree.String()
}

// merge merges the node into the tree.
// it assumes src has only one leaf.
func (pt *ProfileTree) merge(src *ProfileTree) {
	// find the node path where n should be inserted.
	var parent, found *ProfileTree
	// visit depth first the dst tree following the src tree
	remaining := []*ProfileTree{pt}
	for len(remaining) > 0 {
		n := remaining[0]
		remaining = remaining[1:]
		if src.locationID == n.locationID {
			if len(src.Nodes) == 0 {
				// we have found the leaf
				found = n
				break
			}
			// move src and last parent visited
			parent = n
			src = src.Nodes[0]
			remaining = n.Nodes
			continue
		}
	}
	if found == nil {
		if parent == nil {
			// Nothing in common can't be merged.
			return
		}
		src.Parent = parent
		parent.Nodes = append(parent.Nodes, src)
		for p := parent; p != nil; p = p.Parent {
			p.Value = p.Value + src.Value
		}
		return
	}
	found.Value = found.Value + src.Self
	for p := found.Parent; p != nil; p = p.Parent {
		p.Value = p.Value + src.Self
	}
	found.Self = found.Self + src.Self
}

func treeFromSample(profile *googlev1.Profile, sample *googlev1.Sample) *ProfileTree {
	if len(sample.LocationId) == 0 {
		return &ProfileTree{
			Level: 0,
			Value: sample.Value[0],
			Function: &Function{
				FunctionName: "root",
			},
		}
	}

	// The leaf is at locations[0].
	locations := sample.LocationId

	current := &ProfileTree{
		Self:  sample.Value[0],
		Level: 0,
	}
	for len(locations) > 0 {
		current.locationID = locations[0]
		current.Value = sample.Value[0]
		current.Level = len(locations)

		// Ids in pprof format are 1 based. So to get the index in array from the id we need to subtract one.
		lines := profile.Location[locations[0]-1].Line
		if len(lines) == 0 {
			locations = locations[1:]
			continue
		}
		// The leaf is at lines[len(lines)-1].
		current.Function = &Function{
			FunctionName: profile.StringTable[profile.Function[lines[len(lines)-1].FunctionId-1].Name],
			FileName:     profile.StringTable[profile.Function[lines[len(lines)-1].FunctionId-1].Filename],
			Line:         lines[len(lines)-1].Line,
		}
		lines = lines[:len(lines)-1]

		// If there are more than one line, each line inlined into the next line.
		for len(lines) > 0 {
			current.Inlined = append(current.Inlined, &Function{
				FunctionName: profile.StringTable[profile.Function[lines[0].FunctionId-1].Name],
				FileName:     profile.StringTable[profile.Function[lines[0].FunctionId-1].Filename],
				Line:         lines[0].Line,
			})
			lines = lines[1:]
		}
		parent := &ProfileTree{
			Nodes: []*ProfileTree{current},
		}
		current.Parent = parent
		current = parent
		locations = locations[1:]
	}
	if current.Function == nil {
		current.Function = &Function{
			FunctionName: "root",
		}
		current.Value = sample.Value[0]
		current.locationID = 0
		current.Self = 0
		current.Level = 0
	}
	return current
}

func profileAsTree(profile *googlev1.Profile) *ProfileTree {
	if profile == nil {
		return nil
	}
	if len(profile.Sample) == 0 {
		return nil
	}
	n := treeFromSample(profile, profile.Sample[0])
	for _, sample := range profile.Sample[1:] {
		n.merge(treeFromSample(profile, sample))
	}
	return n
}

type CustomMeta struct {
	ProfileTypeID string
}

// treeToNestedSetDataFrame walks the tree depth first and adds items into the dataframe. This is a nested set format
// where by ordering the items in depth first order and knowing the level/depth of each item we can recreate the
// parent - child relationship without explicitly needing parent/child column and we can later just iterate over the
// dataFrame to again basically walking depth first over the tree/profile.
func treeToNestedSetDataFrame(tree *ProfileTree, profileTypeID string) *data.Frame {
	frame := data.NewFrame("response")
	frame.Meta = &data.FrameMeta{PreferredVisualization: "flamegraph"}

	levelField := data.NewField("level", nil, []int64{})
	valueField := data.NewField("value", nil, []int64{})
	selfField := data.NewField("self", nil, []int64{})

	// profileTypeID should encode the type of the profile with unit being the 3rd part
	parts := strings.Split(profileTypeID, ":")
	valueField.Config = &data.FieldConfig{Unit: normalizeUnit(parts[2])}
	selfField.Config = &data.FieldConfig{Unit: normalizeUnit(parts[2])}
	labelField := data.NewField("label", nil, []string{})
	lineNumberField := data.NewField("line", nil, []int64{})
	fileNameField := data.NewField("fileName", nil, []string{})
	frame.Fields = data.Fields{levelField, valueField, selfField, labelField, lineNumberField, fileNameField}

	walkTree(tree, func(tree *ProfileTree) {
		levelField.Append(int64(tree.Level))
		valueField.Append(tree.Value)
		selfField.Append(tree.Self)
		// todo: inline functions
		// tree.Inlined
		labelField.Append(tree.Function.FunctionName)
		lineNumberField.Append(tree.Function.Line)
		fileNameField.Append(tree.Function.FileName)
	})
	return frame
}

func walkTree(tree *ProfileTree, fn func(tree *ProfileTree)) {
	fn(tree)
	stack := tree.Nodes

	for {
		if len(stack) == 0 {
			break
		}

		fn(stack[0])
		if stack[0].Nodes != nil {
			stack = append(stack[0].Nodes, stack[1:]...)
		} else {
			stack = stack[1:]
		}
	}
}

func seriesToDataFrames(seriesResp *connect.Response[querierv1.SelectSeriesResponse], profileTypeID string) []*data.Frame {
	frames := make([]*data.Frame, 0, len(seriesResp.Msg.Series))

	for _, series := range seriesResp.Msg.Series {
		// We create separate data frames as the series may not have the same length
		frame := data.NewFrame("series")
		frame.Meta = &data.FrameMeta{PreferredVisualization: "graph"}

		fields := make(data.Fields, 0, 2)
		timeField := data.NewField("time", nil, []time.Time{})
		fields = append(fields, timeField)

		label := ""
		unit := ""
		parts := strings.Split(profileTypeID, ":")
		if len(parts) == 5 {
			label = parts[1] // sample type e.g. cpu, goroutine, alloc_objects
			unit = normalizeUnit(parts[2])
		}

		labels := make(map[string]string)
		for _, label := range series.Labels {
			labels[label.Name] = label.Value
		}

		valueField := data.NewField(label, labels, []float64{})
		valueField.Config = &data.FieldConfig{Unit: unit}

		for _, point := range series.Points {
			timeField.Append(time.UnixMilli(point.Timestamp))
			valueField.Append(point.Value)
		}

		fields = append(fields, valueField)
		frame.Fields = fields
		frames = append(frames, frame)
	}
	return frames
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
