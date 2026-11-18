package util

import (
	"encoding/json"
	"fmt"
	"regexp"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
)

// The checks in this file mirror the ones the legacy rule store makes when it writes a rule, so that
// unified storage, which has no such store, rejects the same rules.

// StoreRejection returns the error for a rule the legacy store would refuse to write. It is a
// BadRequest, as the legacy store's rejections are, rather than admission's default Forbidden.
func StoreRejection(format string, args ...any) error {
	return apierrors.NewBadRequest(fmt.Sprintf(format, args...))
}

// Same characters as the legacy rule UID.
var validRuleName = regexp.MustCompile(`^[a-zA-Z0-9\-_]+$`).MatchString

// ValidateRuleName checks that the name can be used as a legacy rule UID. An empty name is accepted:
// legacy storage then generates the UID.
func ValidateRuleName(name string) error {
	if name == "" {
		return nil
	}
	if len(name) > model.AlertRuleMaxNameLength {
		return StoreRejection("cannot create rule with UID %q: UID is longer than %d symbols", name, model.AlertRuleMaxNameLength)
	}
	if !validRuleName(name) {
		return StoreRejection("cannot create rule with UID %q: UID may only contain letters, digits, '-' and '_'", name)
	}
	return nil
}

// ValidateTitle checks that the title is set and fits the legacy column. kind names the rule kind in the error.
func ValidateTitle(kind, title string) error {
	if title == "" {
		return StoreRejection("%s title must not be empty", kind)
	}
	if len(title) > model.AlertRuleMaxTitleLength {
		return StoreRejection("%s title is too long. Max length is %d", kind, model.AlertRuleMaxTitleLength)
	}
	return nil
}

// ValidateExpressionModel checks that the model is a JSON object the legacy store can load.
func ValidateExpressionModel(refID string, m any) error {
	props, ok := m.(map[string]any)
	if !ok {
		raw, err := json.Marshal(m)
		if err == nil {
			err = json.Unmarshal(raw, &props)
		}
		if err != nil || props == nil {
			return StoreRejection("expression %s: model must be a JSON object", refID)
		}
	}
	if queryType, ok := props["queryType"]; ok {
		if _, ok := queryType.(string); !ok {
			return StoreRejection("expression %s: model queryType must be a string", refID)
		}
	}
	return nil
}
