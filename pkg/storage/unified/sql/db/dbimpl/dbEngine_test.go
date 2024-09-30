package dbimpl

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func newValidMySQLGetter() *sectionGetter {
	return newTestSectionGetter(map[string]string{
		"db_type":     dbTypeMySQL,
		"db_host":     "/var/run/mysql.socket",
		"db_name":     "grafana",
		"db_user":     "user",
		"db_password": "password",
	})
}

func TestGetEngineMySQLFromConfig(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()
		engine, err := getEngineMySQL(newValidMySQLGetter(), nil)
		assert.NotNil(t, engine)
		assert.NoError(t, err)
	})

	t.Run("invalid string", func(t *testing.T) {
		t.Parallel()

		getter := newTestSectionGetter(map[string]string{
			"db_type":     dbTypeMySQL,
			"db_host":     "/var/run/mysql.socket",
			"db_name":     string(invalidUTF8ByteSequence),
			"db_user":     "user",
			"db_password": "password",
		})
		engine, err := getEngineMySQL(getter, nil)
		assert.Nil(t, engine)
		assert.Error(t, err)
		assert.ErrorIs(t, err, errInvalidUTF8Sequence)
	})
}

func newValidPostgresGetter() *sectionGetter {
	return newTestSectionGetter(map[string]string{
		"db_type":     dbTypePostgres,
		"db_host":     "localhost",
		"db_name":     "grafana",
		"db_user":     "user",
		"db_password": "password",
	})
}

func TestGetEnginePostgresFromConfig(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()
		engine, err := getEnginePostgres(newValidPostgresGetter(), nil)
		assert.NotNil(t, engine)
		assert.NoError(t, err)
	})

	t.Run("invalid string", func(t *testing.T) {
		t.Parallel()
		getter := newTestSectionGetter(map[string]string{
			"db_type":     dbTypePostgres,
			"db_host":     string(invalidUTF8ByteSequence),
			"db_name":     "grafana",
			"db_user":     "user",
			"db_password": "password",
		})
		engine, err := getEnginePostgres(getter, nil)

		assert.Nil(t, engine)
		assert.Error(t, err)
		assert.ErrorIs(t, err, errInvalidUTF8Sequence)
	})

	t.Run("invalid hostport", func(t *testing.T) {
		t.Parallel()
		getter := newTestSectionGetter(map[string]string{
			"db_type":     dbTypePostgres,
			"db_host":     "1:1:1",
			"db_name":     "grafana",
			"db_user":     "user",
			"db_password": "password",
		})
		engine, err := getEnginePostgres(getter, nil)

		assert.Nil(t, engine)
		assert.Error(t, err)
	})
}
