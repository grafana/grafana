package cleaner

import (
	"github.com/grafana/grafana/pkg/services/librarypanels"
	alertingrules "github.com/grafana/grafana/pkg/services/ngalert/rules"
)

// ProvideFolderContentsDeleter assembles the cascade cleaner from the alerting store and
// library-panels service. Both register here rather than in each service's constructor, so the
// folder package never imports alerting or library panels — the dependency arrow stays one-way.
// This is the in-proc monolith's checked wiring; a future standalone-apiserver wiring should use
// an Unchecked-variant constructor instead, to trust that apiserver's own authorization check.
func ProvideFolderContentsDeleter(alertRules alertingrules.RuleService, libPanels *librarypanels.LibraryPanelService) *ContentsCleaner {
	return NewContentsCleaner(alertRules, libPanels)
}
