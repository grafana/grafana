package playlistimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationXormPlaylistDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testIntegrationPlaylistDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
