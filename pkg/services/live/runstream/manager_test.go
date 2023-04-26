package runstream

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/user"
)

// wait until channel closed with timeout.
func waitWithTimeout(tb testing.TB, ch chan struct{}, timeout time.Duration) {
	tb.Helper()
	select {
	case <-ch:
	case <-time.After(timeout):
		tb.Fatal("timeout")
	}
}

func TestStreamManager_Run(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockChannelPublisher := NewMockChannelLocalPublisher(mockCtrl)
	mockNumSubscribersGetter := NewMockNumLocalSubscribersGetter(mockCtrl)
	mockContextGetter := NewMockPluginContextGetter(mockCtrl)

	manager := NewManager(mockChannelPublisher, mockNumSubscribersGetter, mockContextGetter)

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

	mockPacketSender := NewMockChannelLocalPublisher(mockCtrl)
	mockNumSubscribersGetter := NewMockNumLocalSubscribersGetter(mockCtrl)
	mockContextGetter := NewMockPluginContextGetter(mockCtrl)

	manager := NewManager(mockPacketSender, mockNumSubscribersGetter, mockContextGetter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	startedCh := make(chan struct{})
	doneCh := make(chan struct{})

	testPluginContext := backend.PluginContext{
		OrgID:    1,
		PluginID: "test-plugin",
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			UID: "xyz",
		},
	}

	mockContextGetter.EXPECT().GetPluginContext(context.Background(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, user *user.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error) {
		require.Equal(t, int64(2), user.UserID)
		require.Equal(t, int64(1), user.OrgID)
		require.Equal(t, testPluginContext.PluginID, pluginID)
		require.Equal(t, testPluginContext.DataSourceInstanceSettings.UID, datasourceUID)
		return testPluginContext, true, nil
	}).Times(0)

	mockPacketSender.EXPECT().PublishLocal("1/test", gomock.Any()).Times(1)

	mockStreamRunner := NewMockStreamRunner(mockCtrl)
	mockStreamRunner.EXPECT().RunStream(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
		require.Equal(t, "test", req.Path)
		close(startedCh)
		err := sender.SendJSON([]byte("{}"))
		require.NoError(t, err)
		<-ctx.Done()
		close(doneCh)
		return ctx.Err()
	}).Times(1)

	result, err := manager.SubmitStream(context.Background(), &user.SignedInUser{UserID: 2, OrgID: 1}, "1/test", "test", nil, testPluginContext, mockStreamRunner, false)
	require.NoError(t, err)
	require.False(t, result.StreamExists)

	// try submit the same.
	result, err = manager.SubmitStream(context.Background(), &user.SignedInUser{UserID: 2, OrgID: 1}, "1/test", "test", nil, backend.PluginContext{}, mockStreamRunner, false)
	require.NoError(t, err)
	require.True(t, result.StreamExists)

	waitWithTimeout(t, startedCh, time.Second)
	require.Len(t, manager.streams, 1)
	cancel()
	waitWithTimeout(t, doneCh, time.Second)
}

func TestStreamManager_SubmitStream_DifferentOrgID(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockPacketSender := NewMockChannelLocalPublisher(mockCtrl)
	mockNumSubscribersGetter := NewMockNumLocalSubscribersGetter(mockCtrl)
	mockContextGetter := NewMockPluginContextGetter(mockCtrl)

	manager := NewManager(mockPacketSender, mockNumSubscribersGetter, mockContextGetter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	startedCh1 := make(chan struct{})
	startedCh2 := make(chan struct{})
	doneCh1 := make(chan struct{})
	doneCh2 := make(chan struct{})

	mockPacketSender.EXPECT().PublishLocal("1/test", gomock.Any()).Times(1)
	mockPacketSender.EXPECT().PublishLocal("2/test", gomock.Any()).Times(1)

	mockContextGetter.EXPECT().GetPluginContext(context.Background(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, user *user.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error) {
		return backend.PluginContext{}, true, nil
	}).Times(0)

	mockStreamRunner1 := NewMockStreamRunner(mockCtrl)
	mockStreamRunner1.EXPECT().RunStream(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
		require.Equal(t, "test", req.Path)
		close(startedCh1)
		err := sender.SendJSON([]byte("{}"))
		require.NoError(t, err)
		<-ctx.Done()
		close(doneCh1)
		return ctx.Err()
	}).Times(1)

	mockStreamRunner2 := NewMockStreamRunner(mockCtrl)
	mockStreamRunner2.EXPECT().RunStream(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
		require.Equal(t, "test", req.Path)
		close(startedCh2)
		err := sender.SendJSON([]byte("{}"))
		require.NoError(t, err)
		<-ctx.Done()
		close(doneCh2)
		return ctx.Err()
	}).Times(1)

	result, err := manager.SubmitStream(context.Background(), &user.SignedInUser{UserID: 2, OrgID: 1}, "1/test", "test", nil, backend.PluginContext{}, mockStreamRunner1, false)
	require.NoError(t, err)
	require.False(t, result.StreamExists)

	// try submit the same channel but different orgID.
	result, err = manager.SubmitStream(context.Background(), &user.SignedInUser{UserID: 2, OrgID: 2}, "2/test", "test", nil, backend.PluginContext{}, mockStreamRunner2, false)
	require.NoError(t, err)
	require.False(t, result.StreamExists)

	waitWithTimeout(t, startedCh1, time.Second)
	waitWithTimeout(t, startedCh2, time.Second)
	require.Len(t, manager.streams, 2)
	cancel()
	waitWithTimeout(t, doneCh1, time.Second)
	waitWithTimeout(t, doneCh2, time.Second)
}

