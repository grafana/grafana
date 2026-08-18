package connectors

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
)

const mapperMatchAllOrgID = -1

// OrgRoleMapper maps external orgs/groups to Grafana orgs and basic roles.
type OrgRoleMapper struct {
	cfgProvider configprovider.ConfigProvider
	logger      log.Logger
	orgService  org.Service
}

// MappingConfiguration represents the mapping configuration from external orgs to Grafana orgs and roles.
// orgMapping: mapping from external orgs to Grafana orgs and roles
// strictRoleMapping: if true, the mapper ensures that the evaluated role from orgMapping or the directlyMappedRole is a valid role, otherwise it will return nil.
type MappingConfiguration struct {
	orgMapping        map[string]map[int64]org.RoleType
	strictRoleMapping bool
}

func NewMappingConfiguration(orgMapping map[string]map[int64]org.RoleType, strictRoleMapping bool) MappingConfiguration {
	return MappingConfiguration{
		orgMapping,
		strictRoleMapping,
	}
}

func ProvideOrgRoleMapper(cfgProvider configprovider.ConfigProvider, orgService org.Service) *OrgRoleMapper {
	return &OrgRoleMapper{
		cfgProvider: cfgProvider,
		logger:      log.New("orgrole.mapper"),
		orgService:  orgService,
	}
}

// MapOrgRoles maps the external orgs/groups to Grafana orgs and roles. It returns a  map or orgID to role.
//
// mappingCfg: mapping configuration from external orgs to Grafana orgs and roles. Use `ParseOrgMappingSettings` to convert the raw setting to this format.
//
// externalOrgs: list of orgs/groups from the provider
//
// directlyMappedRole: role that is directly mapped to the user (ex: through `role_attribute_path`)
func (m *OrgRoleMapper) MapOrgRoles(
	ctx context.Context,
	mappingCfg MappingConfiguration,
	externalOrgs []string,
	directlyMappedRole org.RoleType,
) map[int64]org.RoleType {
	orgRoles, err := m.MapOrgRolesContext(ctx, mappingCfg, externalOrgs, directlyMappedRole)
	if err != nil {
		m.logger.FromContext(ctx).Warn("Failed to map organization roles", "error", err)
		return nil
	}
	return orgRoles
}

// MapOrgRolesContext maps external orgs and roles using configuration resolved
// for the request in ctx.
func (m *OrgRoleMapper) MapOrgRolesContext(
	ctx context.Context,
	mappingCfg MappingConfiguration,
	externalOrgs []string,
	directlyMappedRole org.RoleType,
) (map[int64]org.RoleType, error) {
	logger := m.logger.FromContext(ctx)

	if len(mappingCfg.orgMapping) == 0 {
		// Org mapping is not configured
		return m.getDefaultOrgMapping(ctx, mappingCfg.strictRoleMapping, directlyMappedRole)
	}

	userOrgRoles := getMappedOrgRoles(externalOrgs, mappingCfg.orgMapping)

	if err := m.handleGlobalOrgMapping(ctx, userOrgRoles); err != nil {
		// Cannot map global org roles, return nil (prevent resetting asignments)
		return nil, nil
	}

	if len(userOrgRoles) == 0 {
		return m.getDefaultOrgMapping(ctx, mappingCfg.strictRoleMapping, directlyMappedRole)
	}

	if directlyMappedRole == "" {
		logger.Debug("No direct role mapping found")
		return userOrgRoles, nil
	}

	logger.Debug("Direct role mapping found", "role", directlyMappedRole)

	// Merge roles from org mapping `org_mapping` with role from direct mapping
	for orgID, role := range userOrgRoles {
		userOrgRoles[orgID] = getTopRole(directlyMappedRole, role)
	}

	return userOrgRoles, nil
}

func (m *OrgRoleMapper) getDefaultOrgMapping(ctx context.Context, strictRoleMapping bool, directlyMappedRole org.RoleType) (map[int64]org.RoleType, error) {
	if strictRoleMapping && !directlyMappedRole.IsValid() {
		m.logger.FromContext(ctx).Debug("Prevent default org role mapping, role attribute strict requested")
		return nil, nil
	}

	cfg, err := m.cfgProvider.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get configuration for default org mapping: %w", err)
	}

	orgRoles := make(map[int64]org.RoleType, 0)

	orgID := cfg.DefaultOrgID()

	orgRoles[orgID] = directlyMappedRole
	if !directlyMappedRole.IsValid() {
		orgRoles[orgID] = org.RoleType(cfg.AutoAssignOrgRole)
	}

	return orgRoles, nil
}

