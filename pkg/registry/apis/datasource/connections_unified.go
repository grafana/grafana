package datasource

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/datasource/converter"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// collectionPageSize bounds one page of the collection listing; the whole list is assembled by
// following the page token.
const collectionPageSize = 500

// eachStoredDataSource calls fn for every data source in the shared collection, following the page
// token, with the API group that serves it.
//
// Every plugin type is persisted together under [datasourceV0.GROUP] and names its served group in
// a label, so one list covers every type. That is what makes reading unified storage here cheap:
// no request per plugin, and a coherent order and pagination across types.
//
// An object that names no served group is skipped, since no caller could address it.
func eachStoredDataSource(
	ctx context.Context,
	client resource.ResourceClient,
	namespace, name string,
	fn func(ds *datasourceV0.DataSource, group, plugin string) error,
) error {
	if namespace == "" {
		return fmt.Errorf("missing valid namespace")
	}

	var pageToken string
	for {
		req := &resourcepb.ListRequest{
			Limit:         collectionPageSize,
			NextPageToken: pageToken,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: namespace,
					Group:     datasourceV0.GROUP,
					Resource:  datasourceV0.DataSourceResourceInfo.GetName(),
				},
			},
		}
		if name != "" {
			req.Options.Fields = []*resourcepb.Requirement{{
				Key:      "metadata.name",
				Operator: "=",
				Values:   []string{name},
			}}
		}

		rsp, err := client.List(ctx, req)
		// Both error forms have to be handled; see pkg/storage/unified/resource/doc.go.
		if err := resource.ErrorFromResponse(rsp.GetError(), err); err != nil {
			return err
		}

		for _, item := range rsp.Items {
			var ds datasourceV0.DataSource
			if err := json.Unmarshal(item.Value, &ds); err != nil {
				return fmt.Errorf("decoding stored data source: %w", err)
			}
			if ds.Name == "" {
				continue
			}
			plugin := ds.Labels[datasourceV0.LabelKeyGroup]
			group := utils.SharedGroupFromLabel(datasourceV0.GROUP, plugin)
			if group == "" {
				continue
			}
			// Stored under the collection; hand callers the object as its own group serves it.
			ds.APIVersion = group + "/" + datasourceV0.VERSION
			if err := fn(&ds, group, plugin); err != nil {
				return err
			}
		}

		pageToken = rsp.NextPageToken
		if pageToken == "" {
			return nil
		}
	}
}

// unifiedConnections answers the connections endpoint from unified storage.
//
// The legacy implementation reads the data_source table, so it cannot see a data source written
// only through the API groups — which, once the collection reads unified, is every data source
// Git Sync provisions.
type unifiedConnections struct {
	client resource.ResourceClient
	ac     accesscontrol.AccessControl
}

var _ datasourceV0.DataSourceConnectionProvider = (*unifiedConnections)(nil)

// ProvideUnifiedConnections returns a connection provider backed by unified storage.
func ProvideUnifiedConnections(client resource.ResourceClient, ac accesscontrol.AccessControl) datasourceV0.DataSourceConnectionProvider {
	return &unifiedConnections{client: client, ac: ac}
}

// ListConnections implements [datasourceV0.DataSourceConnectionProvider].
func (c *unifiedConnections) ListConnections(ctx context.Context, query datasourceV0.DataSourceConnectionQuery) (*datasourceV0.DataSourceConnectionList, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	result := &datasourceV0.DataSourceConnectionList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: datasourceV0.SchemeGroupVersion.String(),
			Kind:       "DataSourceConnectionList",
		},
		Items: []datasourceV0.DataSourceConnection{},
	}

	err = eachStoredDataSource(ctx, c.client, query.Namespace, query.Name, func(ds *datasourceV0.DataSource, group, plugin string) error {
		if !canReadDataSource(ctx, c.ac, user, ds.Name) {
			return nil
		}
		result.Items = append(result.Items, datasourceV0.DataSourceConnection{
			Title:      ds.Spec.Title(),
			Name:       ds.Name,
			APIGroup:   group,
			APIVersion: datasourceV0.VERSION,
			Plugin:     plugin,
			Labels:     reportableLabels(ds.Labels),
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// ListStoredDataSources lists the collection as the legacy model, for the HTTP API's list route.
// One request covers every plugin type; see [eachStoredDataSource].
func ListStoredDataSources(
	ctx context.Context,
	client resource.ResourceClient,
	namespacer request.NamespaceMapper,
	namespace string,
) ([]*datasources.DataSource, error) {
	var found []*datasources.DataSource
	err := eachStoredDataSource(ctx, client, namespace, "", func(ds *datasourceV0.DataSource, group, plugin string) error {
		legacy, err := converter.NewConverter(namespacer, group, plugin, nil).AsLegacyDatasource(ds)
		if err != nil {
			return fmt.Errorf("converting data source %s: %w", ds.Name, err)
		}
		found = append(found, legacy)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return found, nil
}

// canReadDataSource mirrors the legacy provider: a data source the user cannot read is left out
// rather than failing the list.
func canReadDataSource(ctx context.Context, ac accesscontrol.AccessControl, user identity.Requester, uid string) bool {
	evaluator := accesscontrol.EvalPermission(datasources.ActionRead,
		datasources.ScopeProvider.GetResourceScopeUID(uid))
	ok, _ := ac.Evaluate(ctx, user, evaluator)
	return ok
}

// reportableLabels drops the reserved group label: it is storage bookkeeping, and the served group
// it encodes is reported as the connection's APIGroup instead.
func reportableLabels(labels map[string]string) map[string]string {
	var out map[string]string
	for key, value := range labels {
		if key == datasourceV0.LabelKeyGroup {
			continue
		}
		if out == nil {
			out = map[string]string{}
		}
		out[key] = value
	}
	return out
}
