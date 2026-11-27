package query

import (
	"context"
	"sync/atomic"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

// listedConnections answers the connections route from the datasource lister once the storage is
// built, and from its fallback until then.
type listedConnections struct {
	fallback datasourceV0.DataSourceConnectionProvider
	lister   atomic.Pointer[dataSourceLister]
}

var _ datasourceV0.DataSourceConnectionProvider = (*listedConnections)(nil)

func (c *listedConnections) useLister(l *dataSourceLister) {
	c.lister.Store(l)
}

// ListConnections implements [datasourceV0.DataSourceConnectionProvider].
func (c *listedConnections) ListConnections(ctx context.Context, query datasourceV0.DataSourceConnectionQuery) (*datasourceV0.DataSourceConnectionList, error) {
	lister := c.lister.Load()
	if lister == nil {
		return c.fallback.ListConnections(ctx, query)
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	ns, err := claims.ParseNamespace(query.Namespace)
	if err != nil {
		return nil, err
	}
	if ns.OrgID == 0 {
		return nil, apierrors.NewBadRequest("missing valid namespace")
	}
	if ns.OrgID != user.GetOrgID() { // We may allow services to access other orgs in the future
		return nil, apierrors.NewForbidden(lister.resource, query.Name, errUserNotInNamespace)
	}

	result := &datasourceV0.DataSourceConnectionList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: datasourceV0.SchemeGroupVersion.String(),
			Kind:       "DataSourceConnectionList",
		},
		Items: []datasourceV0.DataSourceConnection{},
	}

	if query.Name != "" {
		item, err := lister.lookup(ctx, user, ns.OrgID, query.Name)
		if err != nil && !apierrors.IsNotFound(err) {
			return nil, err
		}
		if item != nil {
			result.Items = append(result.Items, asConnection(*item))
		}
		return result, nil
	}

	items, err := lister.all(ctx, user, ns.OrgID)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		result.Items = append(result.Items, asConnection(item))
	}
	return result, nil
}

// asConnection is the connections projection of a listed datasource. The group label is left
// out: the group it names is the connection's group.
func asConnection(d listedDataSource) datasourceV0.DataSourceConnection {
	var labels map[string]string
	for k, v := range d.meta.Labels {
		if k == datasourceV0.LabelKeyGroup {
			continue
		}
		if labels == nil {
			labels = map[string]string{}
		}
		labels[k] = v
	}
	return datasourceV0.DataSourceConnection{
		Title:    d.title,
		Name:     d.meta.Name,
		APIGroup: d.group(),
		Plugin:   d.plugin,
		Labels:   labels,
	}
}
