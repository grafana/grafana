package accesscontrol

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

var sqlIDAcceptList = map[string]struct{}{}

type SQLDialect interface {
	DriverName() string
}

// Filter creates a where clause to restrict the view of a query based on a users permissions
// Scopes for a certain action will be compared against prefix:id:sqlID where prefix is the scope prefix and sqlID
// is the id to generate scope from e.g. user.id
func Filter(ctx context.Context, dialect SQLDialect, sqlID, prefix, action string, user *models.SignedInUser) (string, []interface{}, error) {
	if _, ok := sqlIDAcceptList[sqlID]; !ok {
		return "", nil, errors.New("sqlID is not in the accept list")
	}

	if user.Permissions == nil || user.Permissions[user.OrgId] == nil {
		return "", nil, errors.New("missing permissions")
	}

	scopes := user.Permissions[user.OrgId][action]
	if len(scopes) == 0 {
		return " 1 = 0", nil, nil
	}

	var sql string
	var args []interface{}

	switch {
	case strings.Contains(dialect.DriverName(), migrator.SQLite):
		sql, args = sqliteQuery(scopes, sqlID, prefix)
	case strings.Contains(dialect.DriverName(), migrator.MySQL):
		sql, args = mysqlQuery(scopes, sqlID, prefix)
	case strings.Contains(dialect.DriverName(), migrator.Postgres):
		sql, args = postgresQuery(scopes, sqlID, prefix)
	default:
		return "", nil, fmt.Errorf("unknown database: %s", dialect.DriverName())
	}

	return sql, args, nil
}

func sqliteQuery(scopes []string, sqlID, prefix string) (string, []interface{}) {
	args := []interface{}{prefix}
	for _, s := range scopes {
		args = append(args, s)
	}
	args = append(args, prefix, prefix, prefix)

	return fmt.Sprintf(`
		? || ':id:' || %s IN (
			WITH t(scope) AS (
				VALUES (?)`+strings.Repeat(`, (?)`, len(scopes)-1)+`
			)
			SELECT IIF(t.scope = '*' OR t.scope = ? || ':*' OR t.scope = ? || ':id:*', ? || ':id:' || %s, t.scope) FROM t
		)
	`, sqlID, sqlID), args
}

func mysqlQuery(scopes []string, sqlID, prefix string) (string, []interface{}) {
	args := []interface{}{prefix, prefix, prefix, prefix}
	for _, s := range scopes {
		args = append(args, s)
	}

	return fmt.Sprintf(`
		CONCAT(?, ':id:', %s) IN (
			SELECT IF(t.scope = '*' OR t.scope = CONCAT(?, ':*') OR t.scope = CONCAT(?, ':id:*'), CONCAT(?, ':id:', %s), t.scope) FROM
			(SELECT ? AS scope`+strings.Repeat(" UNION ALL SELECT ?", len(scopes)-1)+`) AS t
		)
	`, sqlID, sqlID), args
}

func postgresQuery(scopes []string, sqlID, prefix string) (string, []interface{}) {
	args := []interface{}{prefix, prefix, prefix, prefix}
	for _, s := range scopes {
		args = append(args, s)
	}

	return fmt.Sprintf(`
		CONCAT(?, ':id:', %s) IN (
			SELECT
				CASE WHEN p.scope = '*' OR p.scope = CONCAT(?, ':*') OR p.scope = CONCAT(?, ':id:*') THEN CONCAT(?, ':id:', %s)
				ELSE p.scope
	    		END
			FROM (VALUES (?)`+strings.Repeat(", (?)", len(scopes)-1)+`) as p(scope)
		)
	`, sqlID, sqlID), args
}
