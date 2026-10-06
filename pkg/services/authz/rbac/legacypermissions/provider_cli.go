package legacypermissions

import (
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

// ProvideClientForCLI preserves CLI enumeration without a Zanzana merge,
// avoiding construction of the server/leader-election graph in CLI tools.
func ProvideClientForCLI(sql db.DB, catalog *RoleCatalog, actions ac.ActionResolver,
	cache *localcache.CacheService, cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	license licensing.Licensing,
) types.LegacyAuthzService {
	return NewEmbeddedClient(NewLoader(sql, catalog, actions, cache, cfg, features, license, nil), cfg)
}
