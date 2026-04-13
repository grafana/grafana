package sqlstore

import (
	"errors"
	"fmt"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
)

func TestIsAuthError_PostgresAuthFailed(t *testing.T) {
	err := &pq.Error{Code: "28P01"}
	assert.True(t, IsAuthError(err), "pq 28P01 should be auth error")
}

func TestIsAuthError_PostgresInvalidAuth(t *testing.T) {
	err := &pq.Error{Code: "28000"}
	assert.True(t, IsAuthError(err), "pq 28000 should be auth error")
}

func TestIsAuthError_MySQLAccessDenied(t *testing.T) {
	err := &mysql.MySQLError{Number: 1045}
	assert.True(t, IsAuthError(err), "mysql 1045 should be auth error")
}

func TestIsAuthError_WrappedPostgresString(t *testing.T) {
	inner := fmt.Errorf("password authentication failed for user \"grafana\"")
	wrapped := fmt.Errorf("db connect: %w", inner)
	assert.True(t, IsAuthError(wrapped), "wrapped password authentication failed should be auth error")
}

func TestIsAuthError_WrappedMySQLString(t *testing.T) {
	inner := fmt.Errorf("Access denied for user 'grafana'@'localhost'")
	wrapped := fmt.Errorf("db connect: %w", inner)
	assert.True(t, IsAuthError(wrapped), "wrapped Access denied should be auth error")
}

func TestIsAuthError_NotAnAuthError(t *testing.T) {
	err := errors.New("connection refused")
	assert.False(t, IsAuthError(err), "connection refused should not be auth error")
}

func TestIsAuthError_NilError(t *testing.T) {
	assert.False(t, IsAuthError(nil), "nil should not be auth error")
}

func TestIsAuthError_MySQLOtherError(t *testing.T) {
	err := &mysql.MySQLError{Number: 1054} // unknown column
	assert.False(t, IsAuthError(err), "mysql 1054 should not be auth error")
}
