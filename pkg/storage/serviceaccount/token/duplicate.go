package token

import (
	"errors"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"

	"github.com/grafana/grafana/pkg/util/sqlite"
)

// isRowAlreadyExistsError reports a unique constraint violation.
//
// Duplicated from unified storage rather than imported: that package pulls in the
// apiserver stack, which would make this package unimportable from authentication.
func isRowAlreadyExistsError(err error) bool {
	if sqlite.IsUniqueConstraintViolation(err) {
		return true
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505" // unique_violation
	}

	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code == "23505" // unique_violation
	}

	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		return mysqlErr.Number == 1062 // ER_DUP_ENTRY
	}

	return false
}
