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
		logger.Debug("Sending SelectMergeStacktracesRequest", "request", req, "queryModel", qm)
		resp, err := d.client.SelectMergeStacktraces(ctx, req)
		if err != nil {
			logger.Error("Querying SelectMergeStacktraces()", "err", err)
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

func makeRequest(qm queryModel, query backend.DataQuery) *connect.Request[querierv1.SelectMergeStacktracesRequest] {
	return &connect.Request[querierv1.SelectMergeStacktracesRequest]{
		Msg: &querierv1.SelectMergeStacktracesRequest{
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
func responseToDataFrames(resp *querierv1.SelectMergeStacktracesResponse, profileTypeID string) *data.Frame {
	tree := levelsToTree(resp.Flamegraph.Levels, resp.Flamegraph.Names)
	return treeToNestedSetDataFrame(tree, profileTypeID)
}

// START_OFFSET is offset of the bar relative to previous sibling
const START_OFFSET = 0

// VALUE_OFFSET is value or width of the bar
const VALUE_OFFSET = 1

// SELF_OFFSET is self value of the bar
const SELF_OFFSET = 2

// NAME_OFFSET is index into the names array
const NAME_OFFSET = 3

// ITEM_OFFSET Next bar. Each bar of the profile is represented by 4 number in a flat array.
const ITEM_OFFSET = 4

type ProfileTree struct {
	Start int64
	Value int64
	Self  int64
	Level int
	Name  string
	Nodes []*ProfileTree
}

// levelsToTree converts flamebearer format into a tree. This is needed to then convert it into nested set format
// dataframe. This should be temporary, and ideally we should get some sort of tree struct directly from Phlare API.
func levelsToTree(levels []*querierv1.Level, names []string) *ProfileTree {
	tree := &ProfileTree{
		Start: 0,
		Value: levels[0].Values[VALUE_OFFSET],
		Self:  levels[0].Values[SELF_OFFSET],
		Level: 0,
		Name:  names[levels[0].Values[0]],
	}

	parentsStack := []*ProfileTree{tree}
	currentLevel := 1

	// Cycle through each level
	for {
		if currentLevel >= len(levels) {
			break
		}

		// If we still have levels to go, this should not happen. Something is probably wrong with the flamebearer data.
		if len(parentsStack) == 0 {
			logger.Error("parentsStack is empty but we are not at the the last level", "currentLevel", currentLevel)
			break
		}

		var nextParentsStack []*ProfileTree
		currentParent := parentsStack[:1][0]
		parentsStack = parentsStack[1:]
		itemIndex := 0
		// cumulative offset as items in flamebearer format have just relative to prev item
		offset := int64(0)

		// Cycle through bar in a level
		for {
			if itemIndex >= len(levels[currentLevel].Values) {
				break
			}

			itemStart := levels[currentLevel].Values[itemIndex+START_OFFSET] + offset
			itemValue := levels[currentLevel].Values[itemIndex+VALUE_OFFSET]
			selfValue := levels[currentLevel].Values[itemIndex+SELF_OFFSET]
			itemEnd := itemStart + itemValue
			parentEnd := currentParent.Start + currentParent.Value

			if itemStart >= currentParent.Start && itemEnd <= parentEnd {
				// We have an item that is in the bounds of current parent item, so it should be its child
				treeItem := &ProfileTree{
					Start: itemStart,
					Value: itemValue,
					Self:  selfValue,
					Level: currentLevel,
					Name:  names[levels[currentLevel].Values[itemIndex+NAME_OFFSET]],
				}
				// Add to parent
				currentParent.Nodes = append(currentParent.Nodes, treeItem)
				// Add this item as parent for the next level
				nextParentsStack = append(nextParentsStack, treeItem)
				itemIndex += ITEM_OFFSET

				// Update offset for next item. This is changing relative offset to absolute one.
				offset = itemEnd
			} else {
				// We went out of parents bounds so lets move to next parent. We will evaluate the same item again, but
				// we will check if it is a child of the next parent item in line.
				if len(parentsStack) == 0 {
					logger.Error("parentsStack is empty but there are still items in current level", "currentLevel", currentLevel, "itemIndex", itemIndex)
					break
				}
				currentParent = parentsStack[:1][0]
				parentsStack = parentsStack[1:]
				continue
			}
		}
		parentsStack = nextParentsStack
		currentLevel++
	}

	return tree
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
		b := tree.AddBranch(fmt.Sprintf("%s: level %d self %d total %d", n.Name, n.Level, n.Self, n.Value))
		remaining := append([]*branch{}, &branch{nodes: n.Nodes, Tree: b})
		for len(remaining) > 0 {
			current := remaining[0]
			remaining = remaining[1:]
			for _, n := range current.nodes {
				if len(n.Nodes) > 0 {
					remaining = append(remaining,
						&branch{
							nodes: n.Nodes, Tree: current.Tree.AddBranch(fmt.Sprintf("%s: level %d self %d total %d", n.Name, n.Level, n.Self, n.Value)),
						},
					)
				} else {
					current.Tree.AddNode(fmt.Sprintf("%s: level %d self %d total %d", n.Name, n.Level, n.Self, n.Value))
				}
			}
		}
	}
	return tree.String()
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
	frame.Fields = data.Fields{levelField, valueField, selfField}

	labelField := NewEnumField("label", nil)

	// Tree can be nil if profile was empty, we can still send empty frame in that case
	if tree != nil {
		walkTree(tree, func(tree *ProfileTree) {
			levelField.Append(int64(tree.Level))
			valueField.Append(tree.Value)
			selfField.Append(tree.Self)
			labelField.Append(tree.Name)
		})
	}

	frame.Fields = append(frame.Fields, labelField.GetField())
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
