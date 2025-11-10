package tounifiedstorage

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const PlaylistsMigrationID = "unified_storage_playlists_migration"

type playlistsMigrator struct {
	baseMigrator
	deps *Dependencies
}

func (sp *playlistsMigrator) Exec(_ *xorm.Session, _ *migrator.Migrator) error {
	// TODO: Implement playlist migration when ready
	// For now, this is a placeholder that does nothing
	return nil
}
