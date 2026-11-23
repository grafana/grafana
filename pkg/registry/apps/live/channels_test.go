package live

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"

	livev1 "github.com/grafana/grafana/apps/live/pkg/apis/live/v1alpha1"
	"github.com/grafana/grafana/apps/live/pkg/managedstream"
	appsdkapiserver "github.com/grafana/grafana/pkg/apiserver/appsdk"
)

type fakeLister struct {
	namespace string
	channels  []*managedstream.ManagedChannel
	err       error
}

func (f *fakeLister) ListManagedChannels(_ context.Context, namespace string) ([]*managedstream.ManagedChannel, error) {
	f.namespace = namespace
	return f.channels, f.err
}

func TestChannelStorage(t *testing.T) {
	ctx := k8srequest.WithNamespace(context.Background(), "default")
	lister := &fakeLister{channels: []*managedstream.ManagedChannel{
		{Channel: "stream/telegraf/cpu", MinuteRate: 60, Data: json.RawMessage(`{"schema":{"name":"cpu"}}`)},
		{Channel: "stream/telegraf/mem", MinuteRate: 0, Data: json.RawMessage(`null`)},
	}}
	s := newChannelStorage(lister)

	t.Run("list", func(t *testing.T) {
		obj, err := s.List(ctx, nil)
		require.NoError(t, err)
		require.Equal(t, "default", lister.namespace)

		items := obj.(*livev1.ChannelList).Items
		require.Len(t, items, 2)
		require.Equal(t, "stream.telegraf.cpu", items[0].Name)
		require.Equal(t, "default", items[0].Namespace)
		require.Equal(t, "stream/telegraf/cpu", items[0].Spec.Path)
		require.Equal(t, int64(60), items[0].Status.MinuteRate)
		require.Equal(t, map[string]any{"schema": map[string]any{"name": "cpu"}}, items[0].Status.Data)
		require.Empty(t, items[1].Status.Data)
	})

	t.Run("get", func(t *testing.T) {
		obj, err := s.Get(ctx, "stream.telegraf.cpu", nil)
		require.NoError(t, err)
		require.Equal(t, "stream/telegraf/cpu", obj.(*livev1.Channel).Spec.Path)

		_, err = s.Get(ctx, "stream.telegraf.disk", nil)
		require.True(t, apierrors.IsNotFound(err), "got %v", err)
	})

	t.Run("lister error", func(t *testing.T) {
		_, err := newChannelStorage(&fakeLister{err: errors.New("boom")}).List(ctx, nil)
		require.Error(t, err)
	})

	t.Run("requires a namespace", func(t *testing.T) {
		_, err := s.List(context.Background(), nil)
		require.Error(t, err)
	})

	t.Run("table", func(t *testing.T) {
		obj, err := s.List(ctx, nil)
		require.NoError(t, err)
		table, err := s.ConvertToTable(ctx, obj, nil)
		require.NoError(t, err)
		require.Len(t, table.Rows, 2)
		require.Equal(t, []any{"stream.telegraf.cpu", "stream/telegraf/cpu", int64(60)}, table.Rows[0].Cells)
	})
}

type capturingServer struct {
	appsdkapiserver.GenericAPIServer
	info *genericapiserver.APIGroupInfo
}

func (c *capturingServer) InstallAPIGroup(info *genericapiserver.APIGroupInfo) error {
	c.info = info
	return nil
}

func TestChannelStorageServerReplacesGeneratedStores(t *testing.T) {
	generated := &channelStorage{}
	other := &channelStorage{}
	replacement := newChannelStorage(&fakeLister{})
	info := &genericapiserver.APIGroupInfo{VersionedResourcesStorageMap: map[string]map[string]rest.Storage{
		"v1alpha1": {
			"channels":        generated,
			"channels/status": generated,
			"others":          other,
		},
	}}

	inner := &capturingServer{}
	require.NoError(t, (&channelStorageServer{GenericAPIServer: inner, storage: replacement}).InstallAPIGroup(info))

	require.Equal(t, map[string]rest.Storage{
		"channels": replacement,
		"others":   other,
	}, inner.info.VersionedResourcesStorageMap["v1alpha1"])
}

func TestChannelNames(t *testing.T) {
	ctx := k8srequest.WithNamespace(context.Background(), "default")
	s := newChannelStorage(&fakeLister{channels: []*managedstream.ManagedChannel{
		{Channel: "stream/telegraf/cpu/load"},
		{Channel: "stream/telegraf/cpu.load"},
		// Not a valid Live channel ("~" and spaces are outside the grammar), so
		// it can't be subscribed to and is left out.
		{Channel: "stream/telegraf/cpu~load now"},
	}})

	obj, err := s.List(ctx, nil)
	require.NoError(t, err)
	items := obj.(*livev1.ChannelList).Items
	require.Len(t, items, 2)

	// Paths that differ only by "/" versus "." get different names.
	require.Equal(t, "stream.telegraf.cpu.load", items[0].Name)
	require.Equal(t, "stream/telegraf/cpu/load", items[0].Spec.Path)
	require.Equal(t, "stream.telegraf.cpu~load", items[1].Name)
	require.Equal(t, "stream/telegraf/cpu.load", items[1].Spec.Path)

	for _, item := range items {
		got, err := s.Get(ctx, item.Name, nil)
		require.NoError(t, err)
		require.Equal(t, item.Spec.Path, got.(*livev1.Channel).Spec.Path)
	}
}
