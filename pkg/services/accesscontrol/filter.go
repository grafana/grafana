package accesscontrol

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type SQLDialect interface {
	DriverName() string
}

// Filter creates a where clause to restrict the view of a query based on a users permissions
// Scopes for a certain action will be compared against prefix:id:sqlID where prefix is the scope prefix and sqlID
// is the id to generate scope from e.g. user.id
func Filter(ctx context.Context, dialect SQLDialect, prefix, sqlID string, action string, user *models.SignedInUser) (string, []interface{}) {
	var scopes []string

	if user.Permissions != nil {
		scopes = append(scopes, user.Permissions[user.OrgId][action]...)
	}

	// if user has no scopes push invalid scope so no values will be returned
	if len(scopes) == 0 {
		scopes = append(scopes, "no:access")
	}

	if strings.Contains(dialect.DriverName(), migrator.SQLite) {
		return sqliteQuery(scopes, prefix, sqlID)
	} else if strings.Contains(dialect.DriverName(), migrator.MySQL) {
		return mysqlQuery(scopes, prefix, sqlID)
	} else {
		return postgresQuery(scopes, prefix, sqlID)
	}
}

func sqliteQuery(scopes []string, prefix, sqlID string) (string, []interface{}) {
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

func mysqlQuery(scopes []string, prefix, sqlID string) (string, []interface{}) {
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

func postgresQuery(scopes []string, prefix, sqlID string) (string, []interface{}) {
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
