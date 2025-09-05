package tagimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tests"
)

func TestIntegrationXormSavingTags(t *testing.T) {
	tests.SkipIntegrationTestInShortMode(t)

	testIntegrationSavingTags(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
