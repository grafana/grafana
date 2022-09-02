package playlistimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationXormPlaylistDataAccess(t *testing.T) {
	testIntegrationPlaylistDataAccess(t, func(ss *sqlstore.SQLStore) store {
		return &sqlStore{db: ss}
	})
}
