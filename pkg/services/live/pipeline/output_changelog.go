package pipeline

import (
	"context"
	"reflect"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ChangeLogOutputConfig struct {
	FieldName string `json:"fieldName"`
	Channel   string `json:"channel"`
}

type ChangeLogOutput struct {
	frameStorage *FrameStorage
	pipeline     *Pipeline
	config       ChangeLogOutputConfig
}

func NewChangeLogOutput(frameStorage *FrameStorage, pipeline *Pipeline, config ChangeLogOutputConfig) *ChangeLogOutput {
	return &ChangeLogOutput{frameStorage: frameStorage, pipeline: pipeline, config: config}
}

func (l ChangeLogOutput) Output(_ context.Context, vars OutputVars, frame *data.Frame) error {
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

	fieldName := l.config.FieldName

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
			return l.pipeline.ProcessFrame(context.Background(), vars.OrgID, l.config.Channel, changeFrame)
		}
	}
	return nil
}

// frame1 value 0, 1, 2
// frame2 value 3, 4

// frame1 value 0
// frame2 value 1
// frame1 value 2
// frame2 value 3
// frame1 value 4
