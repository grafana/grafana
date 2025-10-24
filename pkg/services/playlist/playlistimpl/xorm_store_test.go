package playlistimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationXormPlaylistDataAccess(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testIntegrationPlaylistDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
