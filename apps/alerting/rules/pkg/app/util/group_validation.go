package util

import (
	"fmt"
	"strconv"

	"github.com/grafana/grafana-app-sdk/resource"
	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
)

// ValidateGroupLabels enforces the cross-field rules for group-related labels.
//
// Rules enforced:
// - On create, group-related labels must not be set.
// - If one of group or group-index is set, the other must also be set.
// - group-index must be an integer.
// - On update, group/group-index can only be present if they were present on the old object.
//
// Pass current labels and, when available, the previous object's labels. The previous labels
// may be nil when there is no old object (e.g., create operations).
func ValidateGroupLabels(labels map[string]string, oldLabels map[string]string, action resource.AdmissionAction) error {
	groupStr, groupExists := labels[model.GroupLabelKey]
	groupIndexStr, groupIndexStrExists := labels[model.GroupIndexLabelKey]

	if groupExists || groupIndexStrExists {
		if action == resource.AdmissionActionCreate {
			return fmt.Errorf("cannot set group when creating a new rule")
		}
		if groupExists && !groupIndexStrExists {
			return fmt.Errorf("%s must be set when %s is set", model.GroupIndexLabelKey, model.GroupLabelKey)
		}
		if groupIndexStrExists && !groupExists {
			return fmt.Errorf("%s must be set when %s is set", model.GroupLabelKey, model.GroupIndexLabelKey)
		}
		// Disallow empty values when labels are present
		if groupExists && groupStr == "" {
			return fmt.Errorf("%s cannot be empty", model.GroupLabelKey)
		}
		if groupIndexStrExists && groupIndexStr == "" {
			return fmt.Errorf("%s cannot be empty", model.GroupIndexLabelKey)
		}
		if _, err := strconv.Atoi(groupIndexStr); err != nil {
			return fmt.Errorf("invalid %s: %w", model.GroupIndexLabelKey, err)
		}

		// On updates, ensure that group and group-index are only set if the old object had them set
		if oldLabels != nil {
			_, oldGroupExists := oldLabels[model.GroupLabelKey]
			_, oldGroupIndexExists := oldLabels[model.GroupIndexLabelKey]
			if groupExists && !oldGroupExists {
				return fmt.Errorf("cannot set group when updating un-grouped rule")
			}
			if groupIndexStrExists && !oldGroupIndexExists {
				return fmt.Errorf("cannot set group-index when updating un-grouped rule")
			}
		}
	}
	return nil
}
