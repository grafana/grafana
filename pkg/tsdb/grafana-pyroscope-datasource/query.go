package pyroscope

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/grafana/grafana/pkg/tsdb/grafana-pyroscope-datasource/kinds/dataquery"
	"github.com/xlab/treeprint"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
)

type queryModel struct {
	WithStreaming bool
	dataquery.GrafanaPyroscopeDataQuery
}

type dsJsonModel struct {
	MinStep string `json:"minStep"`
}

const (
	queryTypeProfile = string(dataquery.PyroscopeQueryTypeProfile)
	queryTypeMetrics = string(dataquery.PyroscopeQueryTypeMetrics)
	queryTypeBoth    = string(dataquery.PyroscopeQueryTypeBoth)
)

// query processes single Pyroscope query transforming the response to data.Frame packaged in DataResponse
func (d *PyroscopeDatasource) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.pyroscope.query", trace.WithAttributes(attribute.String("query_type", query.QueryType)))
	defer span.End()

	var qm queryModel
	response := backend.DataResponse{}

	err := json.Unmarshal(query.JSON, &qm)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		response.Error = fmt.Errorf("error unmarshaling query model: %v", err)
		return response
	}

	profileTypeId := qm.ProfileTypeId
	labelSelector := qm.LabelSelector

	responseMutex := sync.Mutex{}
	g, gCtx := errgroup.WithContext(ctx)
	if query.QueryType == queryTypeMetrics || query.QueryType == queryTypeBoth {
		g.Go(func() error {
			var dsJson dsJsonModel
			err = json.Unmarshal(pCtx.DataSourceInstanceSettings.JSONData, &dsJson)
			if err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, err.Error())
				return fmt.Errorf("error unmarshaling datasource json model: %v", err)
			}

			parsedInterval := time.Second * 15
			if dsJson.MinStep != "" {
				parsedInterval, err = gtime.ParseDuration(dsJson.MinStep)
				if err != nil {
					parsedInterval = time.Second * 15
					logger.Error("Failed to parse the MinStep using default", "MinStep", dsJson.MinStep, "function", logEntrypoint())
				}
			}
			logger.Debug("Sending SelectSeriesRequest", "queryModel", qm, "function", logEntrypoint())
			seriesResp, err := d.client.GetSeries(
				gCtx,
				profileTypeId,
				labelSelector,
				query.TimeRange.From.UnixMilli(),
				query.TimeRange.To.UnixMilli(),
				qm.GroupBy,
				qm.Limit,
				math.Max(query.Interval.Seconds(), parsedInterval.Seconds()),
			)
			if err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, err.Error())
				logger.Error("Querying SelectSeries()", "err", err, "function", logEntrypoint())
				return err
			}
			// add the frames to the response.
			responseMutex.Lock()
			frames, err := seriesToDataFrames(seriesResp)
			if err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, err.Error())
				logger.Error("Querying SelectSeries()", "err", err, "function", logEntrypoint())
				return err
			}
			response.Frames = append(response.Frames, frames...)
			responseMutex.Unlock()
			return nil
		})
	}

	if query.QueryType == queryTypeProfile || query.QueryType == queryTypeBoth {
		g.Go(func() error {
			var profileResp *ProfileResponse
			if len(qm.SpanSelector) > 0 {
				logger.Debug("Calling GetSpanProfile", "queryModel", qm, "function", logEntrypoint())
				prof, err := d.client.GetSpanProfile(gCtx, profileTypeId, labelSelector, qm.SpanSelector, query.TimeRange.From.UnixMilli(), query.TimeRange.To.UnixMilli(), qm.MaxNodes)
				if err != nil {
					span.RecordError(err)
					span.SetStatus(codes.Error, err.Error())
					logger.Error("Error GetSpanProfile()", "err", err, "function", logEntrypoint())
					return err
				}
				profileResp = prof
			} else {
				logger.Debug("Calling GetProfile", "queryModel", qm, "function", logEntrypoint())
				prof, err := d.client.GetProfile(gCtx, profileTypeId, labelSelector, query.TimeRange.From.UnixMilli(), query.TimeRange.To.UnixMilli(), qm.MaxNodes)
				if err != nil {
					span.RecordError(err)
					span.SetStatus(codes.Error, err.Error())
					logger.Error("Error GetProfile()", "err", err, "function", logEntrypoint())
					return err
				}
				profileResp = prof
			}

			var frame *data.Frame
			if profileResp != nil {
				frame = responseToDataFrames(profileResp)

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
			} else {
				// We still send empty data frame to give feedback that query really run, just didn't return any data.
				frame = getEmptyDataFrame()
			}
			responseMutex.Lock()
			response.Frames = append(response.Frames, frame)
			responseMutex.Unlock()

			return nil
		})
	}

	if err := g.Wait(); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		response.Error = g.Wait()
	}

	return response
}

