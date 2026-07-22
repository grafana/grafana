package cleaner

import (
	"github.com/grafana/grafana/pkg/services/librarypanels"
	ngalertstore "github.com/grafana/grafana/pkg/services/ngalert/store"
)

// ProvideFolderContentsDeleter assembles the cascade cleaner from the alerting store and
// library-panels service. Both register here rather than in each service's constructor, so the
// folder package never imports alerting or library panels — the dependency arrow stays one-way.
func ProvideFolderContentsDeleter(alertRules *ngalertstore.DBstore, libPanels *librarypanels.LibraryPanelService) *ContentsCleaner {
	return NewContentsCleaner(alertRules, libPanels)
}
