package features

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/live/model"
	"github.com/stretchr/testify/require"
)

// mockCollabService implements CollabService for testing.
type mockCollabService struct {
	joinResult     *CollabSessionInfo
	joinErr        error
	leaveErr       error
	processResult  []byte
	processErr     error
	joinCalled     bool
	leaveCalled    bool
	processCalled  bool
	lastUserID     string
	lastData       []byte
}

func (m *mockCollabService) UserJoin(_ context.Context, _, _, userID, _, _ string) (*CollabSessionInfo, error) {
	m.joinCalled = true
	m.lastUserID = userID
	return m.joinResult, m.joinErr
}

func (m *mockCollabService) UserLeave(_ context.Context, _, _, userID string) error {
	m.leaveCalled = true
	m.lastUserID = userID
	return m.leaveErr
}

func (m *mockCollabService) ProcessMessage(_ context.Context, _, _ string, data []byte, userID string) ([]byte, error) {
	m.processCalled = true
	m.lastUserID = userID
	m.lastData = data
	return m.processResult, m.processErr
}

// mockAccessControl implements dashboards.DashboardAccessService for testing.
type mockAccessControl struct {
	hasAccess bool
	err       error
}

func (m *mockAccessControl) HasDashboardAccess(_ context.Context, _ identity.Requester, _ string, _, _ string) (bool, error) {
	return m.hasAccess, m.err
}

func newTestCollabHandler(
	service CollabService,
	flagEnabled bool,
	hasAccess bool,
) *CollabHandler {
	toggles := featuremgmt.WithFeatures()
	if flagEnabled {
		toggles = featuremgmt.WithFeatures(featuremgmt.FlagDashboardCollaboration)
	}
	return NewCollabHandler(
		service,
		toggles,
		&mockAccessControl{hasAccess: hasAccess},
		func(_ string, _ string, _ []byte) error { return nil },
	)
}

func TestCollabGetHandlerForPath(t *testing.T) {
	h := newTestCollabHandler(&mockCollabService{}, true, true)

	t.Run("ops path", func(t *testing.T) {
		handler, err := h.GetHandlerForPath("default/dash-1/ops")
		require.NoError(t, err)
		require.NotNil(t, handler)
	})

	t.Run("cursors path", func(t *testing.T) {
		handler, err := h.GetHandlerForPath("default/dash-1/cursors")
		require.NoError(t, err)
		require.NotNil(t, handler)
	})

	t.Run("unknown path", func(t *testing.T) {
		_, err := h.GetHandlerForPath("default/dash-1/unknown")
		require.Error(t, err)
	})

	t.Run("invalid path (too short)", func(t *testing.T) {
		_, err := h.GetHandlerForPath("dash-1")
		require.Error(t, err)
	})
}

func TestCollabOpsSubscribeRejectsWithoutFeatureFlag(t *testing.T) {
	svc := &mockCollabService{}
	h := newTestCollabHandler(svc, false, true) // flag disabled

	handler, err := h.GetHandlerForPath("default/dash-1/ops")
	require.NoError(t, err)

	user := &identity.StaticRequester{
		OrgID: 1,
		Login: "alice",
	}
	_, status, err := handler.OnSubscribe(context.Background(), user, model.SubscribeEvent{})
	require.Error(t, err)
	require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
	require.False(t, svc.joinCalled)
}

func TestCollabOpsSubscribeRejectsWithoutPermission(t *testing.T) {
	svc := &mockCollabService{}
	h := newTestCollabHandler(svc, true, false) // no access

	handler, err := h.GetHandlerForPath("default/dash-1/ops")
	require.NoError(t, err)

	user := &identity.StaticRequester{
		OrgID: 1,
		Login: "alice",
	}
	_, status, err := handler.OnSubscribe(context.Background(), user, model.SubscribeEvent{})
	require.Error(t, err)
	require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
	require.False(t, svc.joinCalled)
}

func TestCollabOpsSubscribeSuccess(t *testing.T) {
	svc := &mockCollabService{
		joinResult: &CollabSessionInfo{
			Users: []CollabUserInfo{{UserID: "alice", DisplayName: "Alice", Color: "#FF6B6B"}},
			Locks: map[string]string{},
			Seq:   0,
		},
	}
	h := newTestCollabHandler(svc, true, true)

	handler, err := h.GetHandlerForPath("default/dash-1/ops")
	require.NoError(t, err)

	user := &identity.StaticRequester{
		OrgID: 1,
		Login: "alice",
	}
	reply, status, err := handler.OnSubscribe(context.Background(), user, model.SubscribeEvent{})
	require.NoError(t, err)
	require.Equal(t, backend.SubscribeStreamStatusOK, status)
	require.True(t, reply.Presence)
	require.True(t, reply.JoinLeave)
	require.True(t, svc.joinCalled)

	// Verify initial state is in response data.
	var info CollabSessionInfo
	err = json.Unmarshal(reply.Data, &info)
	require.NoError(t, err)
	require.Len(t, info.Users, 1)
	require.Equal(t, "Alice", info.Users[0].DisplayName)
}

func TestCollabOpsPublish(t *testing.T) {
	respData := json.RawMessage(`{"seq":1,"kind":"op","op":{},"userId":"alice","timestamp":123}`)
	svc := &mockCollabService{
		processResult: respData,
	}
	h := newTestCollabHandler(svc, true, true)

	handler, err := h.GetHandlerForPath("default/dash-1/ops")
	require.NoError(t, err)

	user := &identity.StaticRequester{
		OrgID: 1,
		Login: "alice",
	}
	inputData := json.RawMessage(`{"kind":"op","op":{}}`)
	reply, status, err := handler.OnPublish(context.Background(), user, model.PublishEvent{
		Data: inputData,
	})
	require.NoError(t, err)
	require.Equal(t, backend.PublishStreamStatusOK, status)
	require.JSONEq(t, string(respData), string(reply.Data))
	require.True(t, svc.processCalled)
}

