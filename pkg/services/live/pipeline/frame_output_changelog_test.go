package pipeline

import (
	"context"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestChangeLogOutput_NoPreviousFrame_SingleRow(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockStorage := NewMockFrameGetSetter(mockCtrl)

	mockStorage.EXPECT().Get(gomock.Any(), gomock.Any()).DoAndReturn(func(orgID int64, channel string) (*data.Frame, bool, error) {
		return nil, false, nil
	})

	mockStorage.EXPECT().Set(gomock.Any(), gomock.Any(), gomock.Any()).Times(1)

	outputter := NewChangeLogFrameOutput(mockStorage, ChangeLogOutputConfig{
		FieldName: "test",
		Channel:   "stream/test/no_previous_frame",
	})

	f1 := data.NewField("time", nil, make([]time.Time, 1))
	f1.Set(0, time.Now())

	f2 := data.NewField("test", nil, make([]*float64, 1))
	f2.SetConcrete(0, 20.0)

	frame := data.NewFrame("test", f1, f2)

	channelFrames, err := outputter.OutputFrame(context.Background(), Vars{}, frame)
	require.NoError(t, err)

	require.Len(t, channelFrames, 1)
	changeFrame := channelFrames[0].Frame
	require.Len(t, changeFrame.Fields, 3)
	var x *float64
	var y = 20.0
	require.Equal(t, x, changeFrame.Fields[1].At(0).(*float64))
	require.Equal(t, &y, changeFrame.Fields[2].At(0))
}

func TestChangeLogOutput_NoPreviousFrame_MultipleRows(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockStorage := NewMockFrameGetSetter(mockCtrl)

	mockStorage.EXPECT().Get(gomock.Any(), gomock.Any()).DoAndReturn(func(orgID int64, channel string) (*data.Frame, bool, error) {
		return nil, false, nil
	}).Times(1)

	mockStorage.EXPECT().Set(gomock.Any(), gomock.Any(), gomock.Any()).Times(1)

	outputter := NewChangeLogFrameOutput(mockStorage, ChangeLogOutputConfig{
		FieldName: "test",
		Channel:   "stream/test/no_previous_frame",
	})

	f1 := data.NewField("time", nil, make([]time.Time, 2))
	f1.Set(0, time.Now())
	f1.Set(1, time.Now())

	f2 := data.NewField("test", nil, make([]*float64, 2))
	f2.SetConcrete(0, 5.0)
	f2.SetConcrete(1, 20.0)

	frame := data.NewFrame("test", f1, f2)

	channelFrames, err := outputter.OutputFrame(context.Background(), Vars{}, frame)
	require.NoError(t, err)
	require.Len(t, channelFrames, 1)
	changeFrame := channelFrames[0].Frame
	require.Len(t, changeFrame.Fields, 3)
	var x *float64
	var y = 5.0
	require.Equal(t, x, changeFrame.Fields[1].At(0).(*float64))
	require.Equal(t, &y, changeFrame.Fields[2].At(0))
	var z = 5.0
	var v = 20.0
	require.Equal(t, &z, changeFrame.Fields[1].At(1).(*float64))
	require.Equal(t, &v, changeFrame.Fields[2].At(1))
}