// responseToDataFrames turns Pyroscope response to data.Frame. We encode the data into a nested set format where we have
// [level, value, label] columns and by ordering the items in a depth first traversal order we can recreate the whole
// tree back.
func responseToDataFrames(resp *ProfileResponse) *data.Frame {
	tree := levelsToTree(resp.Flamebearer.Levels, resp.Flamebearer.Names)
	return treeToNestedSetDataFrame(tree, resp.Units)
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
// dataframe. This should be temporary, and ideally we should get some sort of tree struct directly from Pyroscope API.
func levelsToTree(levels []*Level, names []string) *ProfileTree {
	if len(levels) == 0 {
		return nil
	}

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
	for currentLevel < len(levels) {
		// If we still have levels to go, this should not happen. Something is probably wrong with the flamebearer data.
		if len(parentsStack) == 0 {
			logger.Error("ParentsStack is empty but we are not at the last level", "currentLevel", currentLevel, "function", logEntrypoint())
			break
		}

		var nextParentsStack []*ProfileTree
		currentParent := parentsStack[:1][0]
		parentsStack = parentsStack[1:]
		itemIndex := 0
		// cumulative offset as items in flamebearer format have just relative to prev item
		offset := int64(0)

		// Cycle through bar in a level
		for itemIndex < len(levels[currentLevel].Values) {
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
					logger.Error("ParentsStack is empty but there are still items in current level", "currentLevel", currentLevel, "itemIndex", itemIndex, "function", logEntrypoint())
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
							nodes: n.Nodes, Tree: current.AddBranch(fmt.Sprintf("%s: level %d self %d total %d", n.Name, n.Level, n.Self, n.Value)),
						},
					)
				} else {
					current.AddNode(fmt.Sprintf("%s: level %d self %d total %d", n.Name, n.Level, n.Self, n.Value))
				}
			}
		}
	}
	return tree.String()
}

func getEmptyDataFrame() *data.Frame {
	var emptyProfileDataFrame = data.NewFrame("response")
	emptyProfileDataFrame.Meta = &data.FrameMeta{PreferredVisualization: "flamegraph"}
	emptyProfileDataFrame.Fields = data.Fields{
		data.NewField("level", nil, []int64{}),
		data.NewField("value", nil, []int64{}),
		data.NewField("self", nil, []int64{}),
		data.NewField("label", nil, []string{}),
	}
	return emptyProfileDataFrame
}

type CustomMeta struct {
	ProfileTypeID string
}

// treeToNestedSetDataFrame walks the tree depth first and adds items into the dataframe. This is a nested set format
// where ordering the items in depth first order and knowing the level/depth of each item we can recreate the
// parent - child relationship without explicitly needing parent/child column, and we can later just iterate over the
// dataFrame to again basically walking depth first over the tree/profile.
func treeToNestedSetDataFrame(tree *ProfileTree, unit string) *data.Frame {
	frame := data.NewFrame("response")
	frame.Meta = &data.FrameMeta{PreferredVisualization: "flamegraph"}

	levelField := data.NewField("level", nil, []int64{})
	valueField := data.NewField("value", nil, []int64{})
	selfField := data.NewField("self", nil, []int64{})

	// profileTypeID should encode the type of the profile with unit being the 3rd part
	valueField.Config = &data.FieldConfig{Unit: unit}
	selfField.Config = &data.FieldConfig{Unit: unit}
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
	valuesMap map[string]data.EnumItemIndex
	counter   data.EnumItemIndex
}

func NewEnumField(name string, labels data.Labels) *EnumField {
	return &EnumField{
		field:     data.NewField(name, labels, []data.EnumItemIndex{}),
		valuesMap: make(map[string]data.EnumItemIndex),
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

	for len(stack) != 0 {
		fn(stack[0])
		if stack[0].Nodes != nil {
			stack = append(stack[0].Nodes, stack[1:]...)
		} else {
			stack = stack[1:]
		}
	}
}

type ProfileAnnotations struct {
	Bodies []string `json:"bodies"`
}

func seriesToDataFrames(resp *SeriesResponse) ([]*data.Frame, error) {
	frames := make([]*data.Frame, 0, len(resp.Series))

	for _, series := range resp.Series {
		// We create separate data frames as the series may not have the same length
		frame := data.NewFrame("series")
		frame.Meta = &data.FrameMeta{PreferredVisualization: "graph"}

		fields := make(data.Fields, 0, 3)
		timeField := data.NewField("time", nil, []time.Time{})
		fields = append(fields, timeField)

		labels := make(map[string]string)
		for _, label := range series.Labels {
			labels[label.Name] = label.Value
		}

		valueField := data.NewField(resp.Label, labels, []float64{})
		valueField.Config = &data.FieldConfig{Unit: resp.Units}

		annotationsField := data.NewField("annotations", nil, []json.RawMessage{})

		for _, point := range series.Points {
			timeField.Append(time.UnixMilli(point.Timestamp))
			valueField.Append(point.Value)
			annotations := ProfileAnnotations{Bodies: make([]string, 0, len(point.Annotations))}
			for _, annotation := range point.Annotations {
				annotations.Bodies = append(annotations.Bodies, annotation.Value)
			}
			encoded, err := json.Marshal(annotations)
			if err != nil {
				return nil, err
			}
			annotationsField.Append(json.RawMessage(encoded))
		}

		fields = append(fields, valueField, annotationsField)
		frame.Fields = fields
		frames = append(frames, frame)
	}
	return frames, nil
}
