package util

import (
	"fmt"
	"strconv"

	"github.com/grafana/grafana-app-sdk/resource"
	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
)

// ValidateGroupLabels enforces the cross-field rules for group-related labels.
//
// Rules enforced:
// - If one of group or group-index is set, the other must also be set.
// - group-index must be an integer.
// - Neither group nor group-index may be empty when present.
//
// Group assignment is allowed on both create and update operations, including
// assigning a previously un-grouped rule to an evaluation group.
//
// Pass current labels and, when available, the previous object's labels. The previous labels
// may be nil when there is no old object (e.g., create operations).
func ValidateGroupLabels(labels map[string]string, oldLabels map[string]string, action resource.AdmissionAction) error {
	groupStr, groupExists := labels[model.GroupLabelKey]
	groupIndexStr, groupIndexStrExists := labels[model.GroupIndexLabelKey]

	if groupExists || groupIndexStrExists {
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
	}
	return nil
}
