package accesscontrol

import (
	"context"
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

// Filter creates a where clause to restrict the view of a query based on a users permissions
// Scopes for a certain action will be compared against prefix:id:sqlID where prefix is the scope prefix and sqlID
// is the id to generate scope from e.g. user.id
func Filter(ctx context.Context, sqlID, prefix, action string, user *models.SignedInUser) (SQLFilter, error) {
	if _, ok := sqlIDAcceptList[sqlID]; !ok {
		return denyQuery, errors.New("sqlID is not in the accept list")
	}
	if user == nil || user.Permissions == nil || user.Permissions[user.OrgId] == nil {
		return denyQuery, errors.New("missing permissions")
	}

	var hasWildcard bool
	var ids []interface{}
	for _, scope := range user.Permissions[user.OrgId][action] {
		if strings.HasPrefix(scope, prefix) || scope == "*" {
			if id := strings.TrimPrefix(scope, prefix); id == "*" || id == ":*" || id == ":id:*" {
				hasWildcard = true
				break
			}
			if id, err := parseScopeID(scope); err == nil {
				ids = append(ids, id)
			}
		}
	}

	if hasWildcard {
		return allowAllQuery, nil
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
