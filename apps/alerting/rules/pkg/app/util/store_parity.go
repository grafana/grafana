package util

import (
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
)

// The checks in this file mirror the ones the legacy rule store makes when it writes a rule, so that
// unified storage, which has no such store, rejects the same rules. Checks that OpenAPI validation already
// makes, and limits unified storage is meant to relax, are not repeated here.

// StoreRejection returns the error for a rule the legacy store would refuse to write. It is a
// BadRequest, as the legacy store's rejections are, rather than admission's default Forbidden.
func StoreRejection(format string, args ...any) error {
	return apierrors.NewBadRequest(fmt.Sprintf(format, args...))
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
