package features

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/live/model"
)

func TestNotebookHandler_OnSubscribe(t *testing.T) {
	setNotebookFeatureToggle(t, true)
	h := &NotebookHandler{}
	user := &identity.StaticRequester{Type: types.TypeUser, OrgID: 1, UserID: 2}

	t.Run("valid notebook path enables presence and join/leave", func(t *testing.T) {
		reply, status, err := h.OnSubscribe(context.Background(), user, model.SubscribeEvent{Path: "uid/abc123"})
		require.NoError(t, err)
		require.Equal(t, backend.SubscribeStreamStatusOK, status)
		require.True(t, reply.Presence)
		require.True(t, reply.JoinLeave)
	})

	t.Run("unknown paths are rejected", func(t *testing.T) {
		for _, path := range []string{"", "uid", "uid/", "abc123", "uid/abc/extra"} {
			_, status, err := h.OnSubscribe(context.Background(), user, model.SubscribeEvent{Path: path})
			require.NoError(t, err)
			require.Equal(t, backend.SubscribeStreamStatusNotFound, status, "path %q", path)
		}
	})

	t.Run("nil identity is denied", func(t *testing.T) {
		_, status, err := h.OnSubscribe(context.Background(), nil, model.SubscribeEvent{Path: "uid/abc123"})
		require.Error(t, err)
		require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
	})

	t.Run("anonymous identity is denied", func(t *testing.T) {
		anon := &identity.StaticRequester{Type: types.TypeAnonymous, OrgID: 1}
		_, status, err := h.OnSubscribe(context.Background(), anon, model.SubscribeEvent{Path: "uid/abc123"})
		require.Error(t, err)
		require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
	})

	t.Run("service account identity is denied", func(t *testing.T) {
		serviceAccount := &identity.StaticRequester{Type: types.TypeServiceAccount, OrgID: 1}
		_, status, err := h.OnSubscribe(context.Background(), serviceAccount, model.SubscribeEvent{Path: "uid/abc123"})
		require.Error(t, err)
		require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
	})
}

func TestNotebookHandler_OnPublish(t *testing.T) {
	setNotebookFeatureToggle(t, true)
	h := &NotebookHandler{}
	user := &identity.StaticRequester{Type: types.TypeUser, OrgID: 1, UserID: 2}

	t.Run("relays payload back for broadcast", func(t *testing.T) {
		data := json.RawMessage(`{"t":"cursor","x":10,"y":20}`)
		reply, status, err := h.OnPublish(context.Background(), user, model.PublishEvent{Path: "uid/abc123", Data: data})
		require.NoError(t, err)
		require.Equal(t, backend.PublishStreamStatusOK, status)
		require.Equal(t, data, reply.Data)
	})

	t.Run("unknown paths are rejected", func(t *testing.T) {
		_, status, err := h.OnPublish(context.Background(), user, model.PublishEvent{Path: "nope"})
		require.NoError(t, err)
		require.Equal(t, backend.PublishStreamStatusNotFound, status)
	})

	t.Run("anonymous identity is denied", func(t *testing.T) {
		anon := &identity.StaticRequester{Type: types.TypeAnonymous, OrgID: 1}
		_, status, err := h.OnPublish(context.Background(), anon, model.PublishEvent{Path: "uid/abc123", Data: json.RawMessage(`{}`)})
		require.Error(t, err)
		require.Equal(t, backend.PublishStreamStatusPermissionDenied, status)
	})
}

func TestNotebookHandler_FeatureDisabled(t *testing.T) {
	setNotebookFeatureToggle(t, false)
	h := &NotebookHandler{}
	user := &identity.StaticRequester{Type: types.TypeUser, OrgID: 1, UserID: 2}

	_, subscribeStatus, subscribeErr := h.OnSubscribe(
		context.Background(),
		user,
		model.SubscribeEvent{Path: "uid/abc123"},
	)
	require.NoError(t, subscribeErr)
	require.Equal(t, backend.SubscribeStreamStatusNotFound, subscribeStatus)

	_, publishStatus, publishErr := h.OnPublish(
		context.Background(),
		user,
		model.PublishEvent{Path: "uid/abc123", Data: json.RawMessage(`{}`)},
	)
	require.NoError(t, publishErr)
	require.Equal(t, backend.PublishStreamStatusNotFound, publishStatus)
}

func setNotebookFeatureToggle(t *testing.T, enabled bool) {
	t.Helper()
	variant := "disabled"
	if enabled {
		variant = "enabled"
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagDashboardNotebooks: {
			Key:            featuremgmt.FlagDashboardNotebooks,
			DefaultVariant: variant,
			Variants: map[string]any{
				"enabled":  true,
				"disabled": false,
			},
		},
	})))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
	})
}
