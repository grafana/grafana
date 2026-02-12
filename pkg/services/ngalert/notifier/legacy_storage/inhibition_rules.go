package legacy_storage

import (
	"maps"
	"slices"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/alertmanager/config"
)

func WithManagedInhibitionRules(inhibitionRules []config.InhibitRule, managedInhibitionRules map[string]*models.InhibitionRule) []config.InhibitRule {
	if len(managedInhibitionRules) == 0 {
		// If there are no managed routes, we just return the original root.
		return inhibitionRules
	}

	res := make([]config.InhibitRule, 0, len(inhibitionRules)+len(managedInhibitionRules))
	for _, k := range slices.Sorted(maps.Keys(managedInhibitionRules)) {
		mir := managedInhibitionRules[k]
		if mir == nil {
			continue
		}
		res = append(res, mir.InhibitRule)
	}
	res = append(res, inhibitionRules...)

	return res
}
