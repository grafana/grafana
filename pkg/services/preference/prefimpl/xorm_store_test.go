package prefimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tests"
)

func TestIntegrationXORMPreferencesDataAccess(t *testing.T) {
	tests.SkipIntegrationTestInShortMode(t)

	testIntegrationPreferencesDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
