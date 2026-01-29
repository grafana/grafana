package resource

import (
	"fmt"
	"strings"
)

// queryBuilder helps build SQL queries with a dialect
type queryBuilder struct {
	dialect   Dialect
	tableName string
}

// buildGetQuery generates SELECT query for single key
func (qb *queryBuilder) buildGetQuery(keyPath string) (string, []interface{}) {
	query := fmt.Sprintf(
		"SELECT %s FROM %s WHERE %s = %s",
		qb.dialect.QuoteIdent("value"),
		qb.dialect.QuoteIdent(qb.tableName),
		qb.dialect.QuoteIdent("key_path"),
		qb.dialect.Placeholder(1),
	)
	return query, []interface{}{keyPath}
}

// buildKeysQuery generates SELECT query for listing keys
func (qb *queryBuilder) buildKeysQuery(startKey, endKey string, sortAsc bool, limit int64) (string, []interface{}) {
	order := "ASC"
	if !sortAsc {
		order = "DESC"
	}

	query := fmt.Sprintf(
		"SELECT %s FROM %s WHERE %s >= %s AND %s < %s ORDER BY %s %s",
		qb.dialect.QuoteIdent("key_path"),
		qb.dialect.QuoteIdent(qb.tableName),
		qb.dialect.QuoteIdent("key_path"), qb.dialect.Placeholder(1),
		qb.dialect.QuoteIdent("key_path"), qb.dialect.Placeholder(2),
		qb.dialect.QuoteIdent("key_path"), order,
	)

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	return query, []interface{}{startKey, endKey}
}

// buildUpsertQuery generates INSERT with ON CONFLICT/ON DUPLICATE KEY
func (qb *queryBuilder) buildUpsertQuery(keyPath string, value []byte) (string, []interface{}) {
	var query string

	switch qb.dialect.Name() {
	case "mysql":
		query = fmt.Sprintf(
			"INSERT INTO %s (%s, %s) VALUES (%s, %s) ON DUPLICATE KEY UPDATE %s = %s",
			qb.dialect.QuoteIdent(qb.tableName),
			qb.dialect.QuoteIdent("key_path"), qb.dialect.QuoteIdent("value"),
			qb.dialect.Placeholder(1), qb.dialect.Placeholder(2),
			qb.dialect.QuoteIdent("value"), qb.dialect.Placeholder(3),
		)
		return query, []interface{}{keyPath, value, value}
	default: // postgres, sqlite
		query = fmt.Sprintf(
			"INSERT INTO %s (%s, %s) VALUES (%s, %s) ON CONFLICT (%s) DO UPDATE SET %s = %s",
			qb.dialect.QuoteIdent(qb.tableName),
			qb.dialect.QuoteIdent("key_path"), qb.dialect.QuoteIdent("value"),
			qb.dialect.Placeholder(1), qb.dialect.Placeholder(2),
			qb.dialect.QuoteIdent("key_path"),
			qb.dialect.QuoteIdent("value"), qb.dialect.Placeholder(3),
		)
		return query, []interface{}{keyPath, value, value}
	}
}

// buildDeleteQuery generates DELETE query
func (qb *queryBuilder) buildDeleteQuery(keyPath string) (string, []interface{}) {
	query := fmt.Sprintf(
		"DELETE FROM %s WHERE %s = %s",
		qb.dialect.QuoteIdent(qb.tableName),
		qb.dialect.QuoteIdent("key_path"),
		qb.dialect.Placeholder(1),
	)
	return query, []interface{}{keyPath}
}

// buildBatchGetQuery generates SELECT with IN clause
// This uses a UNION ALL approach to preserve ordering by input index
func (qb *queryBuilder) buildBatchGetQuery(keyPaths []string) (string, []interface{}) {
	if len(keyPaths) == 0 {
		return "", nil
	}

	// Build UNION ALL subquery for requested keys with their original order
	var unionParts []string
	args := make([]interface{}, 0, len(keyPaths)*2)
	argIdx := 1

	for i, kp := range keyPaths {
		if i == 0 {
			unionParts = append(unionParts, fmt.Sprintf(
				"SELECT %s AS idx, %s AS key_path",
				qb.dialect.Placeholder(argIdx),
				qb.dialect.Placeholder(argIdx+1),
			))
		} else {
			unionParts = append(unionParts, fmt.Sprintf(
				"UNION ALL SELECT %s, %s",
				qb.dialect.Placeholder(argIdx),
				qb.dialect.Placeholder(argIdx+1),
			))
		}
		args = append(args, i, kp)
		argIdx += 2
	}

	query := fmt.Sprintf(
		"SELECT r.%s, r.%s FROM (%s) AS requested_keys INNER JOIN %s r ON r.%s = requested_keys.%s ORDER BY requested_keys.%s",
		qb.dialect.QuoteIdent("key_path"),
		qb.dialect.QuoteIdent("value"),
		strings.Join(unionParts, " "),
		qb.dialect.QuoteIdent(qb.tableName),
		qb.dialect.QuoteIdent("key_path"),
		qb.dialect.QuoteIdent("key_path"),
		qb.dialect.QuoteIdent("idx"),
	)

	return query, args
}

