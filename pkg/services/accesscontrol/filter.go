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
// The attribute parameter determines how the scope will be parsed, currently supported attributes is "id" and "uid"
func Filter(user *models.SignedInUser, sqlID, prefix, attribute string, actions ...string) (SQLFilter, error) {
	if _, ok := sqlIDAcceptList[sqlID]; !ok {
		return denyQuery, errors.New("sqlID is not in the accept list")
	}
	if user == nil || user.Permissions == nil || user.Permissions[user.OrgId] == nil {
		return denyQuery, errors.New("missing permissions")
	}

	wildcards := 0
	result := make(map[interface{}]int)
	for _, a := range actions {
		ids, hasWildcard := parseScopes(prefix, attribute, user.Permissions[user.OrgId][a])
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

func parseScopes(prefix, attribute string, scopes []string) (ids map[interface{}]struct{}, hasWildcard bool) {
	ids = make(map[interface{}]struct{})
	scopePrefix := Scope(prefix, attribute)
	parser, ok := scopeParsers[attribute]

	for _, scope := range scopes {
		if strings.HasPrefix(scope, prefix) || scope == "*" {
			if id := strings.TrimPrefix(scope, prefix+":"); id == "*" || id == attribute+":*" {
				return nil, true
			}

			if !ok || !strings.HasPrefix(scope, scopePrefix) {
				continue
			}

			if id, err := parser(scope); err == nil {
				ids[id] = struct{}{}
			}
		}
	}
	return ids, false
}

type scopeParser func(scope string) (interface{}, error)

var scopeParsers = map[string]scopeParser{
	"id":  parseScopeID,
	"uid": parseScopeUID,
}

func parseScopeID(scope string) (interface{}, error) {
	return strconv.ParseInt(scope[strings.LastIndex(scope, ":")+1:], 10, 64)
}

func parseScopeUID(scope string) (interface{}, error) {
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
