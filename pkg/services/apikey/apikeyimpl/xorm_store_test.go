package apikeyimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tests"
)

func TestIntegrationXORMApiKeyDataAccess(t *testing.T) {
	tests.SkipIntegrationTestInShortMode(t)

	testIntegrationApiKeyDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
