package legacy_storage

import (
	"maps"
	"slices"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func WithManagedInhibitionRules(inhibitionRules []definitions.InhibitRule, managedInhibitionRules map[string]*definitions.InhibitionRule) []definitions.InhibitRule {
	if len(managedInhibitionRules) == 0 {
		// If there are no managed routes, we just return the original root.
		return inhibitionRules
	}

	res := make([]definitions.InhibitRule, 0, len(inhibitionRules)+len(managedInhibitionRules))
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
