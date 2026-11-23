package features

import (
	"context"
	"encoding/json"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/live/pkg/model"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type accessCall struct {
	verb, namespace, name string
}

type fakeAccess struct {
	allow bool
	calls []accessCall
}

func (f *fakeAccess) HasDashboardAccess(_ context.Context, _ identity.Requester, verb string, namespace string, name string) (bool, error) {
	f.calls = append(f.calls, accessCall{verb, namespace, name})
	return f.allow, nil
}

func TestDashboardHandler(t *testing.T) {
	// A stack user is in org 1, but its namespace is the stack's, not "default".
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", OrgID: 1, Namespace: "stacks-12"}

	t.Run("subscribe checks access in the requester's namespace", func(t *testing.T) {
		access := &fakeAccess{allow: true}
		h := &DashboardHandler{AccessControl: access}
		reply, status, err := h.OnSubscribe(context.Background(), user, model.SubscribeEvent{Path: "uid/abc"})
		require.NoError(t, err)
		require.Equal(t, backend.SubscribeStreamStatusOK, status)
		require.True(t, reply.Presence)
		require.Equal(t, []accessCall{{utils.VerbGet, "stacks-12", "abc"}}, access.calls)
	})

	t.Run("subscribe without access is denied", func(t *testing.T) {
		h := &DashboardHandler{AccessControl: &fakeAccess{}}
		_, status, err := h.OnSubscribe(context.Background(), user, model.SubscribeEvent{Path: "uid/abc"})
		require.NoError(t, err)
		require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
	})

	t.Run("unknown path", func(t *testing.T) {
		h := &DashboardHandler{AccessControl: &fakeAccess{allow: true}}
		_, status, _ := h.OnSubscribe(context.Background(), user, model.SubscribeEvent{Path: "nope"})
		require.Equal(t, backend.SubscribeStreamStatusNotFound, status)
	})

	t.Run("editing started checks update access in the requester's namespace", func(t *testing.T) {
		access := &fakeAccess{allow: true}
		h := &DashboardHandler{AccessControl: access}
		data, err := json.Marshal(dashboardEvent{UID: "abc", Action: EditingStarted})
		require.NoError(t, err)
		reply, status, err := h.OnPublish(context.Background(), user, model.PublishEvent{Path: "uid/abc", Data: data})
		require.NoError(t, err)
		require.Equal(t, backend.PublishStreamStatusOK, status)
		require.NotEmpty(t, reply.Data)
		require.Equal(t, []accessCall{{utils.VerbUpdate, "stacks-12", "abc"}}, access.calls)
	})

	t.Run("saved is published to the dashboard channel", func(t *testing.T) {
		var gotNS, gotChannel string
		h := &DashboardHandler{Publisher: func(ns string, channel string, _ []byte) error {
			gotNS, gotChannel = ns, channel
			return nil
		}}
		require.NoError(t, h.DashboardSaved("stacks-12", "abc", "42"))
		require.Equal(t, "stacks-12", gotNS)
		require.Equal(t, "grafana/dashboard/uid/abc", gotChannel)
	})
}
