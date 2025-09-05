package playlistimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tests"
)

func TestIntegrationXormPlaylistDataAccess(t *testing.T) {
	tests.SkipIntegrationTestInShortMode(t)

	testIntegrationPlaylistDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