// buildBatchDeleteQuery generates DELETE with IN clause
func (qb *queryBuilder) buildBatchDeleteQuery(keyPaths []string) (string, []interface{}) {
	if len(keyPaths) == 0 {
		return "", nil
	}

	placeholders := make([]string, len(keyPaths))
	args := make([]interface{}, len(keyPaths))

	for i, kp := range keyPaths {
		placeholders[i] = qb.dialect.Placeholder(i + 1)
		args[i] = kp
	}

	query := fmt.Sprintf(
		"DELETE FROM %s WHERE %s IN (%s)",
		qb.dialect.QuoteIdent(qb.tableName),
		qb.dialect.QuoteIdent("key_path"),
		strings.Join(placeholders, ", "),
	)

	return query, args
}

// buildInsertDatastoreQuery generates INSERT for datastore section for use in non-backwards compatible mode (without rvmanager)
// Includes all required fields with empty string defaults for group, resource, namespace, name, folder, and 0 for action
func (qb *queryBuilder) buildInsertDatastoreQuery(keyPath string, value []byte, guid string) (string, []interface{}) {
	query := fmt.Sprintf(
		"INSERT INTO %s (%s, %s, %s, %s, %s, %s, %s, %s, %s) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
		qb.dialect.QuoteIdent(qb.tableName),
		qb.dialect.QuoteIdent("guid"),
		qb.dialect.QuoteIdent("key_path"),
		qb.dialect.QuoteIdent("value"),
		qb.dialect.QuoteIdent("group"),
		qb.dialect.QuoteIdent("resource"),
		qb.dialect.QuoteIdent("namespace"),
		qb.dialect.QuoteIdent("name"),
		qb.dialect.QuoteIdent("action"),
		qb.dialect.QuoteIdent("folder"),
		qb.dialect.Placeholder(1), // guid
		qb.dialect.Placeholder(2), // key_path
		qb.dialect.Placeholder(3), // value
		qb.dialect.Placeholder(4), // group (empty)
		qb.dialect.Placeholder(5), // resource (empty)
		qb.dialect.Placeholder(6), // namespace (empty)
		qb.dialect.Placeholder(7), // name (empty)
		qb.dialect.Placeholder(8), // action (0)
		qb.dialect.Placeholder(9), // folder (empty)
	)
	return query, []interface{}{guid, keyPath, value, "", "", "", "", 0, ""}
}

// buildInsertDatastoreBackwardCompatQuery generates INSERT for backward-compatible mode
// Inserts guid, value, and placeholder values for NOT NULL columns - these will be updated by applyBackwardsCompatibleChanges()
func (qb *queryBuilder) buildInsertDatastoreBackwardCompatQuery(value []byte, guid, group, resource, namespace, name, folder string, action int64) (string, []interface{}) {
	query := fmt.Sprintf(
		"INSERT INTO %s (%s, %s, %s, %s, %s, %s, %s, %s) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
		qb.dialect.QuoteIdent(qb.tableName),
		qb.dialect.QuoteIdent("guid"),
		qb.dialect.QuoteIdent("value"),
		qb.dialect.QuoteIdent("group"),
		qb.dialect.QuoteIdent("resource"),
		qb.dialect.QuoteIdent("namespace"),
		qb.dialect.QuoteIdent("name"),
		qb.dialect.QuoteIdent("action"),
		qb.dialect.QuoteIdent("folder"),
		qb.dialect.Placeholder(1), // guid
		qb.dialect.Placeholder(2), // value
		qb.dialect.Placeholder(3), // group
		qb.dialect.Placeholder(4), // resource
		qb.dialect.Placeholder(5), // namespace
		qb.dialect.Placeholder(6), // name
		qb.dialect.Placeholder(7), // action
		qb.dialect.Placeholder(8), // folder
	)
	return query, []interface{}{guid, value, group, resource, namespace, name, action, folder}
}

// buildUpdateDatastoreQuery generates UPDATE for datastore section
func (qb *queryBuilder) buildUpdateDatastoreQuery(keyPath string, value []byte) (string, []interface{}) {
	query := fmt.Sprintf(
		"UPDATE %s SET %s = %s WHERE %s = %s",
		qb.dialect.QuoteIdent(qb.tableName),
		qb.dialect.QuoteIdent("value"),
		qb.dialect.Placeholder(1),
		qb.dialect.QuoteIdent("key_path"),
		qb.dialect.Placeholder(2),
	)
	return query, []interface{}{value, keyPath}
}
