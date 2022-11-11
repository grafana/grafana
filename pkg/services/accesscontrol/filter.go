package accesscontrol

import (
	"errors"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/user"
)

var sqlIDAcceptList = map[string]struct{}{
	"id":               {},
	"org_user.user_id": {},
	"role.uid":         {},
	"t.id":             {},
	"team.id":          {},
	"u.id":             {},
	"\"user\".\"id\"":  {}, // For Postgres
	"`user`.`id`":      {}, // For MySQL and SQLite
	"dashboard.uid":    {},
}

var (
	denyQuery     = SQLFilter{" 1 = 0", nil}
	allowAllQuery = SQLFilter{" 1 = 1", nil}
)

type SQLFilter struct {
	Where string
	Args  []interface{}
}

// Filter creates a where clause to restrict the view of a query based on a users permissions
// Scopes that exists for all actions will be parsed and compared against the supplied sqlID
// Prefix parameter is the prefix of the scope that we support (e.g. "users:id:")
func Filter(user *user.SignedInUser, sqlID, prefix string, actions ...string) (SQLFilter, error) {
	if _, ok := sqlIDAcceptList[sqlID]; !ok {
		return denyQuery, errors.New("sqlID is not in the accept list")
	}
	if user == nil || user.Permissions == nil || user.Permissions[user.OrgID] == nil {
		return denyQuery, errors.New("missing permissions")
	}

	wildcards := 0
	result := make(map[interface{}]int)
	for _, a := range actions {
		ids, hasWildcard := ParseScopes(prefix, user.Permissions[user.OrgID][a])
		if hasWildcard {
			wildcards += 1
			continue
		}
		if len(ids) == 0 {
			return denyQuery, nil
		}
		for id := range ids {
			result[id] += 1
		}
	}

	// return early if every action has wildcard scope
	if wildcards == len(actions) {
		return allowAllQuery, nil
	}

	var ids []interface{}
	for id, count := range result {
		// if an id exist for every action include it in the filter
		if count+wildcards == len(actions) {
			ids = append(ids, id)
		}
	}

	if len(ids) == 0 {
		return denyQuery, nil
	}

	query := strings.Builder{}
	query.WriteRune(' ')
	query.WriteString(sqlID)
	query.WriteString(" IN ")
	query.WriteString("(?")
	query.WriteString(strings.Repeat(",?", len(ids)-1))
	query.WriteRune(')')

	return SQLFilter{query.String(), ids}, nil
}

func ParseScopes(prefix string, scopes []string) (ids map[interface{}]struct{}, hasWildcard bool) {
	ids = make(map[interface{}]struct{})

	parser := parseStringAttribute
	if strings.HasSuffix(prefix, ":id:") {
		parser = parseIntAttribute
	}

	wildcards := WildcardsFromPrefix(prefix)

	for _, scope := range scopes {
		if wildcards.Contains(scope) {
			return nil, true
		}

		if strings.HasPrefix(scope, prefix) {
			if id, err := parser(scope); err == nil {
				ids[id] = struct{}{}
			}
		}
	}
	return ids, false
}

func parseIntAttribute(scope string) (interface{}, error) {
	return strconv.ParseInt(scope[strings.LastIndex(scope, ":")+1:], 10, 64)
}

func parseStringAttribute(scope string) (interface{}, error) {
	return scope[strings.LastIndex(scope, ":")+1:], nil
}

// SetAcceptListForTest allow us to mutate the list for blackbox testing
func SetAcceptListForTest(list map[string]struct{}) func() {
	original := sqlIDAcceptList
	sqlIDAcceptList = list
	return func() {
		sqlIDAcceptList = original
	}
}

func UserRolesFilter(orgID, userID int64, teamIDs []int64, roles []string) (string, []interface{}) {
	var params []interface{}
	builder := strings.Builder{}

	// This is an additional security. We should never have permissions granted to userID 0.
	// Only allow real users to get user/team permissions (anonymous/apikeys)
	if userID > 0 {
		builder.WriteString(`
			SELECT ur.role_id
			FROM user_role AS ur
			WHERE ur.user_id = ?
			AND (ur.org_id = ? OR ur.org_id = ?)
		`)
		params = []interface{}{userID, orgID, GlobalOrgID}
	}

	if len(teamIDs) > 0 {
		if builder.Len() > 0 {
			builder.WriteString("UNION")
		}
		builder.WriteString(`
			SELECT tr.role_id FROM team_role as tr
			WHERE tr.team_id IN(?` + strings.Repeat(", ?", len(teamIDs)-1) + `)
			AND tr.org_id = ?
		`)
		for _, id := range teamIDs {
			params = append(params, id)
		}
		params = append(params, orgID)
	}

	if len(roles) != 0 {
		if builder.Len() > 0 {
			builder.WriteString("UNION")
		}

		builder.WriteString(`
			SELECT br.role_id FROM builtin_role AS br
			WHERE br.role IN (?` + strings.Repeat(", ?", len(roles)-1) + `)
			AND (br.org_id = ? OR br.org_id = ?)
		`)
		for _, role := range roles {
			params = append(params, role)
		}

		params = append(params, orgID, GlobalOrgID)
	}

	return "INNER JOIN (" + builder.String() + ") as all_role ON role.id = all_role.role_id", params
}
