package pipeline

import (
	"context"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestThresholdOutput_Output(t *testing.T) {
	type fields struct {
		frameStorage FrameGetSetter
		config       ThresholdOutputConfig
	}
	type args struct {
		in0   context.Context
		vars  Vars
		frame *data.Frame
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr bool
	}{
		{
			name: "nil_input_frame",
			fields: fields{
				frameStorage: nil,
				config: ThresholdOutputConfig{
					Channel: "test",
				},
			},
			args:    args{in0: context.Background(), vars: Vars{}, frame: nil},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := &ThresholdOutput{
				frameStorage: tt.fields.frameStorage,
				config:       tt.fields.config,
			}
			if _, err := l.OutputFrame(tt.args.in0, tt.args.vars, tt.args.frame); (err != nil) != tt.wantErr {
				t.Errorf("OutputFrame() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestThresholdOutput_NoPreviousFrame_SingleRow(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockStorage := NewMockFrameGetSetter(mockCtrl)

	mockStorage.EXPECT().Get(gomock.Any(), gomock.Any()).DoAndReturn(func(orgID int64, channel string) (*data.Frame, bool, error) {
		return nil, false, nil
	})

	mockStorage.EXPECT().Set(gomock.Any(), gomock.Any(), gomock.Any()).Times(1)

	outputter := NewThresholdOutput(mockStorage, ThresholdOutputConfig{
		FieldName: "test",
		Channel:   "stream/test/no_previous_frame",
	})

	f1 := data.NewField("time", nil, make([]time.Time, 1))
	f1.Set(0, time.Now())

	f2 := data.NewField("test", nil, make([]*float64, 1))
	f2.SetConcrete(0, 20.0)
	f2.Config = &data.FieldConfig{
		Thresholds: &data.ThresholdsConfig{
			Mode: data.ThresholdsModeAbsolute,
			Steps: []data.Threshold{
				{
					Value: 10,
					State: "normal",
					Color: "green",
				},
			},
		},
	}

	frame := data.NewFrame("test", f1, f2)

	channelFrames, err := outputter.OutputFrame(context.Background(), Vars{}, frame)
	require.NoError(t, err)

	require.Len(t, channelFrames, 1)
	stateFrame := channelFrames[0].Frame
	require.Len(t, stateFrame.Fields, 4)
	require.Equal(t, 20.0, stateFrame.Fields[1].At(0))
	require.Equal(t, "normal", stateFrame.Fields[2].At(0))
	require.Equal(t, "green", stateFrame.Fields[3].At(0))
}

func TestThresholdOutput_NoPreviousFrame_MultipleRows(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockStorage := NewMockFrameGetSetter(mockCtrl)

	mockStorage.EXPECT().Get(gomock.Any(), gomock.Any()).DoAndReturn(func(orgID int64, channel string) (*data.Frame, bool, error) {
		return nil, false, nil
	}).Times(1)

	mockStorage.EXPECT().Set(gomock.Any(), gomock.Any(), gomock.Any()).Times(1)

	outputter := NewThresholdOutput(mockStorage, ThresholdOutputConfig{
		FieldName: "test",
		Channel:   "stream/test/no_previous_frame",
	})

	f1 := data.NewField("time", nil, make([]time.Time, 2))
	f1.Set(0, time.Now())
	f1.Set(1, time.Now())

	f2 := data.NewField("test", nil, make([]*float64, 2))
	f2.SetConcrete(0, 5.0)
	f2.SetConcrete(1, 20.0)

	f2.Config = &data.FieldConfig{
		Thresholds: &data.ThresholdsConfig{
			Mode: data.ThresholdsModeAbsolute,
			Steps: []data.Threshold{
				{
					Value: 10,
					State: "normal",
					Color: "green",
				},
			},
		},
	}

	frame := data.NewFrame("test", f1, f2)

	channelFrames, err := outputter.OutputFrame(context.Background(), Vars{}, frame)
	require.NoError(t, err)
	require.Len(t, channelFrames, 1)

	stateFrame := channelFrames[0].Frame

	require.Len(t, stateFrame.Fields, 4)
	require.Equal(t, 5.0, stateFrame.Fields[1].At(0))
	require.Equal(t, "", stateFrame.Fields[2].At(0))
	require.Equal(t, "", stateFrame.Fields[3].At(0))

	require.Equal(t, 20.0, stateFrame.Fields[1].At(1))
	require.Equal(t, "normal", stateFrame.Fields[2].At(1))
	require.Equal(t, "green", stateFrame.Fields[3].At(1))
}

func TestThresholdOutput_WithPreviousFrame_SingleRow(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockStorage := NewMockFrameGetSetter(mockCtrl)

	mockStorage.EXPECT().Get(gomock.Any(), gomock.Any()).DoAndReturn(func(orgID int64, channel string) (*data.Frame, bool, error) {
		f1 := data.NewField("time", nil, make([]time.Time, 1))
		f1.Set(0, time.Now())
		f2 := data.NewField("test", nil, make([]*float64, 1))
		f2.SetConcrete(0, 20.0)
		frame := data.NewFrame("test", f1, f2)
		return frame, true, nil
	}).Times(1)

	mockStorage.EXPECT().Set(gomock.Any(), gomock.Any(), gomock.Any()).Times(1)

	outputter := NewThresholdOutput(mockStorage, ThresholdOutputConfig{
		FieldName: "test",
		Channel:   "stream/test/with_previous_frame",
	})

	f1 := data.NewField("time", nil, make([]time.Time, 1))
	f1.Set(0, time.Now())

	f2 := data.NewField("test", nil, make([]*float64, 1))
	f2.SetConcrete(0, 20.0)

	f2.Config = &data.FieldConfig{
		Thresholds: &data.ThresholdsConfig{
			Mode: data.ThresholdsModeAbsolute,
			Steps: []data.Threshold{
				{
					Value: 10,
					State: "normal",
					Color: "green",
				},
			},
		},
	}

	frame := data.NewFrame("test", f1, f2)

	channelFrames, err := outputter.OutputFrame(context.Background(), Vars{}, frame)
	require.NoError(t, err)
	require.Len(t, channelFrames, 0)
}

func TestThresholdOutput_WithPreviousFrame_MultipleRows(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockStorage := NewMockFrameGetSetter(mockCtrl)

	mockStorage.EXPECT().Get(gomock.Any(), gomock.Any()).DoAndReturn(func(orgID int64, channel string) (*data.Frame, bool, error) {
		f1 := data.NewField("time", nil, make([]time.Time, 1))
		f1.Set(0, time.Now())
		f2 := data.NewField("test", nil, make([]*float64, 1))
		f2.SetConcrete(0, 20.0)
		frame := data.NewFrame("test", f1, f2)
		return frame, true, nil
	}).Times(1)

	mockStorage.EXPECT().Set(gomock.Any(), gomock.Any(), gomock.Any()).Times(1)

	outputter := NewThresholdOutput(mockStorage, ThresholdOutputConfig{
		FieldName: "test",
		Channel:   "stream/test/with_previous_frame",
	})

	f1 := data.NewField("time", nil, make([]time.Time, 2))
	f1.Set(0, time.Now())
	f1.Set(1, time.Now())

	f2 := data.NewField("test", nil, make([]*float64, 2))
	f2.SetConcrete(0, 5.0)
	f2.SetConcrete(1, 20.0)

	f2.Config = &data.FieldConfig{
		Thresholds: &data.ThresholdsConfig{
			Mode: data.ThresholdsModeAbsolute,
			Steps: []data.Threshold{
				{
					Value: 10,
					State: "normal",
					Color: "green",
				},
			},
		},
	}

	frame := data.NewFrame("test", f1, f2)

	channelFrames, err := outputter.OutputFrame(context.Background(), Vars{}, frame)
	require.NoError(t, err)
	require.Len(t, channelFrames, 1)
}
