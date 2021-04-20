package runstream

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"
)

// wait until channel closed with timeout.
func waitWithTimeout(tb testing.TB, ch chan struct{}, timeout time.Duration) {
	select {
	case <-ch:
	case <-time.After(timeout):
		tb.Fatal("timeout")
	}
}

func TestStreamManager_Run(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockPacketSender := NewMockStreamPacketSender(mockCtrl)
	mockPresenceGetter := NewMockPresenceGetter(mockCtrl)

	manager := NewManager(mockPacketSender, mockPresenceGetter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		cancel()
	}()

	err := manager.Run(ctx)
	require.ErrorIs(t, err, context.Canceled)
}

func TestStreamManager_SubmitStream_Send(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockPacketSender := NewMockStreamPacketSender(mockCtrl)
	mockPresenceGetter := NewMockPresenceGetter(mockCtrl)

	manager := NewManager(mockPacketSender, mockPresenceGetter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	startedCh := make(chan struct{})
	doneCh := make(chan struct{})

	mockPacketSender.EXPECT().Send("test", gomock.Any()).Times(1)

	mockStreamRunner := NewMockStreamRunner(mockCtrl)
	mockStreamRunner.EXPECT().RunStream(
		gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
		require.Equal(t, "test", req.Path)
		close(startedCh)
		err := sender.Send(&backend.StreamPacket{
			Data: []byte("test"),
		})
		require.NoError(t, err)
		<-ctx.Done()
		close(doneCh)
		return ctx.Err()
	}).Times(1)

	result, err := manager.SubmitStream(context.Background(), "test", "test", backend.PluginContext{}, mockStreamRunner)
	require.NoError(t, err)
	require.False(t, result.StreamExists)

	// try submit the same.
	result, err = manager.SubmitStream(context.Background(), "test", "test", backend.PluginContext{}, mockStreamRunner)
	require.NoError(t, err)
	require.True(t, result.StreamExists)

	waitWithTimeout(t, startedCh, time.Second)
	require.Len(t, manager.streams, 1)
	cancel()
	waitWithTimeout(t, doneCh, time.Second)
}

func TestStreamManager_SubmitStream_CloseNoSubscribers(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockPacketSender := NewMockStreamPacketSender(mockCtrl)
	mockPresenceGetter := NewMockPresenceGetter(mockCtrl)

	// Create manager with very fast num subscribers checks.
	manager := NewManager(
		mockPacketSender,
		mockPresenceGetter,
		WithCheckConfig(10*time.Millisecond, 3),
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	startedCh := make(chan struct{})
	doneCh := make(chan struct{})

	mockPresenceGetter.EXPECT().GetNumSubscribers("test").Return(0, nil).Times(3)

	mockStreamRunner := NewMockStreamRunner(mockCtrl)
	mockStreamRunner.EXPECT().RunStream(gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
		close(startedCh)
		<-ctx.Done()
		close(doneCh)
		return ctx.Err()
	}).Times(1)

	_, err := manager.SubmitStream(context.Background(), "test", "test", backend.PluginContext{}, mockStreamRunner)
	require.NoError(t, err)

	waitWithTimeout(t, startedCh, time.Second)
	waitWithTimeout(t, doneCh, time.Second)
	require.Len(t, manager.streams, 0)
}

func TestStreamManager_SubmitStream_ErrorRestartsRunStream(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockPacketSender := NewMockStreamPacketSender(mockCtrl)
	mockPresenceGetter := NewMockPresenceGetter(mockCtrl)

	manager := NewManager(mockPacketSender, mockPresenceGetter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	numErrors := 3
	currentErrors := 0

	mockStreamRunner := NewMockStreamRunner(mockCtrl)
	mockStreamRunner.EXPECT().RunStream(
		gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
		if currentErrors >= numErrors {
			return nil
		}
		currentErrors++
		return errors.New("boom")
	}).Times(numErrors + 1)

	result, err := manager.SubmitStream(context.Background(), "test", "test", backend.PluginContext{}, mockStreamRunner)
	require.NoError(t, err)
	require.False(t, result.StreamExists)

	waitWithTimeout(t, result.CloseNotify, time.Second)
}

func TestStreamManager_SubmitStream_NilErrorStopsRunStream(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockPacketSender := NewMockStreamPacketSender(mockCtrl)
	mockPresenceGetter := NewMockPresenceGetter(mockCtrl)

	manager := NewManager(mockPacketSender, mockPresenceGetter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	mockStreamRunner := NewMockStreamRunner(mockCtrl)
	mockStreamRunner.EXPECT().RunStream(
		gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
		return nil
	}).Times(1)

	result, err := manager.SubmitStream(context.Background(), "test", "test", backend.PluginContext{}, mockStreamRunner)
	require.NoError(t, err)
	require.False(t, result.StreamExists)
	waitWithTimeout(t, result.CloseNotify, time.Second)
}
