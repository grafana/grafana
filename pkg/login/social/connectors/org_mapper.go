package connectors

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
)

const MapperMatchAllOrgID = -1

type ExternalOrgRoleMapper struct {
	orgService org.Service
	logger     log.Logger
}

func NewExternalOrgRoleMapper(orgService org.Service) *ExternalOrgRoleMapper {
	return &ExternalOrgRoleMapper{
		orgService: orgService,
		logger:     log.New("org_mapper"),
	}
}

func (m *ExternalOrgRoleMapper) MapOrgRoles(orgs []string, orgMappingSettings []string, directlyMappedRole org.RoleType) (map[int64]org.RoleType, error) {
	orgMapping := m.splitOrgMappingSettings(orgMappingSettings)

	userOrgRoles := getMappedOrgRoles(orgs, orgMapping)

	m.handleGlobalOrgMapping(userOrgRoles)

	if directlyMappedRole == "" {
		m.logger.Debug("No direct role mapping found")
		return userOrgRoles, nil
	}

	m.logger.Debug("Direct role mapping found", "role", directlyMappedRole)

	// Merge roles from org mapping `org_mapping` with role from direct mapping `assertion_attribute_role`
	for orgID, role := range userOrgRoles {
		userOrgRoles[orgID] = getTopRole(directlyMappedRole, role)
	}

	return userOrgRoles, nil
}

func (m *ExternalOrgRoleMapper) handleGlobalOrgMapping(orgRoles map[int64]org.RoleType) {
	// No global role mapping => return
	globalRole, ok := orgRoles[MapperMatchAllOrgID]
	if !ok {
		return
	}

	allOrgIDs, err := m.getAllOrgs()
	if err != nil {
		// Prevent resetting assignments
		orgRoles = map[int64]org.RoleType{}
		m.logger.Warn("error fetching all orgs, removing org mapping to prevent org sync")
	}

	// Remove the global role mapping
	delete(orgRoles, MapperMatchAllOrgID)

	// Global mapping => for all orgs get top role mapping
	for orgID := range allOrgIDs {
		orgRoles[orgID] = getTopRole(orgRoles[orgID], globalRole)
	}
}

func (m *ExternalOrgRoleMapper) splitOrgMappingSettings(mappings []string) map[string]map[int64]org.RoleType {
	res := map[string]map[int64]org.RoleType{}

	for _, v := range mappings {
		kv := strings.Split(v, ":")
		if len(kv) > 1 {
			orgID, err := strconv.Atoi(kv[1])
			if err != nil && kv[1] != "*" {
				res, getErr := m.orgService.GetByName(context.Background(), &org.GetOrgByNameQuery{Name: kv[1]})

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

func (m *ExternalOrgRoleMapper) getAllOrgs() (map[int64]bool, error) {
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

func getMappedOrgRoles(orgs []string, orgMapping map[string]map[int64]org.RoleType) map[int64]org.RoleType {
	userOrgRoles := map[int64]org.RoleType{}

	if len(orgMapping) == 0 {
		return userOrgRoles
	}

	if orgRoles, ok := orgMapping["*"]; ok {
		for orgID, role := range orgRoles {
			userOrgRoles[orgID] = getTopRole(userOrgRoles[orgID], role)
		}
	}

	for _, org := range orgs {
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
