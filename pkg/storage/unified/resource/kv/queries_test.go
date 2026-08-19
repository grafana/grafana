package kv

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildBatchGetQueryCastsPostgresOrderIndex(t *testing.T) {
	qb := queryBuilder{dialect: postgresDialect{}, tableName: "resource"}

	query, args := qb.buildBatchGetQuery([]string{"section/first", "section/second"})

	require.Equal(t,
		`SELECT r."key_path", r."value" FROM (`+
			`SELECT CAST($1 AS BIGINT) AS idx, $2 AS key_path `+
			`UNION ALL SELECT CAST($3 AS BIGINT), $4`+
			`) AS requested_keys INNER JOIN "resource" r `+
			`ON r."key_path" = requested_keys."key_path" `+
			`ORDER BY requested_keys."idx"`,
		query,
	)
	require.Equal(t, []interface{}{0, "section/first", 1, "section/second"}, args)
}
