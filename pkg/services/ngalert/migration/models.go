package migration

import (
	pb "github.com/prometheus/alertmanager/silence/silencepb"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

// OrgMigration is a helper struct for migrating alerts for a single org. It contains state, services, and caches.
type OrgMigration struct {
	cfg *setting.Cfg
	log log.Logger

	migrationStore    migrationStore.Store
	encryptionService secrets.Service

	orgID                      int64
	silences                   []*pb.MeshSilence
	titleDeduplicatorForFolder func(folderUID string) *migmodels.Deduplicator

	// Migrated folder for a dashboard based on permissions. Parent Folder ID -> unique dashboard permission -> custom folder.
	permissionsMap        map[int64]map[permissionHash]*folder.Folder
	folderCache           map[int64]*folder.Folder                      // Folder ID -> Folder.
	folderPermissionCache map[string][]accesscontrol.ResourcePermission // Folder UID -> Folder Permissions.
	generalAlertingFolder *folder.Folder

	state *migmodels.OrgMigrationState
}

// newOrgMigration creates a new OrgMigration for the given orgID.
func (ms *migrationService) newOrgMigration(orgID int64) *OrgMigration {
	titlededuplicatorPerFolder := make(map[string]*migmodels.Deduplicator)
	return &OrgMigration{
		cfg: ms.cfg,
		log: ms.log.New("orgID", orgID),

		migrationStore:    ms.migrationStore,
		encryptionService: ms.encryptionService,

		orgID:    orgID,
		silences: make([]*pb.MeshSilence, 0),
		titleDeduplicatorForFolder: func(folderUID string) *migmodels.Deduplicator {
			if _, ok := titlededuplicatorPerFolder[folderUID]; !ok {
				titlededuplicatorPerFolder[folderUID] = migmodels.NewDeduplicator(ms.store.GetDialect().SupportEngine(), store.AlertDefinitionMaxTitleLength)
			}
			return titlededuplicatorPerFolder[folderUID]
		},

		permissionsMap:        make(map[int64]map[permissionHash]*folder.Folder),
		folderCache:           make(map[int64]*folder.Folder),
		folderPermissionCache: make(map[string][]accesscontrol.ResourcePermission),

		state: &migmodels.OrgMigrationState{
			OrgID:          orgID,
			CreatedFolders: make([]string, 0),
		},
	}
}

type AlertPair struct {
	AlertRule *models.AlertRule
	DashAlert *migrationStore.DashAlert
}
