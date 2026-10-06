package legacypermissions

import (
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideClient(sql db.DB, catalog *RoleCatalog, actions ac.ActionResolver,
	cache *localcache.CacheService, cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	license licensing.Licensing, zanzanaClient zanzana.Client, restConfig restcfg.RestConfigProvider,
) types.LegacyAuthzService {
	var migrated MigratedPermissions
	// Preserve the independent enumeration-merge gate, not the Check/List engine selection.
	//nolint:staticcheck // The existing merge toggle is not migrated by this rollout.
	if features.IsEnabledGlobally(featuremgmt.FlagZanzanaMergeUserPermissions) && zanzanaClient != nil {
		// Current-user enumeration does not use the user service; only the out-of-scope
		// search methods need it. The REST client remains lazy to avoid an apiserver cycle.
		migrated = NewZanzanaPermissionResolver(zanzanaClient, nil, restConfig, cfg.IDUseExternalGroupsForGroupsClaim)
	}
	return NewEmbeddedClient(NewLoader(sql, catalog, actions, cache, cfg, features, license, migrated), cfg)
}