func TestCollabOpsPublishError(t *testing.T) {
	svc := &mockCollabService{
		processErr: fmt.Errorf("lock required"),
	}
	h := newTestCollabHandler(svc, true, true)

	handler, err := h.GetHandlerForPath("default/dash-1/ops")
	require.NoError(t, err)

	user := &identity.StaticRequester{
		OrgID: 1,
		Login: "alice",
	}
	_, status, err := handler.OnPublish(context.Background(), user, model.PublishEvent{
		Data: json.RawMessage(`{}`),
	})
	require.Error(t, err)
	require.Equal(t, backend.PublishStreamStatusNotFound, status)
}

func TestCollabCursorsSubscribeRejectsWithoutFeatureFlag(t *testing.T) {
	h := newTestCollabHandler(&mockCollabService{}, false, true)

	handler, err := h.GetHandlerForPath("default/dash-1/cursors")
	require.NoError(t, err)

	user := &identity.StaticRequester{
		OrgID: 1,
		Login: "alice",
	}
	_, status, err := handler.OnSubscribe(context.Background(), user, model.SubscribeEvent{})
	require.Error(t, err)
	require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
}

func TestCollabCursorsPassThrough(t *testing.T) {
	h := newTestCollabHandler(&mockCollabService{}, true, true)

	handler, err := h.GetHandlerForPath("default/dash-1/cursors")
	require.NoError(t, err)

	cursorData := json.RawMessage(`{"type":"cursor","userId":"alice","x":100,"y":200}`)
	user := &identity.StaticRequester{
		OrgID: 1,
		Login: "alice",
	}
	reply, status, err := handler.OnPublish(context.Background(), user, model.PublishEvent{
		Data: cursorData,
	})
	require.NoError(t, err)
	require.Equal(t, backend.PublishStreamStatusOK, status)
	// Cursor data is passed through unchanged.
	require.JSONEq(t, string(cursorData), string(reply.Data))
}

// newTestCollabHandlerWithFlags creates a CollabHandler with arbitrary feature flags.
func newTestCollabHandlerWithFlags(
	service CollabService,
	flags []string,
	hasAccess bool,
) *CollabHandler {
	spec := make([]any, len(flags))
	for i, f := range flags {
		spec[i] = f
	}
	toggles := featuremgmt.WithFeatures(spec...)
	return NewCollabHandler(
		service,
		toggles,
		&mockAccessControl{hasAccess: hasAccess},
		func(_ string, _ string, _ []byte) error { return nil },
	)
}

func TestCollabCursorsSubscribeWithCursorSyncFlagOnly(t *testing.T) {
	h := newTestCollabHandlerWithFlags(&mockCollabService{}, []string{featuremgmt.FlagDashboardCursorSync}, true)

	handler, err := h.GetHandlerForPath("default/dash-1/cursors")
	require.NoError(t, err)

	user := &identity.StaticRequester{
		OrgID: 1,
		Login: "alice",
	}
	reply, status, err := handler.OnSubscribe(context.Background(), user, model.SubscribeEvent{})
	require.NoError(t, err)
	require.Equal(t, backend.SubscribeStreamStatusOK, status)
	require.True(t, reply.Presence)
}

func TestCollabOpsSubscribeRejectsWithCursorSyncFlagOnly(t *testing.T) {
	svc := &mockCollabService{}
	h := newTestCollabHandlerWithFlags(svc, []string{featuremgmt.FlagDashboardCursorSync}, true)

	handler, err := h.GetHandlerForPath("default/dash-1/ops")
	require.NoError(t, err)

	user := &identity.StaticRequester{
		OrgID: 1,
		Login: "alice",
	}
	_, status, err := handler.OnSubscribe(context.Background(), user, model.SubscribeEvent{})
	require.Error(t, err)
	require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
	require.False(t, svc.joinCalled)
}

func TestCollabCursorsSubscribeRejectsWithoutPermissionCursorSyncOnly(t *testing.T) {
	h := newTestCollabHandlerWithFlags(&mockCollabService{}, []string{featuremgmt.FlagDashboardCursorSync}, false)

	handler, err := h.GetHandlerForPath("default/dash-1/cursors")
	require.NoError(t, err)

	user := &identity.StaticRequester{
		OrgID: 1,
		Login: "alice",
	}
	_, status, err := handler.OnSubscribe(context.Background(), user, model.SubscribeEvent{})
	require.Error(t, err)
	require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
}

func TestCollabCursorsSubscribeWithBothFlags(t *testing.T) {
	h := newTestCollabHandlerWithFlags(&mockCollabService{}, []string{
		featuremgmt.FlagDashboardCollaboration,
		featuremgmt.FlagDashboardCursorSync,
	}, true)

	handler, err := h.GetHandlerForPath("default/dash-1/cursors")
	require.NoError(t, err)

	user := &identity.StaticRequester{
		OrgID: 1,
		Login: "alice",
	}
	reply, status, err := handler.OnSubscribe(context.Background(), user, model.SubscribeEvent{})
	require.NoError(t, err)
	require.Equal(t, backend.SubscribeStreamStatusOK, status)
	require.True(t, reply.Presence)
}
