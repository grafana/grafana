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
	mockFrameProcessor := NewMockFrameProcessor(mockCtrl)

	mockStorage.EXPECT().Get(gomock.Any(), gomock.Any()).DoAndReturn(func(orgID int64, channel string) (*data.Frame, bool, error) {
		return nil, false, nil
	})

	mockStorage.EXPECT().Set(gomock.Any(), gomock.Any(), gomock.Any()).Times(1)

	mockFrameProcessor.EXPECT().ProcessFrame(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).Do(func(ctx context.Context, orgID int64, channelID string, frame *data.Frame) {
		require.Len(t, frame.Fields, 3)
		var x *float64
		var y = 20.0
		require.Equal(t, x, frame.Fields[1].At(0).(*float64))
		require.Equal(t, &y, frame.Fields[2].At(0))
	}).Times(1)

	outputter := NewChangeLogOutput(mockStorage, mockFrameProcessor, ChangeLogOutputConfig{
		FieldName: "test",
		Channel:   "stream/test/no_previous_frame",
	})

	f1 := data.NewField("time", nil, make([]time.Time, 1))
	f1.Set(0, time.Now())

	f2 := data.NewField("test", nil, make([]*float64, 1))
	f2.SetConcrete(0, 20.0)

	frame := data.NewFrame("test", f1, f2)

	err := outputter.Output(context.Background(), OutputVars{}, frame)
	require.NoError(t, err)
}

func TestChangeLogOutput_NoPreviousFrame_MultipleRows(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockStorage := NewMockFrameGetSetter(mockCtrl)
	mockFrameProcessor := NewMockFrameProcessor(mockCtrl)

	mockStorage.EXPECT().Get(gomock.Any(), gomock.Any()).DoAndReturn(func(orgID int64, channel string) (*data.Frame, bool, error) {
		return nil, false, nil
	}).Times(1)

	mockStorage.EXPECT().Set(gomock.Any(), gomock.Any(), gomock.Any()).Times(1)

	mockFrameProcessor.EXPECT().ProcessFrame(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).Do(func(ctx context.Context, orgID int64, channelID string, frame *data.Frame) {
		require.Len(t, frame.Fields, 3)
		var x *float64
		var y = 5.0
		require.Equal(t, x, frame.Fields[1].At(0).(*float64))
		require.Equal(t, &y, frame.Fields[2].At(0))
	}).Times(1)

	mockFrameProcessor.EXPECT().ProcessFrame(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).Do(func(ctx context.Context, orgID int64, channelID string, frame *data.Frame) {
		require.Len(t, frame.Fields, 3)
		var x = 5.0
		var y = 20.0
		require.Equal(t, &x, frame.Fields[1].At(0).(*float64))
		require.Equal(t, &y, frame.Fields[2].At(0))
	}).Times(1)

	outputter := NewChangeLogOutput(mockStorage, mockFrameProcessor, ChangeLogOutputConfig{
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

	err := outputter.Output(context.Background(), OutputVars{}, frame)
	require.NoError(t, err)
}
