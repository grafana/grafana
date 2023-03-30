package phlare

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/grafana/grafana/pkg/tsdb/phlare/kinds/dataquery"
	googlev1 "github.com/grafana/phlare/api/gen/proto/go/google/v1"
	querierv1 "github.com/grafana/phlare/api/gen/proto/go/querier/v1"
	"github.com/xlab/treeprint"
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
		frame := responseToDataFrames(resp.Msg, qm.ProfileTypeId)
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
func responseToDataFrames(prof *googlev1.Profile, profileTypeID string) *data.Frame {
	tree := profileAsTree(prof)
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

func (pt *ProfileTree) String() string {
	type branch struct {
		nodes []*ProfileTree
		treeprint.Tree
	}
	tree := treeprint.New()
	for _, n := range []*ProfileTree{pt} {
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

// addSample adds a sample to the tree. As sample is just a single stack we just have to traverse the tree until it
// starts to differ from the sample and add a new branch if needed. For example if we have a tree:
//
//	root --> func1 -> func2 -> func3
//		 \-> func4
//
// And we add a sample:
//
//	func1 -> func2 -> func5
//
// We will get:
//
//	root --> func1 --> func2 --> func3
//	     \                   \-> func5
//	      \-> func4
//
// While we add the current sample value to root -> func1 -> func2.
func (pt *ProfileTree) addSample(profile *googlev1.Profile, sample *googlev1.Sample) {
	if len(sample.LocationId) == 0 {
		return
	}

	locations := getReversedLocations(profile, sample)

	// Extend root
	pt.Value = pt.Value + sample.Value[0]
	current := pt

	for index, location := range locations {
		if len(current.Nodes) > 0 {
			var foundNode *ProfileTree
			for _, node := range current.Nodes {
				if node.locationID == location.Id {
					foundNode = node
				}
			}

			if foundNode != nil {
				// We found node with the same locationID so just add the value it
				foundNode.Value = foundNode.Value + sample.Value[0]
				current = foundNode
				// Continue to next locationID in the sample
				continue
			}
		}
		// Either current has no children we can compare to or we have location that does not exist yet in the tree.

		// Create sample with only the locations we did not already attributed to the tree.
		subSample := &googlev1.Sample{
			LocationId: sample.LocationId[:len(sample.LocationId)-index],
			Value:      sample.Value,
			Label:      sample.Label,
		}
		newTree := treeFromSample(profile, subSample, index)
		// Append the new subtree in the correct place in the tree
		current.Nodes = append(current.Nodes, newTree.Nodes[0])
		sort.SliceStable(current.Nodes, func(i, j int) bool {
			return current.Nodes[i].Function.String() < current.Nodes[j].Function.String()
		})
		newTree.Nodes[0].Parent = current
		break
	}

	// Adjust self of the current node as we may need to add value to its self if we just extended it and did not
	// add children
	var childrenVal int64 = 0
	for _, node := range current.Nodes {
		childrenVal += node.Value
	}
	current.Self = current.Value - childrenVal
}

// treeFromSample creates a linked tree form a single pprof sample. As a single sample is just a single stack the tree
// will also be just a simple linked list at this point.
func treeFromSample(profile *googlev1.Profile, sample *googlev1.Sample, startLevel int) *ProfileTree {
	root := &ProfileTree{
		Value:      sample.Value[0],
		Level:      startLevel,
		locationID: 0,
		Function: &Function{
			FunctionName: "root",
		},
	}

	if len(sample.LocationId) == 0 {
		// Empty profile
		return root
	}

	locations := getReversedLocations(profile, sample)
	parent := root

	// Loop over locations and add a node to the tree for each location
	for index, location := range locations {
		node := &ProfileTree{
			Self:       0,
			Value:      sample.Value[0],
			Level:      index + startLevel + 1,
			locationID: location.Id,
			Parent:     parent,
		}

		parent.Nodes = []*ProfileTree{node}
		parent = node

		functions := getFunctions(profile, location)
		// Last in the list is the main function
		node.Function = functions[len(functions)-1]
		// If there are more, other are inlined functions
		if len(functions) > 1 {
			node.Inlined = functions[:len(functions)-1]
		}
	}
	// Last parent is a leaf and as it does not have any children it's value is also self
	parent.Self = sample.Value[0]
	return root
}

func profileAsTree(profile *googlev1.Profile) *ProfileTree {
	if profile == nil {
		return nil
	}
	if len(profile.Sample) == 0 {
		return nil
	}
	n := treeFromSample(profile, profile.Sample[0], 0)
	for _, sample := range profile.Sample[1:] {
		n.addSample(profile, sample)
	}
	return n
}

// getReversedLocations returns all locations from a sample. Location is a one level in the stack trace so single row in
// flamegraph. Returned locations are reversed (so root is 0, leaf is len - 1) which makes it easier to the use with
// tree structure starting from root.
func getReversedLocations(profile *googlev1.Profile, sample *googlev1.Sample) []*googlev1.Location {
	locations := make([]*googlev1.Location, len(sample.LocationId))
	for index, locationId := range sample.LocationId {
		// profile.Location[locationId-1] is because locationId (and other IDs) is 1 based, so
		// locationId == array index + 1
		locations[len(sample.LocationId)-1-index] = profile.Location[locationId-1]
	}
	return locations
}

// getFunctions returns all functions for a location. First one is the main function and the rest are inlined functions.
// If there is no info it just returns single placeholder function.
func getFunctions(profile *googlev1.Profile, location *googlev1.Location) []*Function {
	if len(location.Line) == 0 {
		return []*Function{{
			FunctionName: "<unknown>",
			FileName:     "",
			Line:         0,
		}}
	}
	functions := make([]*Function, len(location.Line))

	for index, line := range location.Line {
		function := profile.Function[line.FunctionId-1]

		functions[index] = &Function{
			FunctionName: profile.StringTable[function.Name],
			FileName:     profile.StringTable[function.Filename],
			Line:         line.Line,
		}
	}
	return functions
}

type CustomMeta struct {
	ProfileTypeID string
}

// treeToNestedSetDataFrame walks the tree depth first and adds items into the dataframe. This is a nested set format
// where ordering the items in depth first order and knowing the level/depth of each item we can recreate the
// parent - child relationship without explicitly needing parent/child column, and we can later just iterate over the
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
	lineNumberField := data.NewField("line", nil, []int64{})
	frame.Fields = data.Fields{levelField, valueField, selfField, lineNumberField}

	labelField := NewEnumField("label", nil)
	fileNameField := NewEnumField("fileName", nil)

	// Tree can be nil if profile was empty, we can still send empty frame in that case
	if tree != nil {
		walkTree(tree, func(tree *ProfileTree) {
			levelField.Append(int64(tree.Level))
			valueField.Append(tree.Value)
			selfField.Append(tree.Self)
			// todo: inline functions
			// tree.Inlined
			lineNumberField.Append(tree.Function.Line)
			labelField.Append(tree.Function.FunctionName)
			fileNameField.Append(tree.Function.FileName)
		})
	}

	frame.Fields = append(frame.Fields, labelField.GetField(), fileNameField.GetField())
	return frame
}

type EnumField struct {
	field     *data.Field
	valuesMap map[string]int64
	counter   int64
}

func NewEnumField(name string, labels data.Labels) *EnumField {
	return &EnumField{
		field:     data.NewField(name, labels, []int64{}),
		valuesMap: make(map[string]int64),
	}
}

func (e *EnumField) Append(value string) {
	if valueIndex, ok := e.valuesMap[value]; ok {
		e.field.Append(valueIndex)
	} else {
		e.valuesMap[value] = e.counter
		e.field.Append(e.counter)
		e.counter++
	}
}

func (e *EnumField) GetField() *data.Field {
	s := make([]string, len(e.valuesMap))
	for k, v := range e.valuesMap {
		s[v] = k
	}

	e.field.SetConfig(&data.FieldConfig{
		TypeConfig: &data.FieldTypeConfig{
			Enum: &data.EnumFieldConfig{
				Text: s,
			},
		},
	})

	return e.field
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
