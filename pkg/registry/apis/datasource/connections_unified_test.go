package datasource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func storedValue(t *testing.T, name, title, pluginLabel string, extra map[string]string) []byte {
	t.Helper()
	labels := map[string]string{}
	if pluginLabel != "" {
		labels[datasourceV0.LabelKeyGroup] = pluginLabel
	}
	for k, v := range extra {
		labels[k] = v
	}
	raw, err := json.Marshal(map[string]any{
		"metadata": map[string]any{"name": name, "labels": labels},
		"spec":     map[string]any{"title": title},
	})
	require.NoError(t, err)
	return raw
}

func listResponse(items ...*resourcepb.ResourceWrapper) *resourcepb.ListResponse {
	return &resourcepb.ListResponse{Items: items}
}

func withUser(t *testing.T, permissions map[string][]string) context.Context {
	t.Helper()
	return identity.WithRequester(context.Background(), &user.SignedInUser{
		OrgID:       1,
		Permissions: map[int64]map[string][]string{1: permissions},
	})
}

const allDatasources = "datasources:*"

func TestUnifiedConnections_ListConnections(t *testing.T) {
	readAll := map[string][]string{datasources.ActionRead: {allDatasources}}

	t.Run("reports the group each plugin serves, read from the shared label", func(t *testing.T) {
		client := resource.NewMockResourceClient(t)
		client.EXPECT().List(mock.Anything, mock.Anything).Return(listResponse(
			&resourcepb.ResourceWrapper{Value: storedValue(t, "prom-uid", "Prom", "prometheus", map[string]string{"default": "true"})},
			&resourcepb.ResourceWrapper{Value: storedValue(t, "loki-uid", "Loki", "loki", nil)},
		), nil).Once()

		list, err := ProvideUnifiedConnections(client, actest.FakeAccessControl{ExpectedEvaluate: true}).
			ListConnections(withUser(t, readAll), datasourceV0.DataSourceConnectionQuery{Namespace: "default"})
		require.NoError(t, err)

		require.Equal(t, []datasourceV0.DataSourceConnection{
			{
				Title:      "Prom",
				Name:       "prom-uid",
				APIGroup:   "prometheus.datasource.grafana.app",
				APIVersion: datasourceV0.VERSION,
				Plugin:     "prometheus",
				// The reserved group label is storage bookkeeping and is not reported.
				Labels: map[string]string{"default": "true"},
			},
			{
				Title:      "Loki",
				Name:       "loki-uid",
				APIGroup:   "loki.datasource.grafana.app",
				APIVersion: datasourceV0.VERSION,
				Plugin:     "loki",
			},
		}, list.Items)
	})

	// Matching the legacy provider: a data source the user cannot read is left out rather than
	// failing the whole list.
	t.Run("leaves out a data source the user cannot read", func(t *testing.T) {
		client := resource.NewMockResourceClient(t)
		client.EXPECT().List(mock.Anything, mock.Anything).Return(listResponse(
			&resourcepb.ResourceWrapper{Value: storedValue(t, "prom-uid", "Prom", "prometheus", nil)},
		), nil).Once()

		list, err := ProvideUnifiedConnections(client, actest.FakeAccessControl{ExpectedEvaluate: false}).
			ListConnections(withUser(t, nil), datasourceV0.DataSourceConnectionQuery{Namespace: "default"})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})

	// An object without the label names no served group, so no caller could address it.
	t.Run("skips a stored object that names no served group", func(t *testing.T) {
		client := resource.NewMockResourceClient(t)
		client.EXPECT().List(mock.Anything, mock.Anything).Return(listResponse(
			&resourcepb.ResourceWrapper{Value: storedValue(t, "orphan", "Orphan", "", nil)},
		), nil).Once()

		list, err := ProvideUnifiedConnections(client, actest.FakeAccessControl{ExpectedEvaluate: true}).
			ListConnections(withUser(t, readAll), datasourceV0.DataSourceConnectionQuery{Namespace: "default"})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})

	t.Run("follows the page token", func(t *testing.T) {
		client := resource.NewMockResourceClient(t)
		first := listResponse(&resourcepb.ResourceWrapper{Value: storedValue(t, "a", "A", "prometheus", nil)})
		first.NextPageToken = "page-2"
		client.EXPECT().List(mock.Anything, mock.MatchedBy(func(req *resourcepb.ListRequest) bool {
			return req.NextPageToken == ""
		})).Return(first, nil).Once()
		client.EXPECT().List(mock.Anything, mock.MatchedBy(func(req *resourcepb.ListRequest) bool {
			return req.NextPageToken == "page-2"
		})).Return(listResponse(&resourcepb.ResourceWrapper{Value: storedValue(t, "b", "B", "loki", nil)}), nil).Once()

		list, err := ProvideUnifiedConnections(client, actest.FakeAccessControl{ExpectedEvaluate: true}).
			ListConnections(withUser(t, readAll), datasourceV0.DataSourceConnectionQuery{Namespace: "default"})
		require.NoError(t, err)
		require.Equal(t, []string{"a", "b"}, []string{list.Items[0].Name, list.Items[1].Name})
	})

	t.Run("lists the whole collection, not one group per plugin", func(t *testing.T) {
		client := resource.NewMockResourceClient(t)
		var captured *resourcepb.ListRequest
		client.EXPECT().List(mock.Anything, mock.Anything).Run(func(_ context.Context, req *resourcepb.ListRequest, _ ...grpc.CallOption) {
			captured = req
		}).Return(listResponse(), nil).Once()

		_, err := ProvideUnifiedConnections(client, actest.FakeAccessControl{ExpectedEvaluate: true}).
			ListConnections(withUser(t, readAll), datasourceV0.DataSourceConnectionQuery{Namespace: "default", Name: "prom-uid"})
		require.NoError(t, err)

		require.Equal(t, datasourceV0.GROUP, captured.Options.Key.Group)
		require.Equal(t, "datasources", captured.Options.Key.Resource)
		require.Equal(t, "default", captured.Options.Key.Namespace)
		// A by-name query is a field selector on the one list, not a per-group lookup.
		require.Equal(t, "metadata.name", captured.Options.Fields[0].Key)
		require.Equal(t, []string{"prom-uid"}, captured.Options.Fields[0].Values)
	})

	t.Run("rejects a response error", func(t *testing.T) {
		client := resource.NewMockResourceClient(t)
		client.EXPECT().List(mock.Anything, mock.Anything).Return(&resourcepb.ListResponse{
			Error: &resourcepb.ErrorResult{Code: 500, Message: "boom"},
		}, nil).Once()

		_, err := ProvideUnifiedConnections(client, actest.FakeAccessControl{ExpectedEvaluate: true}).
			ListConnections(withUser(t, readAll), datasourceV0.DataSourceConnectionQuery{Namespace: "default"})
		require.Error(t, err)
	})

	t.Run("requires a namespace", func(t *testing.T) {
		client := resource.NewMockResourceClient(t)
		_, err := ProvideUnifiedConnections(client, actest.FakeAccessControl{ExpectedEvaluate: true}).
			ListConnections(withUser(t, readAll), datasourceV0.DataSourceConnectionQuery{})
		require.ErrorContains(t, err, "namespace")
	})
}

var _ accesscontrol.AccessControl = actest.FakeAccessControl{}