func (m *OrgRoleMapper) handleGlobalOrgMapping(ctx context.Context, orgRoles map[int64]org.RoleType) error {
	// No global role mapping => return
	globalRole, ok := orgRoles[mapperMatchAllOrgID]
	if !ok {
		return nil
	}

	allOrgIDs, err := m.getAllOrgs(ctx)
	if err != nil {
		// Prevent resetting assignments
		clear(orgRoles)
		m.logger.FromContext(ctx).Warn("error fetching all orgs, removing org mapping to prevent org sync")
		return err
	}

	// Remove the global role mapping
	delete(orgRoles, mapperMatchAllOrgID)

	// Global mapping => for all orgs get top role mapping
	for orgID := range allOrgIDs {
		orgRoles[orgID] = getTopRole(orgRoles[orgID], globalRole)
	}

	return nil
}

// ParseOrgMappingSettings parses the `org_mapping` setting and returns an internal representation of the mapping.
// If the roleStrict is enabled, the mapping should contain a valid role for each org.
// FIXME: Consider introducing a struct to represent the org mapping settings
func (m *OrgRoleMapper) ParseOrgMappingSettings(ctx context.Context, mappings []string, roleStrict bool) MappingConfiguration {
	res := map[string]map[int64]org.RoleType{}

	for _, v := range mappings {
		kv := splitOrgMapping(v)
		if !isValidOrgMappingFormat(kv) {
			m.logger.FromContext(ctx).Error("Skipping org mapping due to invalid format.", "mapping", fmt.Sprintf("%v", v))
			if roleStrict {
				// Return empty mapping if the mapping format is invalied and roleStrict is enabled
				return NewMappingConfiguration(map[string]map[int64]org.RoleType{}, roleStrict)
			}
			continue
		}

		orgID, err := m.getOrgIDForInternalMapping(ctx, kv[1])
		if err != nil {
			m.logger.FromContext(ctx).Warn("Could not fetch OrgID. Skipping.", "err", err, "mapping", fmt.Sprintf("%v", v), "org", kv[1])
			if roleStrict {
				// Return empty mapping if at least one org name cannot be resolved when roleStrict is enabled
				return NewMappingConfiguration(map[string]map[int64]org.RoleType{}, roleStrict)
			}
			continue
		}

		if roleStrict && (len(kv) < 3 || !org.RoleType(kv[2]).IsValid()) {
			// Return empty mapping if at least one org mapping is invalid (missing role, invalid role)
			m.logger.FromContext(ctx).Warn("Skipping org mapping due to missing or invalid role in mapping when roleStrict is enabled.", "mapping", fmt.Sprintf("%v", v))
			return NewMappingConfiguration(map[string]map[int64]org.RoleType{}, roleStrict)
		}

		orga := kv[0]
		if res[orga] == nil {
			res[orga] = map[int64]org.RoleType{}
		}

		res[orga][int64(orgID)] = getRoleForInternalOrgMapping(kv)
	}

	return NewMappingConfiguration(res, roleStrict)
}

func (m *OrgRoleMapper) getOrgIDForInternalMapping(ctx context.Context, orgIdCfg string) (int, error) {
	if orgIdCfg == "*" {
		return mapperMatchAllOrgID, nil
	}

	if orgIdCfg == "" {
		return 0, fmt.Errorf("the org name or id is empty")
	}

	orgID, err := strconv.Atoi(orgIdCfg)
	if err != nil {
		res, getErr := m.orgService.GetByName(ctx, &org.GetOrgByNameQuery{Name: orgIdCfg})

		if getErr != nil {
			// skip in case of error
			m.logger.FromContext(ctx).Warn("Could not fetch organization. Skipping.", "err", err, "org", orgIdCfg)
			return 0, getErr
		}
		orgID = int(res.ID)
	}

	return orgID, nil
}

func (m *OrgRoleMapper) getAllOrgs(ctx context.Context) (map[int64]bool, error) {
	allOrgIDs := map[int64]bool{}
	allOrgs, err := m.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		// In case of error, return no orgs
		return nil, err
	}

	for _, org := range allOrgs {
		allOrgIDs[org.ID] = true
	}
	return allOrgIDs, nil
}

func splitOrgMapping(mapping string) []string {
	result := make([]string, 0, 3)
	current := ""

	for i := 0; i < len(mapping); i++ {
		switch mapping[i] {
		case ':':
			// Split on unescaped separators only.
			result = append(result, current)
			current = ""
		// Note that this case is matching against a single backslash.
		case '\\':
			// Only `\:` is a special escape sequence for org_mapping parsing.
			// Preserve backslashes verbatim for values like domain\\group.
			if i+1 < len(mapping) && mapping[i+1] == ':' {
				current += ":"
				i++
				continue
			}
			current += string(mapping[i])
		default:
			current += string(mapping[i])
		}
	}

	result = append(result, current)
	if len(result) > 3 {
		return []string{}
	}

	return result
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
