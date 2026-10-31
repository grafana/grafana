package datasource

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// connectionsPageSize bounds one page of the collection listing; the whole list is assembled by
// following the page token.
const connectionsPageSize = 500

// unifiedConnections answers the connections endpoint from unified storage.
//
// The legacy implementation reads the data_source table, so it cannot see a data source written
// only through the API groups — which, once the collection reads unified, is every data source
// Git Sync provisions. Reading the collection instead needs no fan-out: every plugin type is
// persisted together under [datasourceV0.GROUP] and names the group that serves it in a label, so
// one list covers every type and still reports the per-plugin group each caller has to follow.
type unifiedConnections struct {
	client resource.ResourceClient
	ac     accesscontrol.AccessControl
}

var _ datasourceV0.DataSourceConnectionProvider = (*unifiedConnections)(nil)

// ProvideUnifiedConnections returns a connection provider backed by unified storage.
func ProvideUnifiedConnections(client resource.ResourceClient, ac accesscontrol.AccessControl) datasourceV0.DataSourceConnectionProvider {
	return &unifiedConnections{client: client, ac: ac}
}

// storedDataSource is the part of a stored object this needs. The collection holds every plugin
// type, so the served group comes from the label rather than from the stored apiVersion.
type storedDataSource struct {
	Metadata struct {
		Name   string            `json:"name"`
		Labels map[string]string `json:"labels"`
	} `json:"metadata"`
	Spec struct {
		Title string `json:"title"`
	} `json:"spec"`
}

// ListConnections implements [datasourceV0.DataSourceConnectionProvider].
func (c *unifiedConnections) ListConnections(ctx context.Context, query datasourceV0.DataSourceConnectionQuery) (*datasourceV0.DataSourceConnectionList, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	if query.Namespace == "" {
		return nil, fmt.Errorf("missing valid namespace")
	}

	result := &datasourceV0.DataSourceConnectionList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: datasourceV0.SchemeGroupVersion.String(),
			Kind:       "DataSourceConnectionList",
		},
		Items: []datasourceV0.DataSourceConnection{},
	}

	var pageToken string
	for {
		req := &resourcepb.ListRequest{
			Limit:         connectionsPageSize,
			NextPageToken: pageToken,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: query.Namespace,
					Group:     datasourceV0.GROUP,
					Resource:  datasourceV0.DataSourceResourceInfo.GetName(),
				},
			},
		}
		if query.Name != "" {
			req.Options.Fields = []*resourcepb.Requirement{{
				Key:      "metadata.name",
				Operator: "=",
				Values:   []string{query.Name},
			}}
		}

		rsp, err := c.client.List(ctx, req)
		// Both error forms have to be handled; see pkg/storage/unified/resource/doc.go.
		if err := resource.ErrorFromResponse(rsp.GetError(), err); err != nil {
			return nil, err
		}

		for _, item := range rsp.Items {
			var stored storedDataSource
			if err := json.Unmarshal(item.Value, &stored); err != nil {
				return nil, fmt.Errorf("decoding stored data source: %w", err)
			}
			conn := asUnifiedConnection(stored)
			if conn == nil {
				continue
			}
			// Mirrors the legacy implementation: a data source the user cannot read is left out
			// rather than failing the list.
			evaluator := accesscontrol.EvalPermission(datasources.ActionRead,
				datasources.ScopeProvider.GetResourceScopeUID(conn.Name))
			if ok, _ := c.ac.Evaluate(ctx, user, evaluator); !ok {
				continue
			}
			result.Items = append(result.Items, *conn)
		}

		pageToken = rsp.NextPageToken
		if pageToken == "" {
			return result, nil
		}
	}
}

// asUnifiedConnection maps a stored object to a connection, or nil when it carries no served group
// and so cannot be addressed. The reserved group label is dropped: it is storage bookkeeping, and
// the served group it encodes is reported as APIGroup instead.
func asUnifiedConnection(stored storedDataSource) *datasourceV0.DataSourceConnection {
	if stored.Metadata.Name == "" {
		return nil
	}
	plugin := stored.Metadata.Labels[datasourceV0.LabelKeyGroup]
	group := utils.SharedGroupFromLabel(datasourceV0.GROUP, plugin)
	if group == "" {
		return nil
	}

	var labels map[string]string
	for key, value := range stored.Metadata.Labels {
		if key == datasourceV0.LabelKeyGroup {
			continue
		}
		if labels == nil {
			labels = map[string]string{}
		}
		labels[key] = value
	}

	return &datasourceV0.DataSourceConnection{
		Title:      stored.Spec.Title,
		Name:       stored.Metadata.Name,
		APIGroup:   group,
		APIVersion: datasourceV0.VERSION,
		Plugin:     plugin,
		Labels:     labels,
	}
}
