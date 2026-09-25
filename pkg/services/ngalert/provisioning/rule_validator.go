package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// RuleMutationValidator is consulted before alert rules are created or updated and can
// reject the write by returning an error. OSS provides a no-op default; the real
// implementation is supplied by dependency injection.
//
// Returning an error fails the write, so an implementation should fail open on its own
// internal errors rather than make rule management unavailable.
type RuleMutationValidator interface {
	// rules holds every rule a single write persists, so an implementation can resolve
	// what it validates against once per write.
	ValidateRuleMutations(ctx context.Context, rules []*models.AlertRule, manager utils.ManagerProperties) error
}

type NoopRuleMutationValidator struct{}

func (NoopRuleMutationValidator) ValidateRuleMutations(context.Context, []*models.AlertRule, utils.ManagerProperties) error {
	return nil
}

func ProvideRuleMutationValidator() RuleMutationValidator {
	return NoopRuleMutationValidator{}
}

// A nil validator is tolerated so an AlertRuleService built as a struct literal, as some
// tests do, does not panic.
func (service *AlertRuleService) validateRuleMutations(ctx context.Context, rules []*models.AlertRule, manager utils.ManagerProperties) error {
	if service.ruleValidator == nil {
		return nil
	}
	mutated := make([]*models.AlertRule, 0, len(rules))
	for _, rule := range rules {
		if rule != nil {
			mutated = append(mutated, rule)
		}
	}
	if len(mutated) == 0 {
		return nil
	}
	return service.ruleValidator.ValidateRuleMutations(ctx, mutated, manager)
}
