package playlistimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationSQLxPlaylistDataAccess(t *testing.T) {
	testIntegrationPlaylistDataAccess(t, func(ss *sqlstore.SQLStore) store {
		return &sqlxStore{db: ss}
	})
}