func TestStreamManager_SubmitStream_CloseNoSubscribers(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockPacketSender := NewMockChannelLocalPublisher(mockCtrl)
	mockNumSubscribersGetter := NewMockNumLocalSubscribersGetter(mockCtrl)
	mockContextGetter := NewMockPluginContextGetter(mockCtrl)

	// Create manager with very fast num subscribers checks.
	manager := NewManager(
		mockPacketSender,
		mockNumSubscribersGetter,
		mockContextGetter,
		WithCheckConfig(10*time.Millisecond, 3),
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	startedCh := make(chan struct{})
	doneCh := make(chan struct{})

	mockContextGetter.EXPECT().GetPluginContext(context.Background(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, user *user.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error) {
		return backend.PluginContext{}, true, nil
	}).Times(0)

	mockNumSubscribersGetter.EXPECT().GetNumLocalSubscribers("1/test").Return(0, nil).Times(3)

	mockStreamRunner := NewMockStreamRunner(mockCtrl)
	mockStreamRunner.EXPECT().RunStream(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
		close(startedCh)
		<-ctx.Done()
		close(doneCh)
		return ctx.Err()
	}).Times(1)

	_, err := manager.SubmitStream(context.Background(), &user.SignedInUser{UserID: 2, OrgID: 1}, "1/test", "test", nil, backend.PluginContext{}, mockStreamRunner, false)
	require.NoError(t, err)

	waitWithTimeout(t, startedCh, time.Second)
	waitWithTimeout(t, doneCh, time.Second)
	require.Len(t, manager.streams, 0)
}

func TestStreamManager_SubmitStream_ErrorRestartsRunStream(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockPacketSender := NewMockChannelLocalPublisher(mockCtrl)
	mockNumSubscribersGetter := NewMockNumLocalSubscribersGetter(mockCtrl)
	mockContextGetter := NewMockPluginContextGetter(mockCtrl)

	manager := NewManager(mockPacketSender, mockNumSubscribersGetter, mockContextGetter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	numErrors := 3
	currentErrors := 0

	testPluginContext := backend.PluginContext{
		OrgID:    1,
		PluginID: "test-plugin",
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			UID: "xyz",
		},
	}

	mockContextGetter.EXPECT().GetPluginContext(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, user *user.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error) {
		require.Equal(t, int64(2), user.UserID)
		require.Equal(t, int64(1), user.OrgID)
		require.Equal(t, testPluginContext.PluginID, pluginID)
		require.Equal(t, testPluginContext.DataSourceInstanceSettings.UID, datasourceUID)
		return testPluginContext, true, nil
	}).Times(numErrors)

	mockStreamRunner := NewMockStreamRunner(mockCtrl)
	mockStreamRunner.EXPECT().RunStream(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
		if currentErrors >= numErrors {
			return nil
		}
		currentErrors++
		return errors.New("boom")
	}).Times(numErrors + 1)

	result, err := manager.SubmitStream(context.Background(), &user.SignedInUser{UserID: 2, OrgID: 1}, "test", "test", nil, testPluginContext, mockStreamRunner, false)
	require.NoError(t, err)
	require.False(t, result.StreamExists)

	waitWithTimeout(t, result.CloseNotify, time.Second)
}

