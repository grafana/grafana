package query

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type fakeListClient struct {
	resource.ResourceClient
	pages []*resourcepb.ListResponse
	err   error
	reqs  []*resourcepb.ListRequest
}

func (c *fakeListClient) List(_ context.Context, in *resourcepb.ListRequest, _ ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	c.reqs = append(c.reqs, &resourcepb.ListRequest{Options: in.Options, NextPageToken: in.NextPageToken})
	if c.err != nil {
		return nil, c.err
	}
	page := c.pages[len(c.reqs)-1]
	return page, nil
}

func storedDatasource(name string, annotations map[string]string) *resourcepb.ResourceWrapper {
	value := fmt.Sprintf(`{"metadata":{"name":%q`, name)
	if len(annotations) > 0 {
		value += `,"annotations":{`
		first := true
		for k, v := range annotations {
			if !first {
				value += ","
			}
			value += fmt.Sprintf("%q:%q", k, v)
			first = false
		}
		value += "}"
	}
	return &resourcepb.ResourceWrapper{Value: []byte(value + "}}")}
}

func TestAnnotatedConnections(t *testing.T) {
	base := func() *datasourceV0.DataSourceConnectionList {
		return &datasourceV0.DataSourceConnectionList{Items: []datasourceV0.DataSourceConnection{
			{Name: "legacy", Annotations: map[string]string{"grafana.app/managedBy": "classic-file-provisioning"}},
			{Name: "synced", Annotations: map[string]string{"grafana.app/managedBy": "classic-file-provisioning"}},
			{Name: "plain"},
		}}
	}

	t.Run("stored annotations win over derived ones across pages", func(t *testing.T) {
		client := &fakeListClient{pages: []*resourcepb.ListResponse{
			{Items: []*resourcepb.ResourceWrapper{storedDatasource("synced", map[string]string{
				"grafana.app/managedBy": "repo",
				"grafana.app/managerId": "my-repo",
			})}, NextPageToken: "next"},
			{Items: []*resourcepb.ResourceWrapper{storedDatasource("plain", map[string]string{"grafana.app/sourcePath": "ds/plain.json"})}},
		}}
		p := newAnnotatedConnections(&testConnectionsProvider{list: base()}, client)

		list, err := p.ListConnections(context.Background(), datasourceV0.DataSourceConnectionQuery{Namespace: "default"})
		require.NoError(t, err)

		require.Equal(t, map[string]string{"grafana.app/managedBy": "classic-file-provisioning"}, list.Items[0].Annotations)
		require.Equal(t, map[string]string{
			"grafana.app/managedBy": "repo",
			"grafana.app/managerId": "my-repo",
		}, list.Items[1].Annotations)
		require.Equal(t, map[string]string{"grafana.app/sourcePath": "ds/plain.json"}, list.Items[2].Annotations)

		require.Len(t, client.reqs, 2)
		key := client.reqs[0].Options.Key
		require.Equal(t, "default", key.Namespace)
		require.Equal(t, "datasource.grafana.app", key.Group)
		require.Equal(t, "datasources", key.Resource)
		require.Equal(t, "next", client.reqs[1].NextPageToken)
	})

	t.Run("a storage error keeps the connections as they were", func(t *testing.T) {
		p := newAnnotatedConnections(&testConnectionsProvider{list: base()}, &fakeListClient{err: errors.New("boom")})

		list, err := p.ListConnections(context.Background(), datasourceV0.DataSourceConnectionQuery{Namespace: "default"})
		require.NoError(t, err)
		require.Equal(t, base().Items, list.Items)
	})
}
