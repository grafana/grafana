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

const mapperMatchAllOrgID = -1

// OrgRoleMapper maps external orgs/groups to Grafana orgs and basic roles.
type OrgRoleMapper struct {
	cfg        *setting.Cfg
	logger     log.Logger
	orgService org.Service
}

// OrgRoleMapping represents a single mapping from an external org to a Grafana org and role.
type OrgRoleMapping struct {
	ExternalOrg   string
	InternalOrgID int64
	Role          org.RoleType
	MapToAllOrgs  bool
}

// MappingConfiguration represents the mapping configuration from external orgs to Grafana orgs and roles.
// orgMapping: mapping from external orgs to Grafana orgs and roles
// strictRoleMapping: if true, the mapper ensures that the evaluated role from orgMapping or the directlyMappedRole is a valid role, otherwise it will return nil.
type MappingConfiguration struct {
	orgMappings       []OrgRoleMapping
	strictRoleMapping bool
}

func ProvideOrgRoleMapper(cfg *setting.Cfg, orgService org.Service) *OrgRoleMapper {
	return &OrgRoleMapper{
		cfg:        cfg,
		logger:     log.New("orgrole.mapper"),
		orgService: orgService,
	}
}

// MapOrgRoles maps the external orgs/groups to Grafana orgs and roles. It returns a map or orgID to role.
//
// mappingCfg: mapping configuration from external orgs to Grafana orgs and roles. Use `ParseOrgMappingSettings` to convert the raw setting to this format.
//
// externalOrgs: list of orgs/groups from the provider
//
// directlyMappedRole: role that is directly mapped to the user (ex: through `role_attribute_path`)
func (m *OrgRoleMapper) MapOrgRoles(
	mappingCfg *MappingConfiguration,
	externalOrgs []string,
	directlyMappedRole org.RoleType,
) map[int64]org.RoleType {
	if len(mappingCfg.orgMappings) == 0 {
		// Org mapping is not configured
		return m.getDefaultOrgMapping(mappingCfg.strictRoleMapping, directlyMappedRole)
	}

	userOrgRoles, globalRole := getMappedOrgRoles(externalOrgs, mappingCfg.orgMappings)

	if err := m.handleGlobalOrgMapping(userOrgRoles, globalRole); err != nil {
		// Cannot map global org roles, return nil (prevent resetting assignments)
		return nil
	}

	if len(userOrgRoles) == 0 {
		return m.getDefaultOrgMapping(mappingCfg.strictRoleMapping, directlyMappedRole)
	}

	if directlyMappedRole == "" {
		m.logger.Debug("No direct role mapping found")
		return userOrgRoles
	}

	m.logger.Debug("Direct role mapping found", "role", directlyMappedRole)

	// Merge roles from org mapping `org_mapping` with role from direct mapping
	for orgID, role := range userOrgRoles {
		userOrgRoles[orgID] = getTopRole(directlyMappedRole, role)
	}

	return userOrgRoles
}

func (m *OrgRoleMapper) getDefaultOrgMapping(strictRoleMapping bool, directlyMappedRole org.RoleType) map[int64]org.RoleType {
	if strictRoleMapping && !directlyMappedRole.IsValid() {
		m.logger.Debug("Prevent default org role mapping, role attribute strict requested")
		return nil
	}
	orgRoles := make(map[int64]org.RoleType, 0)

	orgID := int64(1)
	if m.cfg.AutoAssignOrg && m.cfg.AutoAssignOrgId > 0 {
		orgID = int64(m.cfg.AutoAssignOrgId)
	}

	orgRoles[orgID] = directlyMappedRole
	if !directlyMappedRole.IsValid() {
		orgRoles[orgID] = org.RoleType(m.cfg.AutoAssignOrgRole)
	}

	return orgRoles
}

func (m *OrgRoleMapper) handleGlobalOrgMapping(orgRoles map[int64]org.RoleType, globalRole org.RoleType) error {
	// No global role mapping => return
	if globalRole == "" {
		return nil
	}

	allOrgIDs, err := m.getAllOrgs()
	if err != nil {
		// Prevent resetting assignments
		clear(orgRoles)
		m.logger.Warn("error fetching all orgs, removing org mapping to prevent org sync")
		return err
	}

	// Global mapping => for all orgs get top role mapping
	for orgID := range allOrgIDs {
		orgRoles[orgID] = getTopRole(orgRoles[orgID], globalRole)
	}

	return nil
}

