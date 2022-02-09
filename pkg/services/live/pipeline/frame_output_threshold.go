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

//go:generate mockgen -destination=frame_output_threshold_mock.go -package=pipeline github.com/grafana/grafana/pkg/services/live/pipeline FrameGetSetter

type FrameGetSetter interface {
	Get(orgID int64, channel string) (*data.Frame, bool, error)
	Set(orgID int64, channel string, frame *data.Frame) error
}

// ThresholdOutput can monitor threshold transitions of the specified field and output
// special state frame to the configured channel.
type ThresholdOutput struct {
	frameStorage FrameGetSetter
	config       ThresholdOutputConfig
}

func NewThresholdOutput(frameStorage FrameGetSetter, config ThresholdOutputConfig) *ThresholdOutput {
	return &ThresholdOutput{frameStorage: frameStorage, config: config}
}

const FrameOutputTypeThreshold = "threshold"

func (out *ThresholdOutput) Type() string {
	return FrameOutputTypeThreshold
}

func (out *ThresholdOutput) OutputFrame(_ context.Context, vars Vars, frame *data.Frame) ([]*ChannelFrame, error) {
	if frame == nil {
		return nil, nil
	}
	previousFrame, previousFrameOk, err := out.frameStorage.Get(vars.OrgID, out.config.Channel)
	if err != nil {
		return nil, err
	}
	fieldName := out.config.FieldName

	currentFrameFieldIndex := -1
	for i, f := range frame.Fields {
		if f.Name == fieldName {
			currentFrameFieldIndex = i
		}
	}
	if currentFrameFieldIndex < 0 {
		return nil, nil
	}
	if frame.Fields[currentFrameFieldIndex].Config == nil {
		return nil, nil
	}
	if frame.Fields[currentFrameFieldIndex].Config.Thresholds == nil {
		return nil, nil
	}

	mode := frame.Fields[currentFrameFieldIndex].Config.Thresholds.Mode
	if mode != data.ThresholdsModeAbsolute {
		return nil, fmt.Errorf("unsupported threshold mode: %s", mode)
	}

	if len(frame.Fields[currentFrameFieldIndex].Config.Thresholds.Steps) == 0 {
		return nil, nil
	}

	previousFrameFieldIndex := -1
	if previousFrameOk {
		for i, f := range previousFrame.Fields {
			if f.Name == fieldName {
				previousFrameFieldIndex = i
			}
		}
	}

	var previousState *string
	if previousFrameOk && previousFrameFieldIndex >= 0 {
		var previousThreshold data.Threshold
		value, ok := previousFrame.Fields[previousFrameFieldIndex].At(previousFrame.Fields[0].Len() - 1).(*float64)
		if !ok {
			return nil, nil
		}
		if value == nil {
			// TODO: what should we do here?
			return nil, nil
		}
		emptyState := ""
		previousState = &emptyState
		for _, threshold := range frame.Fields[currentFrameFieldIndex].Config.Thresholds.Steps {
			if *value >= float64(threshold.Value) {
				previousThreshold = threshold
				previousState = &previousThreshold.State
				continue
			}
			break
		}
	}

	fTime := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	fTime.Name = "time"
	f1 := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
	f1.Name = "value"
	f2 := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	f2.Name = "state"
	f3 := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	f3.Name = "color"

	for i := 0; i < frame.Fields[currentFrameFieldIndex].Len(); i++ {
		// TODO: support other numeric types.
		value, ok := frame.Fields[currentFrameFieldIndex].At(i).(*float64)
		if !ok {
			return nil, nil
		}
		if value == nil {
			// TODO: what should we do here?
			return nil, nil
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
			fTime.Append(time.Now())
			f1.Append(*value)
			f2.Append(currentThreshold.State)
			f3.Append(currentThreshold.Color)
			previousState = &currentThreshold.State
		}
	}

	if fTime.Len() > 0 {
		stateFrame := data.NewFrame("state", fTime, f1, f2, f3)
		err := out.frameStorage.Set(vars.OrgID, out.config.Channel, frame)
		if err != nil {
			return nil, err
		}
		return []*ChannelFrame{{
			Channel: out.config.Channel,
			Frame:   stateFrame,
		}}, nil
	}

	return nil, out.frameStorage.Set(vars.OrgID, out.config.Channel, frame)
}
