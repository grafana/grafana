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

// MappingConfiguration represents the mapping configuration from external orgs to Grafana orgs and roles.
// entries: a list of mappings associating a potential external org to a Grafana org and role
// strictRoleMapping: if true, the mapper ensures that the evaluated role from orgMapping or the directlyMappedRole is a valid role, otherwise it will return nil.
type MappingConfiguration struct {
	entries           []MappingEntry
	strictRoleMapping bool
}

func NewMappingConfiguration(entries []MappingEntry, strictRoleMapping bool) MappingConfiguration {
	return MappingConfiguration{
		entries,
		strictRoleMapping,
	}
}

// MappingEntry represents a mapping from an external claim to a Grafana org and role
// The source of the mapping can be a regexp, in which case the Grafana org and role will be expanded with
// capture groups found by matching the source against the user informatoin during login
// externalClaim: the external claim to associate. Kept as a string alongside the pattern in case
// it is a special case or not a valid regexp
// externalClaimPattern: a compiled regexp from the externalClaim. If not nit, it will be used to expand the associated
// Grafana org and role
// mappedOrgTemplate: the Grafana org that should be given in case of a match.
// mappedRoleTemplate: the Grafana role that should be given in case of a match.
type MappingEntry struct {
	externalClaim        string
	externalClaimPattern *regexp.Regexp
	mappedOrgTemplate    string
	mappedRoleTemplate   string
}

func NewMappingEntry(externalClaim string, externalClaimPattern *regexp.Regexp, mappedOrgTemplate string, mappedRoleTemplate string) MappingEntry {
	return MappingEntry{
		externalClaim,
		externalClaimPattern,
		mappedOrgTemplate,
		mappedRoleTemplate,
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
	orgMapping := m.resolveOrgMappings(ctx, externalOrgs, mappingCfg)
	if len(orgMapping) == 0 {
		// Org mapping is not configured
		return m.getDefaultOrgMapping(mappingCfg.strictRoleMapping, directlyMappedRole)
	}

	userOrgRoles := getMappedOrgRoles(externalOrgs, orgMapping)

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

func (m *OrgRoleMapper) resolveOrgMappings(ctx context.Context, externalOrgs []string, mappingConfiguration MappingConfiguration) map[string]map[int64]org.RoleType {
	res := map[string]map[int64]org.RoleType{}
	for _, input := range externalOrgs {
		for _, entry := range mappingConfiguration.entries {
			source := entry.externalClaim
			mappedOrg := entry.mappedOrgTemplate
			mappedRole := entry.mappedRoleTemplate

			if entry.externalClaimPattern != nil {
				match := entry.externalClaimPattern.FindStringSubmatchIndex(input)
				if match != nil {
					mappedOrg = string(entry.externalClaimPattern.ExpandString(nil, entry.mappedOrgTemplate, input, match))
					mappedRole = string(entry.externalClaimPattern.ExpandString(nil, entry.mappedRoleTemplate, input, match))
					source = input
				}
			}

			orgId, err := m.getOrgIDForInternalMapping(ctx, mappedOrg)
			if err != nil {
				m.logger.Warn("Could not fetch OrgID. Skipping.", "err", err, "mapping", fmt.Sprintf("%v", entry), "org", mappedOrg)
				if mappingConfiguration.strictRoleMapping {
					// Return empty mapping if at least one org name cannot be resolved when roleStrict is enabled
					m.logger.Warn("Skipping org mapping due to missing org role in mapping when roleStrict is enabled.", "mapping", fmt.Sprintf("%v", entry), "org", mappedOrg)
					return map[string]map[int64]org.RoleType{}
				}
				continue
			}
			if res[source] == nil {
				res[source] = map[int64]org.RoleType{}
			}
			role := org.RoleType(mappedRole)
			if role.IsValid() {
				res[source][int64(orgId)] = role
			} else {
				if mappingConfiguration.strictRoleMapping {
					// Return empty mapping if at least one org mapping is invalid
					m.logger.Warn("Skipping org mapping due to invalid role in mapping when roleStrict is enabled.", "mapping", fmt.Sprintf("%v", entry), "role", mappedRole)
					return map[string]map[int64]org.RoleType{}
				} else {
					// Default to Viewer otherwise
					res[source][int64(orgId)] = org.RoleViewer
				}
			}
		}
	}

	return res
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
// If the roleStrict is enabled, the mapping should contain a role for each org, and any parsing failure will cause the
// entire result to be empty
func (m *OrgRoleMapper) ParseOrgMappingSettings(ctx context.Context, mappings []string, roleStrict bool) MappingConfiguration {
	entries := []MappingEntry{}

	for _, v := range mappings {
		kv := splitOrgMapping(v)
		if !isValidOrgMappingFormat(kv) {
			m.logger.Error("Skipping org mapping due to invalid format.", "mapping", fmt.Sprintf("%v", v))
			if roleStrict {
				// Return empty mapping if the mapping format is invalid and roleStrict is enabled
				return NewMappingConfiguration([]MappingEntry{}, roleStrict)
			}
			continue
		}
		var externalClaimPattern *regexp.Regexp
		if kv[0] != "*" {
			res, err := regexp.Compile(kv[0])
			if err != nil {
				m.logger.Info("Could not compile pattern into regexp, no replacement will be made", "mapping", fmt.Sprintf("%v", v))
			}
			externalClaimPattern = res
		}
		var roleTemplate string

		if len(kv) < 3 {
			if roleStrict {
				m.logger.Warn("Skipping org mapping due to missing role in mapping when roleStrict is enabled.", "mapping", fmt.Sprintf("%v", v))
				return NewMappingConfiguration([]MappingEntry{}, roleStrict)
			}
			roleTemplate = string(org.RoleViewer)
		} else {
			roleTemplate = kv[2]
		}
		entries = append(entries, NewMappingEntry(
			kv[0],
			externalClaimPattern,
			kv[1],
			roleTemplate,
		))
	}

	return NewMappingConfiguration(entries, roleStrict)
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
