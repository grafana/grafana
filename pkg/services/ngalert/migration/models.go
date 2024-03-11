package migration

import (
	"github.com/grafana/grafana/pkg/infra/log"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

// OrgMigration is a helper struct for migrating alerts for a single org. It contains state, services, and caches.
type OrgMigration struct {
	cfg *setting.Cfg
	log log.Logger

	migrationStore    migrationStore.Store
	encryptionService secrets.Service

	orgID int64
}

// newOrgMigration creates a new OrgMigration for the given orgID.
func (ms *migrationService) newOrgMigration(orgID int64) *OrgMigration {
	return &OrgMigration{
		cfg: ms.cfg,
		log: ms.log.New("orgID", orgID),

		migrationStore:    ms.migrationStore,
		encryptionService: ms.encryptionService,

		orgID: orgID,
	}
}
