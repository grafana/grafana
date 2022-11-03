package playlistimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationXormPlaylistDataAccess(t *testing.T) {
	testIntegrationPlaylistDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}
