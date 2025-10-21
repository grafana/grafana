package apikeyimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationXORMApiKeyDataAccess(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testIntegrationApiKeyDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
