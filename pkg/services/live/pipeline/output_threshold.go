package pipeline

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ThresholdOutputConfig struct {
	FieldName string `json:"fieldName"`
	Channel   string `json:"channel"`
}

//go:generate mockgen -destination=output_threshold_mock.go -package=pipeline github.com/grafana/grafana/pkg/services/live/pipeline FrameGetSetter,FrameProcessor

type FrameGetSetter interface {
	Get(orgID int64, channel string) (*data.Frame, bool, error)
	Set(orgID int64, channel string, frame *data.Frame) error
}

type FrameProcessor interface {
	ProcessFrame(ctx context.Context, orgID int64, channelID string, frame *data.Frame) error
}

// ThresholdOutput can monitor threshold transitions of the specified field and output
// special state frame to the configured channel.
type ThresholdOutput struct {
	frameStorage   FrameGetSetter
	frameProcessor FrameProcessor
	config         ThresholdOutputConfig
}

func NewThresholdOutput(frameStorage FrameGetSetter, pipeline FrameProcessor, config ThresholdOutputConfig) *ThresholdOutput {
	return &ThresholdOutput{frameStorage: frameStorage, frameProcessor: pipeline, config: config}
}

func (l *ThresholdOutput) Output(_ context.Context, vars OutputVars, frame *data.Frame) error {
	if frame == nil {
		return nil
	}
	previousFrame, previousFrameOk, err := l.frameStorage.Get(vars.OrgID, l.config.Channel)
	if err != nil {
		return err
	}
	fieldName := l.config.FieldName

	currentFrameFieldIndex := -1
	for i, f := range frame.Fields {
		if f.Name == fieldName {
			currentFrameFieldIndex = i
		}
	}
	if currentFrameFieldIndex < 0 {
		return nil
	}
	if frame.Fields[currentFrameFieldIndex].Config == nil {
		return nil
	}
	if frame.Fields[currentFrameFieldIndex].Config.Thresholds == nil {
		return nil
	}

	mode := frame.Fields[currentFrameFieldIndex].Config.Thresholds.Mode
	if mode != data.ThresholdsModeAbsolute {
		return fmt.Errorf("unsupported threshold mode: %s", mode)
	}

	if len(frame.Fields[currentFrameFieldIndex].Config.Thresholds.Steps) == 0 {
		return nil
	}

	var previousState *string
	if previousFrameOk {
		previousStateString, ok := previousFrame.Fields[2].At(previousFrame.Fields[2].Len() - 1).(string)
		if !ok {
			return fmt.Errorf("can't convert state to string")
		}
		previousState = &previousStateString
	}

	for i := 0; i < frame.Fields[currentFrameFieldIndex].Len(); i++ {
		// TODO: support other numeric types.
		value, ok := frame.Fields[currentFrameFieldIndex].At(i).(*float64)
		if !ok {
			return nil
		}
		if value == nil {
			// TODO: what should we do here?
			return nil
		}
		var currentThreshold data.Threshold
		for _, threshold := range frame.Fields[currentFrameFieldIndex].Config.Thresholds.Steps {
			if *value >= float64(threshold.Value) {
				currentThreshold = threshold
				continue
			}
			break
		}
		if previousState == nil || currentThreshold.State != *previousState {
			stateFrame := generateStateFrame(time.Now(), *value, currentThreshold.State, currentThreshold.Color)
			_ = l.frameStorage.Set(vars.OrgID, l.config.Channel, stateFrame)
			// TODO: create single frame.
			err := l.frameProcessor.ProcessFrame(context.Background(), vars.OrgID, l.config.Channel, stateFrame)
			if err != nil {
				return err
			}
			previousState = &currentThreshold.State
		}
	}

	return nil
}

func generateStateFrame(tm time.Time, value float64, state string, color string) *data.Frame {
	fTime := data.NewFieldFromFieldType(data.FieldTypeTime, 1)
	fTime.Name = "time"
	fTime.Set(0, tm)
	f1 := data.NewFieldFromFieldType(data.FieldTypeFloat64, 1)
	f1.Set(0, value)
	f1.Name = "value"
	f2 := data.NewFieldFromFieldType(data.FieldTypeString, 1)
	f2.Set(0, state)
	f2.Name = "state"
	f3 := data.NewFieldFromFieldType(data.FieldTypeString, 1)
	f3.Set(0, color)
	f3.Name = "color"
	return data.NewFrame("state", fTime, f1, f2, f3)
}
