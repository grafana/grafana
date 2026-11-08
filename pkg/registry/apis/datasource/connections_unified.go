package datasource

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/datasource/converter"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
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

// newUnifiedConnections returns a connection provider backed by unified storage.
func newUnifiedConnections(client resource.ResourceClient, ac accesscontrol.AccessControl) *unifiedConnections {
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
			Title:       ds.Spec.Title(),
			Name:        ds.Name,
			APIGroup:    group,
			Plugin:      plugin,
			URL:         ds.Spec.URL(),
			Labels:      reportableLabels(ds.Labels),
			Annotations: ds.Annotations,
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

// DataSourceCollectionResource names the resource whose storage mode decides where data sources are
// read from. Every plugin type shares it; see [eachStoredDataSource].
var DataSourceCollectionResource = schema.GroupResource{
	Group:    datasourceV0.GROUP,
	Resource: datasourceV0.DataSourceResourceInfo.GetName(),
}

// storageAwareConnections answers the connections endpoint from whichever store actually holds the
// data sources, which the API groups being served does not tell you: the groups migrate first and
// the data follows.
//
//   - Legacy: list from the data_source table. The collection is empty.
//   - Dual write: list from the table, which is the complete one -- the collection holds only what
//     has been written since dual-write started -- and take the manager annotations from the
//     collection, the only store with a place for them.
//   - Unified: list from the collection. The table is no longer written.
type storageAwareConnections struct {
	legacy  datasourceV0.DataSourceConnectionProvider
	unified *unifiedConnections
	storage dualwrite.Service
	logger  log.Logger
}

// ProvideConnections returns a connection provider that follows the data source storage mode.
func ProvideConnections(
	legacy datasourceV0.DataSourceConnectionProvider,
	client resource.ResourceClient,
	ac accesscontrol.AccessControl,
	storage dualwrite.Service,
) datasourceV0.DataSourceConnectionProvider {
	return &storageAwareConnections{
		legacy:  legacy,
		unified: newUnifiedConnections(client, ac),
		storage: storage,
		logger:  log.New("datasource.connections"),
	}
}

// ListConnections implements [datasourceV0.DataSourceConnectionProvider].
func (c *storageAwareConnections) ListConnections(ctx context.Context, query datasourceV0.DataSourceConnectionQuery) (*datasourceV0.DataSourceConnectionList, error) {
	status, err := c.storage.Status(ctx, DataSourceCollectionResource)
	if err != nil {
		// The table is what every deployment that has not migrated needs, so prefer it when the
		// mode cannot be read rather than listing a collection that may hold nothing.
		c.logger.Warn("could not read the data source storage mode, listing connections from legacy", "error", err)
		return c.legacy.ListConnections(ctx, query)
	}
	if status.ReadUnified {
		return c.unified.ListConnections(ctx, query)
	}

	list, err := c.legacy.ListConnections(ctx, query)
	if err != nil || !status.WriteUnified || len(list.Items) == 0 {
		return list, err
	}
	c.annotate(ctx, query, list)
	return list, nil
}

// annotate fills in the manager annotations from the collection. A failed read leaves the list as
// it is: the annotations only drive the provisioning surfaces, and losing the list costs more.
func (c *storageAwareConnections) annotate(ctx context.Context, query datasourceV0.DataSourceConnectionQuery, list *datasourceV0.DataSourceConnectionList) {
	annotations := map[string]map[string]string{}
	err := eachStoredDataSource(ctx, c.unified.client, query.Namespace, query.Name, func(ds *datasourceV0.DataSource, _, _ string) error {
		if len(ds.Annotations) > 0 {
			annotations[ds.Name] = ds.Annotations
		}
		return nil
	})
	if err != nil {
		c.logger.Warn("could not read the data source annotations from unified storage", "error", err)
		return
	}
	for i := range list.Items {
		if found, ok := annotations[list.Items[i].Name]; ok {
			list.Items[i].Annotations = found
		}
	}
}