func TestStreamManager_SubmitStream_NilErrorStopsRunStream(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockPacketSender := NewMockChannelLocalPublisher(mockCtrl)
	mockNumSubscribersGetter := NewMockNumLocalSubscribersGetter(mockCtrl)
	mockContextGetter := NewMockPluginContextGetter(mockCtrl)

	manager := NewManager(mockPacketSender, mockNumSubscribersGetter, mockContextGetter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	mockContextGetter.EXPECT().GetPluginContext(context.Background(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, user *user.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error) {
		return backend.PluginContext{}, true, nil
	}).Times(0)

	mockStreamRunner := NewMockStreamRunner(mockCtrl)
	mockStreamRunner.EXPECT().RunStream(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
		return nil
	}).Times(1)

	result, err := manager.SubmitStream(context.Background(), &user.SignedInUser{UserID: 2, OrgID: 1}, "test", "test", nil, backend.PluginContext{}, mockStreamRunner, false)
	require.NoError(t, err)
	require.False(t, result.StreamExists)
	waitWithTimeout(t, result.CloseNotify, time.Second)
}

func TestStreamManager_HandleDatasourceUpdate(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockPacketSender := NewMockChannelLocalPublisher(mockCtrl)
	mockNumSubscribersGetter := NewMockNumLocalSubscribersGetter(mockCtrl)
	mockContextGetter := NewMockPluginContextGetter(mockCtrl)

	manager := NewManager(mockPacketSender, mockNumSubscribersGetter, mockContextGetter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	testPluginContext := backend.PluginContext{
		OrgID:    1,
		PluginID: "test-plugin",
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			UID: "xyz",
		},
	}

	mockContextGetter.EXPECT().GetPluginContext(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, user *user.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error) {
		require.Equal(t, int64(2), user.UserID)
		require.Equal(t, int64(1), user.OrgID)
		require.Equal(t, testPluginContext.PluginID, pluginID)
		require.Equal(t, testPluginContext.DataSourceInstanceSettings.UID, datasourceUID)
		return testPluginContext, true, nil
	}).Times(1)

	isFirstCall := true

	doneCh1 := make(chan struct{})
	doneCh2 := make(chan struct{})

	mockStreamRunner := NewMockStreamRunner(mockCtrl)
	mockStreamRunner.EXPECT().RunStream(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
		if isFirstCall {
			// first RunStream will wait till context done.
			isFirstCall = false
			close(doneCh1)
			<-ctx.Done()
			return ctx.Err()
		}
		// second RunStream finishes immediately since we are waiting for it below.
		close(doneCh2)
		return nil
	}).Times(2)

	result, err := manager.SubmitStream(context.Background(), &user.SignedInUser{UserID: 2, OrgID: 1}, "test", "test", nil, testPluginContext, mockStreamRunner, false)
	require.NoError(t, err)
	require.False(t, result.StreamExists)

	waitWithTimeout(t, doneCh1, time.Second)

	err = manager.HandleDatasourceUpdate(1, "xyz")
	require.NoError(t, err)

	waitWithTimeout(t, result.CloseNotify, time.Second)
	waitWithTimeout(t, doneCh2, time.Second)
}

func TestStreamManager_HandleDatasourceDelete(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockPacketSender := NewMockChannelLocalPublisher(mockCtrl)
	mockNumSubscribersGetter := NewMockNumLocalSubscribersGetter(mockCtrl)
	mockContextGetter := NewMockPluginContextGetter(mockCtrl)

	manager := NewManager(mockPacketSender, mockNumSubscribersGetter, mockContextGetter)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = manager.Run(ctx)
	}()

	testPluginContext := backend.PluginContext{
		OrgID:    1,
		PluginID: "test-plugin",
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			UID: "xyz",
		},
	}

	mockContextGetter.EXPECT().GetPluginContext(context.Background(), gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, user *user.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error) {
		require.Equal(t, int64(2), user.UserID)
		require.Equal(t, int64(1), user.OrgID)
		require.Equal(t, testPluginContext.PluginID, pluginID)
		require.Equal(t, testPluginContext.DataSourceInstanceSettings.UID, datasourceUID)
		return testPluginContext, true, nil
	}).Times(0)

	doneCh := make(chan struct{})

	mockStreamRunner := NewMockStreamRunner(mockCtrl)
	mockStreamRunner.EXPECT().RunStream(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
		close(doneCh)
		<-ctx.Done()
		return ctx.Err()
	}).Times(1)

	result, err := manager.SubmitStream(context.Background(), &user.SignedInUser{UserID: 2, OrgID: 1}, "test", "test", nil, testPluginContext, mockStreamRunner, false)
	require.NoError(t, err)
	require.False(t, result.StreamExists)

	waitWithTimeout(t, doneCh, time.Second)
	err = manager.HandleDatasourceDelete(1, "xyz")
	require.NoError(t, err)
	waitWithTimeout(t, result.CloseNotify, time.Second)
}
