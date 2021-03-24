package features

import (
	"context"
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

	mockChannelPublisher := NewMockChannelPublisher(mockCtrl)
	mockPresenceGetter := NewMockPresenceGetter(mockCtrl)

	manager := NewStreamManager(mockChannelPublisher, mockPresenceGetter)

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

	mockChannelPublisher := NewMockChannelPublisher(mockCtrl)
	mockPresenceGetter := NewMockPresenceGetter(mockCtrl)

	manager := NewStreamManager(mockChannelPublisher, mockPresenceGetter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	startedCh := make(chan struct{})
	doneCh := make(chan struct{})

	mockChannelPublisher.EXPECT().Publish("test", []byte("test")).Times(1)

	mockStreamRunner := NewMockStreamRunner(mockCtrl)
	mockStreamRunner.EXPECT().RunStream(
		gomock.Any(), gomock.Any(), gomock.Any(),
	).Do(func(ctx context.Context, req *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
		require.Equal(t, "test", req.Path)
		close(startedCh)
		err := sender.Send(&backend.StreamPacket{
			Payload: []byte("test"),
		})
		require.NoError(t, err)
		<-ctx.Done()
		close(doneCh)
		return ctx.Err()
	}).Times(1)

	err := manager.SubmitStream("test", "test", backend.PluginContext{}, mockStreamRunner)
	require.NoError(t, err)

	// try submit the same.
	err = manager.SubmitStream("test", "test", backend.PluginContext{}, mockStreamRunner)
	require.NoError(t, err)

	waitWithTimeout(t, startedCh, time.Second)
	require.Len(t, manager.streams, 1)
	cancel()
	waitWithTimeout(t, doneCh, time.Second)
}

func TestStreamManager_SubmitStream_CloseNoSubscribers(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockChannelPublisher := NewMockChannelPublisher(mockCtrl)
	mockPresenceGetter := NewMockPresenceGetter(mockCtrl)

	manager := NewStreamManager(
		mockChannelPublisher,
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
	mockStreamRunner.EXPECT().RunStream(gomock.Any(), gomock.Any(), gomock.Any()).Do(func(ctx context.Context, req *backend.RunStreamRequest, sender backend.StreamPacketSender) error {
		close(startedCh)
		<-ctx.Done()
		close(doneCh)
		return ctx.Err()
	}).Times(1)

	err := manager.SubmitStream("test", "test", backend.PluginContext{}, mockStreamRunner)
	require.NoError(t, err)

	waitWithTimeout(t, startedCh, time.Second)
	waitWithTimeout(t, doneCh, time.Second)
	require.Len(t, manager.streams, 0)
}
