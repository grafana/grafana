package pushhttp

import (
	"context"
	"fmt"
	"reflect"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/live/pipeline"
)

type ConditionChecker interface {
	CheckCondition(ctx context.Context, frame *data.Frame) (bool, error)
}

type Float64CompareCondition struct {
	FieldName string
	Op        string
	Value     float64
}

func (f Float64CompareCondition) CheckCondition(ctx context.Context, frame *data.Frame) (bool, error) {
	for _, field := range frame.Fields {
		if field.Name == f.FieldName && (field.Type() == data.FieldTypeNullableFloat64) {
			value, ok := field.At(0).(*float64)
			if !ok {
				return false, fmt.Errorf("unexpected value type: %T", field.At(0))
			}
			if value != nil && *value >= f.Value {
				return true, nil
			}
		}
	}
	return false, nil
}

func NewFloat64CompareCondition(fieldName string, op string, value float64) *Float64CompareCondition {
	return &Float64CompareCondition{FieldName: fieldName, Op: op, Value: value}
}

type ChannelOutputConfig struct {
	Channel    string
	Conditions []ConditionChecker
}

type ChannelOutput struct {
	ruleProcessor *RuleProcessor
	config        ChannelOutputConfig
}

func NewChannelOutput(ruleProcessor *RuleProcessor, config ChannelOutputConfig) *ChannelOutput {
	return &ChannelOutput{ruleProcessor: ruleProcessor, config: config}
}

func (l ChannelOutput) Output(ctx context.Context, vars pipeline.OutputVars, frame *data.Frame) error {
	for _, c := range l.config.Conditions {
		ok, err := c.CheckCondition(ctx, frame)
		if err != nil {
			return err
		}
		if !ok {
			return nil
		}
	}
	return l.ruleProcessor.ProcessFrame(context.Background(), vars.OrgID, l.config.Channel, frame)
}

type LiveChangeLogOutputConfig struct {
	Fields  []string
	Channel string
}

type LiveChangeLogOutput struct {
	frameStorage  *FrameStorage
	ruleProcessor *RuleProcessor
	config        LiveChangeLogOutputConfig
}

func NewLiveChangeLogOutput(frameStorage *FrameStorage, ruleProcessor *RuleProcessor, config LiveChangeLogOutputConfig) *LiveChangeLogOutput {
	return &LiveChangeLogOutput{frameStorage: frameStorage, ruleProcessor: ruleProcessor, config: config}
}

func (l LiveChangeLogOutput) Output(_ context.Context, vars pipeline.OutputVars, frame *data.Frame) error {
	previousFrame, ok, err := l.frameStorage.Get(vars.OrgID, l.config.Channel)
	defer func() {
		_ = l.frameStorage.Put(vars.OrgID, l.config.Channel, frame)
	}()
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}

	for _, fieldName := range l.config.Fields {
		previousFrameFieldIndex := -1
		currentFrameFieldIndex := -1

		for i, f := range previousFrame.Fields {
			if f.Name == fieldName {
				previousFrameFieldIndex = i
			}
		}
		for i, f := range frame.Fields {
			if f.Name == fieldName {
				currentFrameFieldIndex = i
			}
		}

		if previousFrameFieldIndex >= 0 && currentFrameFieldIndex >= 0 {
			if !reflect.DeepEqual(
				previousFrame.Fields[previousFrameFieldIndex].At(0),
				frame.Fields[currentFrameFieldIndex].At(0),
			) {
				fTime := data.NewFieldFromFieldType(data.FieldTypeTime, 1)
				fTime.Name = "time"
				fTime.Set(0, time.Now())
				f1 := data.NewFieldFromFieldType(previousFrame.Fields[previousFrameFieldIndex].Type(), 1)
				f1.Set(0, previousFrame.Fields[previousFrameFieldIndex].At(0))
				f1.Name = "old"
				f2 := data.NewFieldFromFieldType(frame.Fields[currentFrameFieldIndex].Type(), 1)
				f2.Set(0, frame.Fields[currentFrameFieldIndex].At(0))
				f2.Name = "new"
				changeFrame := data.NewFrame("change", fTime, f1, f2)
				return l.ruleProcessor.ProcessFrame(context.Background(), vars.OrgID, l.config.Channel, changeFrame)
			}
		}
	}
	return nil
}
