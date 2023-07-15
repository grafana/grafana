package clients

import (
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

// roleExtractor should return the org role, optional isGrafanaAdmin or an error
type roleExtractor func() (org.RoleType, *bool, error)

// getRoles only handles one org role for now, could be subject to change
func getRoles(cfg *setting.Cfg, extract roleExtractor) (map[int64]org.RoleType, *bool, error) {
	role, isGrafanaAdmin, err := extract()
	orgRoles := make(map[int64]org.RoleType, 0)
	if err != nil {
		return orgRoles, nil, err
	}

	if role == "" || !role.IsValid() {
		return orgRoles, nil, nil
	}

	orgID := int64(1)
	if cfg.AutoAssignOrg && cfg.AutoAssignOrgId > 0 {
		orgID = int64(cfg.AutoAssignOrgId)
	}
	orgRoles[orgID] = role

	return orgRoles, isGrafanaAdmin, nil
}
