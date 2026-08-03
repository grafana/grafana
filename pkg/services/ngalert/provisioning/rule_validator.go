package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// RuleMutationValidator is consulted before an alert rule is created or updated, and can
// reject the mutation by returning an error. It lets a downstream distribution enforce
// its own policy on rule writes without OSS knowing what that policy is, in the same
// shape as validations.DataSourceRequestValidator: OSS provides a no-op default and the
// real implementation is supplied by dependency injection.
//
// Returning an error fails the write, so an implementation should fail open on its own
// internal errors rather than make rule management unavailable.
type RuleMutationValidator interface {
	ValidateRuleMutation(ctx context.Context, rule *models.AlertRule) error
}

// NoopRuleMutationValidator accepts every mutation. This is the OSS default.
type NoopRuleMutationValidator struct{}

func (NoopRuleMutationValidator) ValidateRuleMutation(context.Context, *models.AlertRule) error {
	return nil
}

// ProvideRuleMutationValidator is the OSS binding for RuleMutationValidator.
func ProvideRuleMutationValidator() RuleMutationValidator {
	return NoopRuleMutationValidator{}
}

// validateRuleMutation runs the configured validator. It tolerates a nil validator so
// that an AlertRuleService built as a struct literal, as a few tests do, does not panic.
func (service *AlertRuleService) validateRuleMutation(ctx context.Context, rule *models.AlertRule) error {
	if service.ruleValidator == nil || rule == nil {
		return nil
	}
	return service.ruleValidator.ValidateRuleMutation(ctx, rule)
}
