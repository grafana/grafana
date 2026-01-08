package starimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationXormUserStarsDataAccess(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testIntegrationUserStarsDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
