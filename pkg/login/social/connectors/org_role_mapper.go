package connectors

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

const MapperMatchAllOrgID = -1

type OrgRoleMapper struct {
	cfg        *setting.Cfg
	logger     log.Logger
	orgService org.Service
}

func ProvideOrgRoleMapper(cfg *setting.Cfg, orgService org.Service) *OrgRoleMapper {
	return &OrgRoleMapper{
		cfg:        cfg,
		logger:     log.New("orgrole.mapper"),
		orgService: orgService,
	}
}

func (m *OrgRoleMapper) MapOrgRoles(ctx context.Context, externalOrgs []string, orgMappingSettings []string, directlyMappedRole org.RoleType) (map[int64]org.RoleType, error) {
	orgMapping := m.splitOrgMappingSettings(ctx, orgMappingSettings)
	if len(orgMapping) == 0 {
		return m.GetDefaultOrgMapping(directlyMappedRole), nil
	}

	userOrgRoles := getMappedOrgRoles(externalOrgs, orgMapping)

	m.handleGlobalOrgMapping(userOrgRoles)

	if len(userOrgRoles) == 0 {
		return m.GetDefaultOrgMapping(directlyMappedRole), nil
	}

	if directlyMappedRole == "" {
		m.logger.Debug("No direct role mapping found")
		return userOrgRoles, nil
	}

	m.logger.Debug("Direct role mapping found", "role", directlyMappedRole)

	// Merge roles from org mapping `org_mapping` with role from direct mapping
	for orgID, role := range userOrgRoles {
		userOrgRoles[orgID] = getTopRole(directlyMappedRole, role)
	}

	return userOrgRoles, nil
}

func (m *OrgRoleMapper) GetDefaultOrgMapping(directlyMappedRole org.RoleType) map[int64]org.RoleType {
	orgRoles := make(map[int64]org.RoleType, 0)

	orgID := int64(1)
	if m.cfg.AutoAssignOrg && m.cfg.AutoAssignOrgId > 0 {
		orgID = int64(m.cfg.AutoAssignOrgId)
	}

	if directlyMappedRole == "" || !directlyMappedRole.IsValid() {
		orgRoles[orgID] = org.RoleType(m.cfg.AutoAssignOrgRole)
	} else {
		orgRoles[orgID] = directlyMappedRole
	}

	return orgRoles
}

func (m *OrgRoleMapper) handleGlobalOrgMapping(orgRoles map[int64]org.RoleType) {
	// No global role mapping => return
	globalRole, ok := orgRoles[MapperMatchAllOrgID]
	if !ok {
		return
	}

	allOrgIDs, err := m.getAllOrgs()
	if err != nil {
		// Prevent resetting assignments
		clear(orgRoles)
		m.logger.Warn("error fetching all orgs, removing org mapping to prevent org sync")
		return
	}

	// Remove the global role mapping
	delete(orgRoles, MapperMatchAllOrgID)

	// Global mapping => for all orgs get top role mapping
	for orgID := range allOrgIDs {
		orgRoles[orgID] = getTopRole(orgRoles[orgID], globalRole)
	}
}

func (m *OrgRoleMapper) splitOrgMappingSettings(ctx context.Context, mappings []string) map[string]map[int64]org.RoleType {
	res := map[string]map[int64]org.RoleType{}

	for _, v := range mappings {
		kv := strings.Split(v, ":")
		if len(kv) > 1 {
			orgID, err := strconv.Atoi(kv[1])
			if err != nil && kv[1] != "*" {
				res, getErr := m.orgService.GetByName(ctx, &org.GetOrgByNameQuery{Name: kv[1]})

				if getErr != nil {
					// ignore not existing org
					m.logger.Warn("Could not fetch organization. Skipping.", "mapping", fmt.Sprintf("%v", v))
					continue
				}
				orgID, err = int(res.ID), nil
			}
			if kv[1] == "*" {
				orgID, err = MapperMatchAllOrgID, nil
			}
			if err == nil {
				orga := kv[0]
				if res[orga] == nil {
					res[orga] = map[int64]org.RoleType{}
				}

				if len(kv) > 2 && org.RoleType(kv[2]).IsValid() {
					res[orga][int64(orgID)] = org.RoleType(kv[2])
				} else {
					res[orga][int64(orgID)] = org.RoleViewer
				}
			}
		}
	}

	return res
}

func (m *OrgRoleMapper) getAllOrgs() (map[int64]bool, error) {
	allOrgIDs := map[int64]bool{}
	allOrgs, err := m.orgService.Search(context.Background(), &org.SearchOrgsQuery{})
	if err != nil {
		// In case of error, return no orgs
		return nil, err
	}

	for _, org := range allOrgs {
		allOrgIDs[org.ID] = true
	}
	return allOrgIDs, nil
}

func getMappedOrgRoles(externalOrgs []string, orgMapping map[string]map[int64]org.RoleType) map[int64]org.RoleType {
	userOrgRoles := map[int64]org.RoleType{}

	if len(orgMapping) == 0 {
		return nil
	}

	if orgRoles, ok := orgMapping["*"]; ok {
		for orgID, role := range orgRoles {
			userOrgRoles[orgID] = role
		}
	}

	for _, org := range externalOrgs {
		orgRoles, ok := orgMapping[org]
		if !ok {
			continue
		}

		for orgID, role := range orgRoles {
			userOrgRoles[orgID] = getTopRole(userOrgRoles[orgID], role)
		}
	}

	return userOrgRoles
}

func getTopRole(currRole org.RoleType, otherRole org.RoleType) org.RoleType {
	if currRole == "" {
		return otherRole
	}

	if currRole.Includes(otherRole) {
		return currRole
	}

	return otherRole
}
