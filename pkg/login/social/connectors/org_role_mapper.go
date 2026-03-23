package connectors

import (
	"context"
	"fmt"
	"maps"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	mapperMatchAllOrgID = -1
	escapeStr           = `\`
)

var separatorRegexp = regexp.MustCompile(":")

// OrgRoleMapper maps external orgs/groups to Grafana orgs and basic roles.
type OrgRoleMapper struct {
	cfg        *setting.Cfg
	logger     log.Logger
	orgService org.Service
}

// WildcardMapping represents a dynamic (that is, potentially containing a glob wildcard) org mapping that will not be
// resolved during the ParseOrgMappingSettings, but during MapOrgRoles when actual external orgs from the JWT are
// supplied.
type WildcardMapping struct {
	externalPattern string
	internalPattern string
	role            org.RoleType
}

// MappingConfiguration represents the mapping configuration from external orgs to Grafana orgs and roles.
// orgMapping: static mapping from external orgs to Grafana orgs and roles
// wildcardMappings: list of dynamic mappings to be resolved once an input value is supplied
// strictRoleMapping: if true, the mapper ensures that the evaluated role from orgMapping or the directlyMappedRole is a valid role, otherwise it will return nil.
// The MappingConfiguration could theoretically handle both static and dynamic (with wildcard) resolutions.
// In practice, it only does one or the other depending on a configuration setting.
type MappingConfiguration struct {
	orgMapping        map[string]map[int64]org.RoleType
	wildcardMappings  []WildcardMapping
	strictRoleMapping bool
}

func NewMappingConfiguration(orgMapping map[string]map[int64]org.RoleType, strictRoleMapping bool) MappingConfiguration {
	return MappingConfiguration{
		orgMapping,
		[]WildcardMapping{},
		strictRoleMapping,
	}
}

func NewDynamicMappingConfiguration(wildcardMappings []WildcardMapping, strictRoleMapping bool) MappingConfiguration {
	return MappingConfiguration{
		map[string]map[int64]org.RoleType{},
		wildcardMappings,
		strictRoleMapping,
	}
}

func ProvideOrgRoleMapper(cfg *setting.Cfg, orgService org.Service) *OrgRoleMapper {
	return &OrgRoleMapper{
		cfg:        cfg,
		logger:     log.New("orgrole.mapper"),
		orgService: orgService,
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
	if len(mappingCfg.orgMapping) == 0 && len(mappingCfg.wildcardMappings) == 0 {
		// Org mapping is not configured
		return m.getDefaultOrgMapping(mappingCfg.strictRoleMapping, directlyMappedRole)
	}

	userOrgRoles := getMappedOrgRoles(externalOrgs, mappingCfg.orgMapping)
	if userOrgRoles == nil {
		userOrgRoles = map[int64]org.RoleType{}
	}
	for _, externalOrg := range externalOrgs {
		additionalOrgRoles := m.resolveWildcardMappings(ctx, externalOrg, mappingCfg)
		maps.Copy(userOrgRoles, additionalOrgRoles)
	}

	if err := m.handleGlobalOrgMapping(userOrgRoles); err != nil {
		// Cannot map global org roles, return nil (prevent resetting asignments)
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

func (m *OrgRoleMapper) resolveWildcardMappings(ctx context.Context, externalOrg string, mappingConfiguration MappingConfiguration) map[int64]org.RoleType {
	orgRoles := make(map[int64]org.RoleType, 0)
	for _, mapping := range mappingConfiguration.wildcardMappings {
		found, internalOrg := getMappedOrgByWildcardMatch(mapping.externalPattern, mapping.internalPattern, externalOrg)
		if found {
			orgId, err := m.getOrgIDForInternalMapping(ctx, internalOrg)
			if err != nil {
				m.logger.Warn("Could not fetch OrgID. Skipping.", "err", err, "org", internalOrg)
				if mappingConfiguration.strictRoleMapping {
					return map[int64]org.RoleType{}
				}
				continue
			}
			orgRoles[int64(orgId)] = mapping.role
		}
	}
	return orgRoles
}

func (m *OrgRoleMapper) getDefaultOrgMapping(strictRoleMapping bool, directlyMappedRole org.RoleType) map[int64]org.RoleType {
	if strictRoleMapping && !directlyMappedRole.IsValid() {
		m.logger.Debug("Prevent default org role mapping, role attribute strict requested")
		return nil
	}
	orgRoles := make(map[int64]org.RoleType, 0)

	orgID := m.cfg.DefaultOrgID()

	orgRoles[orgID] = directlyMappedRole
	if !directlyMappedRole.IsValid() {
		orgRoles[orgID] = org.RoleType(m.cfg.AutoAssignOrgRole)
	}

	return orgRoles
}

func (m *OrgRoleMapper) handleGlobalOrgMapping(orgRoles map[int64]org.RoleType) error {
	// No global role mapping => return
	globalRole, ok := orgRoles[mapperMatchAllOrgID]
	if !ok {
		return nil
	}

	allOrgIDs, err := m.getAllOrgs()
	if err != nil {
		// Prevent resetting assignments
		clear(orgRoles)
		m.logger.Warn("error fetching all orgs, removing org mapping to prevent org sync")
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
// The resulting MappingConfiguration could theoretically handle both static and dynamic (by glob) resolutions.
// In practice, it only does one or the other depending on a configuration setting.
// FIXME: Consider introducing a struct to represent the org mapping settings
func (m *OrgRoleMapper) ParseOrgMappingSettings(ctx context.Context, mappings []string, roleStrict bool) MappingConfiguration {
	orgMapping := map[string]map[int64]org.RoleType{}
	wildcardMappings := []WildcardMapping{}

	for _, v := range mappings {
		kv := splitOrgMapping(v)
		if !isValidOrgMappingFormat(kv) {
			m.logger.Error("Skipping org mapping due to invalid format.", "mapping", fmt.Sprintf("%v", v))
			if roleStrict {
				// Return empty mapping if the mapping format is invalied and roleStrict is enabled
				return NewMappingConfiguration(map[string]map[int64]org.RoleType{}, roleStrict)
			}
			continue
		}

		if roleStrict && (len(kv) < 3 || !org.RoleType(kv[2]).IsValid()) {
			// Return empty mapping if at least one org mapping is invalid (missing role, invalid role)
			m.logger.Warn("Skipping org mapping due to missing or invalid role in mapping when roleStrict is enabled.", "mapping", fmt.Sprintf("%v", v))
			return NewMappingConfiguration(map[string]map[int64]org.RoleType{}, roleStrict)
		}
		role := getRoleForInternalOrgMapping(kv)

		if m.cfg.JWTAuth.AllowWildcardInOrgMapping {
			// We will only be able to resolve the information
			// during the actual mapping, so we just store the parsed mapping
			// and move on
			wildcardMappings = append(wildcardMappings, WildcardMapping{
				externalPattern: kv[0],
				internalPattern: kv[1],
				role:            role,
			})
			continue
		}

		orgID, err := m.getOrgIDForInternalMapping(ctx, kv[1])
		if err != nil {
			m.logger.Warn("Could not fetch OrgID. Skipping.", "err", err, "mapping", fmt.Sprintf("%v", v), "org", kv[1])
			if roleStrict {
				// Return empty mapping if at least one org name cannot be resolved when roleStrict is enabled
				return NewMappingConfiguration(map[string]map[int64]org.RoleType{}, roleStrict)
			}
			continue
		}

		orga := kv[0]
		if orgMapping[orga] == nil {
			orgMapping[orga] = map[int64]org.RoleType{}
		}

		orgMapping[orga][int64(orgID)] = role
	}

	return MappingConfiguration{
		orgMapping:        orgMapping,
		wildcardMappings:  wildcardMappings,
		strictRoleMapping: roleStrict,
	}
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

func splitOrgMapping(mapping string) []string {
	result := make([]string, 0, 3)
	matches := separatorRegexp.FindAllStringIndex(mapping, -1)
	from := 0

	for _, match := range matches {
		// match[0] is the start, match[1] is the end of the match
		start, end := match[0], match[1]
		// Check if the match is not preceded by two backslashes
		if start == 0 || mapping[start-1:start] != escapeStr {
			result = append(result, strings.ReplaceAll(mapping[from:end-1], escapeStr, ""))
			from = end
		}
	}

	result = append(result, mapping[from:])
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
		maps.Copy(userOrgRoles, orgRoles)
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

// getMappedOrgByWildcardMatch performs a mapping from src to dst, allowing a single wildcard.
// The value matched by src's wildcard is substituted into dst's wildcard position.
// If neither src nor dst have a wildcard, the function simply returns dst.
// If only src contains a wildcard, the function will return src if input matches the internal pattern.
// If only dst contains a wildcard, the match will always fail.
// FIXME: We could imagine supporting the last case, but that would require reworking the store to be able to search
// on more generic LIKE patterns, and right now it can only handle prefix match.
//
// Examples:
//
// getMappedOrgByWildcardMatch("*_admin", "*", "foo_admin")                  => true, "foo"
// getMappedOrgByWildcardMatch("team_*", "grafana_*", "team_dev")            => true, "grafana_dev"
// getMappedOrgByWildcardMatch("*_admin", "*", "foo_other")                  => false, ""
// getMappedOrgByWildcardMatch("*_admin", "internalOrg", "foo_admin")        => true, "internalOrg"
func getMappedOrgByWildcardMatch(src, dst, input string) (bool, string) {
	srcPrefix, srcSuffix, srcHasStar := strings.Cut(src, "*")
	dstPrefix, dstSuffix, dstHasStar := strings.Cut(dst, "*")

	if !srcHasStar && !dstHasStar {
		return true, dst
	}

	if !srcHasStar {
		return false, ""
	}

	// Poor man's glob match: we sucessively cut the prefix and the suffix from the input
	// to get the captured match in-between, checking each time we managed to do so.
	rest, matchesPrefix := strings.CutPrefix(input, srcPrefix)
	if !matchesPrefix {
		return false, ""
	}
	capture, matchesSuffix := strings.CutSuffix(rest, srcSuffix)
	if !matchesSuffix {
		return false, ""
	}

	if !dstHasStar {
		return true, dst
	}
	return true, dstPrefix + capture + dstSuffix
}
