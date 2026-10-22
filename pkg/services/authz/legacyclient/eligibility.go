package legacyclient

import (
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

// RemoteEligible checks configuration eligibility, not feature gates or caller authority.
// Call it before each remote selection because effective enforcement can change.
func RemoteEligible(cfg *setting.Cfg, license licensing.Licensing) bool {
	return cfg.SectionWithEnvOverrides("authorization").Key("mode").MustString("inproc") == "cloud" &&
		cfg.RBAC.SingleOrganization && license.FeatureEnabled("accesscontrol.enforcement")
}
