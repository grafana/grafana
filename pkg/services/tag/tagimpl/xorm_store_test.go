package tagimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationXormSavingTags(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testIntegrationSavingTags(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
