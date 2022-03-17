package accesscontrol

import (
	"errors"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/models"
)

var sqlIDAcceptList = map[string]struct{}{
	"org_user.user_id":    {},
	"role.id":             {},
	"t.id":                {},
	"team.id":             {},
	"u.id":                {},
	"\"user\".\"id\"":     {}, // For Postgres
	"`user`.`id`":         {}, // For MySQL and SQLite
	"dashboard.id":        {},
	"dashboard.folder_id": {},
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
func Filter(user *models.SignedInUser, sqlID, prefix string, actions ...string) (SQLFilter, error) {
	if _, ok := sqlIDAcceptList[sqlID]; !ok {
		return denyQuery, errors.New("sqlID is not in the accept list")
	}
	if user == nil || user.Permissions == nil || user.Permissions[user.OrgId] == nil {
		return denyQuery, errors.New("missing permissions")
	}

	wildcards := 0
	result := make(map[int64]int)
	for _, a := range actions {
		ids, hasWildcard := parseScopes(prefix, user.Permissions[user.OrgId][a])
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

func parseScopes(prefix string, scopes []string) (ids map[int64]struct{}, hasWildcard bool) {
	ids = make(map[int64]struct{})
	for _, scope := range scopes {
		if strings.HasPrefix(scope, prefix) || scope == "*" {
			if id := strings.TrimPrefix(scope, prefix); id == "*" || id == ":*" || id == ":id:*" {
				return nil, true
			}
			if id, err := parseScopeID(scope); err == nil {
				ids[id] = struct{}{}
			}
		}
	}
	return ids, false
}

func parseScopeID(scope string) (int64, error) {
	return strconv.ParseInt(scope[strings.LastIndex(scope, ":")+1:], 10, 64)
}

// SetAcceptListForTest allow us to mutate the list for blackbox testing
func SetAcceptListForTest(list map[string]struct{}) func() {
	original := sqlIDAcceptList
	sqlIDAcceptList = list
	return func() {
		sqlIDAcceptList = original
	}
}
