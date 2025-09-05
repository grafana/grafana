package starimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tests"
)

func TestIntegrationXormUserStarsDataAccess(t *testing.T) {
	tests.SkipIntegrationTestInShortMode(t)

	testIntegrationUserStarsDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
