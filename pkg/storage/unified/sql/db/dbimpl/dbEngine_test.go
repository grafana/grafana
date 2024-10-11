package dbimpl

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func newValidMySQLGetter(withKeyPrefix bool) confGetter {
	var prefix string
	if withKeyPrefix {
		prefix = "db_"
	}
	return newTestConfGetter(map[string]string{
		prefix + "type":     dbTypeMySQL,
		prefix + "host":     "/var/run/mysql.socket",
		prefix + "name":     "grafana",
		prefix + "user":     "user",
		prefix + "password": "password",
	}, prefix)
}

func TestGetEngineMySQLFromConfig(t *testing.T) {
	t.Parallel()

	t.Run("happy path - with key prefix", func(t *testing.T) {
		t.Parallel()
		engine, err := getEngineMySQL(newValidMySQLGetter(true))
		assert.NotNil(t, engine)
		assert.NoError(t, err)
	})

	t.Run("happy path - without key prefix", func(t *testing.T) {
		t.Parallel()
		engine, err := getEngineMySQL(newValidMySQLGetter(false))
		assert.NotNil(t, engine)
		assert.NoError(t, err)
	})

	t.Run("invalid string", func(t *testing.T) {
		t.Parallel()

		getter := newTestConfGetter(map[string]string{
			"db_type":     dbTypeMySQL,
			"db_host":     "/var/run/mysql.socket",
			"db_name":     string(invalidUTF8ByteSequence),
			"db_user":     "user",
			"db_password": "password",
		}, "db_")
		engine, err := getEngineMySQL(getter)
		assert.Nil(t, engine)
		assert.Error(t, err)
		assert.ErrorIs(t, err, errInvalidUTF8Sequence)
	})
}

func newValidPostgresGetter(withKeyPrefix bool) confGetter {
	var prefix string
	if withKeyPrefix {
		prefix = "db_"
	}
	return newTestConfGetter(map[string]string{
		prefix + "type":     dbTypePostgres,
		prefix + "host":     "localhost",
		prefix + "name":     "grafana",
		prefix + "user":     "user",
		prefix + "password": "password",
	}, prefix)
}

func TestGetEnginePostgresFromConfig(t *testing.T) {
	t.Parallel()

	t.Run("happy path - with key prefix", func(t *testing.T) {
		t.Parallel()
		engine, err := getEnginePostgres(newValidPostgresGetter(true))
		assert.NotNil(t, engine)
		assert.NoError(t, err)
	})

	t.Run("happy path - without key prefix", func(t *testing.T) {
		t.Parallel()
		engine, err := getEnginePostgres(newValidPostgresGetter(false))
		assert.NotNil(t, engine)
		assert.NoError(t, err)
	})

	t.Run("invalid string", func(t *testing.T) {
		t.Parallel()
		getter := newTestConfGetter(map[string]string{
			"db_type":     dbTypePostgres,
			"db_host":     string(invalidUTF8ByteSequence),
			"db_name":     "grafana",
			"db_user":     "user",
			"db_password": "password",
		}, "db_")
		engine, err := getEnginePostgres(getter)

		assert.Nil(t, engine)
		assert.Error(t, err)
		assert.ErrorIs(t, err, errInvalidUTF8Sequence)
	})

	t.Run("invalid hostport", func(t *testing.T) {
		t.Parallel()
		getter := newTestConfGetter(map[string]string{
			"db_type":     dbTypePostgres,
			"db_host":     "1:1:1",
			"db_name":     "grafana",
			"db_user":     "user",
			"db_password": "password",
		}, "db_")
		engine, err := getEnginePostgres(getter)

		assert.Nil(t, engine)
		assert.Error(t, err)
	})
}
