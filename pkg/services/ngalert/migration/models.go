package migration

import (
	"strings"

	pb "github.com/prometheus/alertmanager/silence/silencepb"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/folder"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// OrgMigration is a helper struct for migrating alerts for a single org. It contains state, services, and caches.
type OrgMigration struct {
	cfg *setting.Cfg
	log log.Logger

	migrationStore    migrationStore.Store
	encryptionService secrets.Service

	orgID               int64
	seenUIDs            Deduplicator
	silences            []*pb.MeshSilence
	alertRuleTitleDedup map[string]Deduplicator // Folder -> Deduplicator (Title).

	// cache for folders created for dashboards that have custom permissions
	folderCache           map[string]*folder.Folder
	generalAlertingFolder *folder.Folder

	state *migmodels.OrgMigrationState
}

// newOrgMigration creates a new OrgMigration for the given orgID.
func (ms *MigrationService) newOrgMigration(orgID int64) *OrgMigration {
	return &OrgMigration{
		cfg: ms.cfg,
		log: ms.log.New("orgID", orgID),

		migrationStore:    ms.migrationStore,
		encryptionService: ms.encryptionService,

		orgID: orgID,
		// We deduplicate for case-insensitive matching in MySQL-compatible backend flavours because they use case-insensitive collation.
		seenUIDs:            Deduplicator{set: make(map[string]struct{}), caseInsensitive: ms.migrationStore.CaseInsensitive()},
		silences:            make([]*pb.MeshSilence, 0),
		alertRuleTitleDedup: make(map[string]Deduplicator),

		folderCache: make(map[string]*folder.Folder),

		state: &migmodels.OrgMigrationState{
			OrgID:          orgID,
			CreatedFolders: make([]string, 0),
		},
	}
}

func (om *OrgMigration) AlertTitleDeduplicator(folderUID string) Deduplicator {
	if _, ok := om.alertRuleTitleDedup[folderUID]; !ok {
		om.alertRuleTitleDedup[folderUID] = Deduplicator{
			set:             make(map[string]struct{}),
			caseInsensitive: om.migrationStore.CaseInsensitive(),
			maxLen:          store.AlertDefinitionMaxTitleLength,
		}
	}
	return om.alertRuleTitleDedup[folderUID]
}

type AlertPair struct {
	AlertRule *models.AlertRule
	DashAlert *migrationStore.DashAlert
}

// Deduplicator is a wrapper around map[string]struct{} and util.GenerateShortUID() which aims help maintain and generate
// unique strings (such as uids or titles). if caseInsensitive is true, all uniqueness is determined in a
// case-insensitive manner. if maxLen is greater than 0, all strings will be truncated to maxLen before being checked in
// contains and dedup will always return a string of length maxLen or less.
type Deduplicator struct {
	set             map[string]struct{}
	caseInsensitive bool
	maxLen          int
}

// contains checks whether the given string has already been seen by this Deduplicator.
func (s *Deduplicator) contains(u string) bool {
	dedup := u
	if s.caseInsensitive {
		dedup = strings.ToLower(dedup)
	}
	if s.maxLen > 0 && len(dedup) > s.maxLen {
		dedup = dedup[:s.maxLen]
	}
	_, seen := s.set[dedup]
	return seen
}

// deduplicate returns a unique string based on the given string by appending a uuid to it. Will truncate the given string if
// the resulting string would be longer than maxLen.
func (s *Deduplicator) deduplicate(dedup string) string {
	uid := util.GenerateShortUID()
	if s.maxLen > 0 && len(dedup)+1+len(uid) > s.maxLen {
		trunc := s.maxLen - 1 - len(uid)
		dedup = dedup[:trunc]
	}

	return dedup + "_" + uid
}

// add adds the given string to the Deduplicator.
func (s *Deduplicator) add(uid string) {
	dedup := uid
	if s.caseInsensitive {
		dedup = strings.ToLower(dedup)
	}
	s.set[dedup] = struct{}{}
}
