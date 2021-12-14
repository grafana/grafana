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
func Filter(ctx context.Context, dialect SQLDialect, prefix, sqlID string, action string, user *models.SignedInUser) (string, []interface{}) {
	var scopes []string

	if user.Permissions != nil {
		for _, scope := range user.Permissions[user.OrgId][action] {
			scopes = append(scopes, scope)
		}
	}

	// if not scopes push empty scope so no values will be returned
	if len(scopes) == 0 {
		scopes = append(scopes, "")
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
	var args []interface{}
	for _, s := range scopes {
		args = append(args, s)
	}

	return fmt.Sprintf(`
		'%s:id:' || %s IN (
			WITH t(scope) AS (
				VALUES (?)`+strings.Repeat(`, (?)`, len(scopes)-1)+`
			)
			SELECT IIF(t.scope = '*' OR t.scope = '%s:*' OR t.scope = '%s:id:*', '%s:id:' || %s, t.scope) FROM t
		)
	`, prefix, sqlID, prefix, prefix, prefix, sqlID), args
}

func mysqlQuery(scopes []string, prefix, sqlID string) (string, []interface{}) {
	var args []interface{}
	for _, s := range scopes {
		args = append(args, s)
	}

	return fmt.Sprintf(`
		CONCAT('%s:id:', %s) IN (
			SELECT IF(t.scope = '*' OR t.scope = '%s:*' OR t.scope = '%s:id:*', CONCAT('%s:id:', %s), t.scope) FROM
			(SELECT ? AS scope`+strings.Repeat(" UNION ALL SELECT ?", len(scopes)-1)+`) AS t
		)
	`, prefix, sqlID, prefix, prefix, prefix, sqlID), args
}

func postgresQuery(scopes []string, prefix, sqlID string) (string, []interface{}) {
	var args []interface{}
	for _, s := range scopes {
		args = append(args, s)
	}

	return fmt.Sprintf(`
		CONCAT('%s:id:', %s) IN (
			SELECT
				CASE WHEN p.scope = '*' OR p.scope = '%s:*' OR p.scope = '%s:id:*' THEN CONCAT('%s:id:', %s)
				ELSE p.scope
	    		END
			FROM (VALUES (?)`+strings.Repeat(", (?)", len(scopes)-1)+`) as p(scope)
		)
	`, prefix, sqlID, prefix, prefix, prefix, sqlID), args
}