// ParseOrgMappingSettings parses the `org_mapping` setting and returns an internal representation of the mapping.
// If the roleStrict is enabled, the mapping should contain a valid role for each org.
func (m *OrgRoleMapper) ParseOrgMappingSettings(ctx context.Context, mappings []string, roleStrict bool) *MappingConfiguration {
	var res = []OrgRoleMapping{}
	var orderedResMap = make(map[string]OrgRoleMapping)
	for _, v := range mappings {
		kv := strings.Split(v, ":")
		if !isValidOrgMappingFormat(kv) {
			m.logger.Error("Skipping org mapping due to invalid format.", "mapping", fmt.Sprintf("%v", v))
			if roleStrict {
				// Return empty mapping if the mapping format is invalied and roleStrict is enabled
				return &MappingConfiguration{orgMappings: []OrgRoleMapping{}, strictRoleMapping: roleStrict}
			}
			continue
		}

		orgID, err := m.getOrgIDForInternalMapping(ctx, kv[1])
		if err != nil {
			m.logger.Warn("Could not fetch OrgID. Skipping.", "err", err, "mapping", fmt.Sprintf("%v", v), "org", kv[1])
			if roleStrict {
				// Return empty mapping if at least one org name cannot be resolved when roleStrict is enabled
				return &MappingConfiguration{orgMappings: []OrgRoleMapping{}, strictRoleMapping: roleStrict}
			}
			continue
		}

		if roleStrict && (len(kv) < 3 || !org.RoleType(kv[2]).IsValid()) {
			// Return empty mapping if at least one org mapping is invalid (missing role, invalid role)
			m.logger.Warn("Skipping org mapping due to missing or invalid role in mapping when roleStrict is enabled.", "mapping", fmt.Sprintf("%v", v))
			return &MappingConfiguration{orgMappings: []OrgRoleMapping{}, strictRoleMapping: roleStrict}
		}

		mapToAllOrgs := orgID == -1
		orgMap := OrgRoleMapping{
			ExternalOrg:  kv[0],
			Role:         getRoleForInternalOrgMapping(kv),
			MapToAllOrgs: mapToAllOrgs,
		}
		if mapToAllOrgs {
			orgMap.MapToAllOrgs = true
		} else {
			orgMap.InternalOrgID = int64(orgID)
		}
		orderedResMap[fmt.Sprintf("%s:%d", kv[0], orgID)] = orgMap
		res = convertOrderedResMapToSlice(orderedResMap)
	}

	return &MappingConfiguration{orgMappings: res, strictRoleMapping: roleStrict}
}

func convertOrderedResMapToSlice(orderedResMap map[string]OrgRoleMapping) []OrgRoleMapping {
	var res = []OrgRoleMapping{}
	for _, orgRoleMapping := range orderedResMap {
		res = append(res, orgRoleMapping)
	}
	return res
}

func (m *OrgRoleMapper) getOrgIDForInternalMapping(ctx context.Context, orgIdCfg string) (int, error) {
	if orgIdCfg == "*" {
		return mapperMatchAllOrgID, nil
	}

	orgID, err := strconv.Atoi(orgIdCfg)
	if err != nil {
		res, getErr := m.orgService.GetByName(ctx, &org.GetOrgByNameQuery{Name: orgIdCfg})

		if getErr != nil {
			// skip in case of error
			m.logger.Warn("Could not fetch organization. Skipping.", "err", err, "org", orgIdCfg)
			return 0, getErr
		}
		orgID = int(res.ID)
	}

	return orgID, nil
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

func getRoleForInternalOrgMapping(kv []string) org.RoleType {
	if len(kv) > 2 && org.RoleType(kv[2]).IsValid() {
		return org.RoleType(kv[2])
	}

	return org.RoleViewer
}

func isValidOrgMappingFormat(kv []string) bool {
	return len(kv) > 1 && len(kv) < 4
}

func getMappedOrgRoles(externalOrgs []string, orgMappings []OrgRoleMapping) (map[int64]org.RoleType, org.RoleType) {
	var globalRole org.RoleType
	userOrgRoles := map[int64]org.RoleType{}

	for _, mapping := range orgMappings {
		if mapping.ExternalOrg == "*" {
			userOrgRoles[mapping.InternalOrgID] = mapping.Role
		}
	}

	for _, externalOrg := range externalOrgs {
		for _, orgMapping := range orgMappings {
			if externalOrg == orgMapping.ExternalOrg {
				if orgMapping.MapToAllOrgs {
					globalRole = getTopRole(globalRole, orgMapping.Role)
				} else {
					userOrgRoles[orgMapping.InternalOrgID] = getTopRole(userOrgRoles[orgMapping.InternalOrgID], orgMapping.Role)
				}
			}
		}
	}

	return userOrgRoles, globalRole
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
