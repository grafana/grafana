// Package connections serves a cross-type list of datasource connections for a
// namespace. Unlike the per-plugin `{plugin}.datasource.grafana.app` groups, it
// answers for every datasource type in a single call.
//
// It reads the legacy `data_source` table through a legacysql.LegacyDatabaseProvider,
// so the same code serves single-tenant Grafana (plain table names) and the
// multi-tenant API server (hg_<slug>-qualified names).
package connections

import (
	"context"
	"errors"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

const dataSourceTable = "data_source"

// AliasResolver expands a plugin id into every id that may appear in the
// `type` column for it. Optional -- the multi-tenant API server has no plugin
// store, and passes nil to match on the plugin id alone.
type AliasResolver func(ctx context.Context, pluginID string) []string

// connectionRow is the subset of `data_source` needed to build a connection.
type connectionRow struct {
	UID  string `xorm:"uid"`
	Name string `xorm:"name"`
	Type string `xorm:"type"`
}

type legacySQLStore struct {
	sql          legacysql.LegacyDatabaseProvider
	accessClient authlib.AccessClient
	aliases      AliasResolver
}

var _ datasourceV0.DataSourceConnectionProvider = (*legacySQLStore)(nil)

// NewLegacySQLStore returns a connection provider backed by the legacy
// `data_source` table.
func NewLegacySQLStore(sql legacysql.LegacyDatabaseProvider, accessClient authlib.AccessClient, aliases AliasResolver) datasourceV0.DataSourceConnectionProvider {
	return &legacySQLStore{sql: sql, accessClient: accessClient, aliases: aliases}
}

func (s *legacySQLStore) ListConnections(ctx context.Context, query datasourceV0.DataSourceConnectionQuery) (*datasourceV0.DataSourceConnectionList, error) {
	ns, err := authlib.ParseNamespace(query.Namespace)
	if err != nil {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid namespace: %s", err))
	}
	// OrgID is 1 for stacks-<id>, and the real org for default/org-<id>, so the
	// same filter is correct in both single- and multi-tenant deployments.
	if ns.OrgID < 1 {
		return nil, apierrors.NewBadRequest("missing valid namespace")
	}

	rows, err := s.read(ctx, ns.OrgID, query)
	if err != nil {
		return nil, err
	}

	// A lookup by name that matched nothing is a 404, not an empty list. xorm
	// reports a miss as (false, nil), so this has to be explicit.
	if query.Name != "" && len(rows) == 0 {
		return nil, apierrors.NewNotFound(datasourceV0.DataSourceResourceInfo.GroupResource(), query.Name)
	}

	allowed, err := s.allowedChecker(ctx, ns)
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
	for _, row := range rows {
		if !allowed(row.UID, "") {
			continue
		}
		conn, err := asConnection(row)
		if err != nil {
			// An unmappable plugin id must not fail the whole list
			continue
		}
		result.Items = append(result.Items, conn)
	}
	return result, nil
}

// read runs the actual query. Every table reference goes through
// helper.Table so it resolves to hg_<slug>.data_source in multi-tenant.
func (s *legacySQLStore) read(ctx context.Context, orgID int64, query datasourceV0.DataSourceConnectionQuery) ([]connectionRow, error) {
	helper, err := s.sql(ctx)
	if err != nil {
		// A stack that is gone (deleted, archived, moved) is a 404, not a 500.
		if errors.Is(err, legacysql.ErrNamespaceNotFound) {
			return nil, apierrors.NewNotFound(datasourceV0.DataSourceResourceInfo.GroupResource(), query.Namespace)
		}
		return nil, err
	}

	rows := make([]connectionRow, 0)
	err = helper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		q := sess.Table(helper.Table(dataSourceTable)).
			Cols("uid", "name", "type").
			Where("org_id = ?", orgID)

		if query.Name != "" {
			q = q.And("uid = ?", query.Name)
		}
		if query.Plugin != "" {
			q = q.In("type", s.pluginTypes(ctx, query.Plugin))
		}

		return q.Asc("name").Find(&rows)
	})
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// pluginTypes returns the `type` values that count as the requested plugin.
func (s *legacySQLStore) pluginTypes(ctx context.Context, pluginID string) []string {
	if s.aliases == nil {
		return []string{pluginID}
	}
	aliases := s.aliases(ctx, pluginID)
	types := make([]string, 0, len(aliases)+1)
	types = append(types, pluginID)
	return append(types, aliases...)
}

func asConnection(row connectionRow) (datasourceV0.DataSourceConnection, error) {
	group, err := plugins.GetDatasourceGroupNameFromPluginID(row.Type)
	if err != nil {
		return datasourceV0.DataSourceConnection{}, err
	}
	return datasourceV0.DataSourceConnection{
		Title:      row.Name,
		Name:       row.UID,
		APIGroup:   group,
		APIVersion: datasourceV0.VERSION,
		Plugin:     row.Type,
	}, nil
}

// PluginAliasLookup resolves a plugin id to its registered aliases.
type PluginAliasLookup interface {
	Plugin(ctx context.Context, pluginID string) (pluginstore.Plugin, bool)
}

// NewStore builds a connection provider that resolves plugin aliases through the
// plugin store. Shared by every API group that serves the connections route.
func NewStore(sql legacysql.LegacyDatabaseProvider, accessClient authlib.AccessClient, plugins PluginAliasLookup) datasourceV0.DataSourceConnectionProvider {
	if plugins == nil {
		return NewLegacySQLStore(sql, accessClient, nil)
	}
	return NewLegacySQLStore(sql, accessClient, func(ctx context.Context, pluginID string) []string {
		p, found := plugins.Plugin(ctx, pluginID)
		if !found {
			return nil
		}
		return p.AliasIDs
	})
}
