package validation

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// CanUpdateProvenanceInRuleGroup checks if a provenance can be updated for a rule group and its alerts.
// ReplaceRuleGroup function intends to replace an entire rule group: inserting, updating, and removing rules.
func CanUpdateProvenanceInRuleGroup(storedProvenance, provenance models.Provenance) bool {
	// Same provenance is always allowed
	if storedProvenance == provenance {
		return true
	}

	// Can always update stored ProvenanceNone
	if storedProvenance == models.ProvenanceNone {
		return true
	}

	// Can reset to ProvenanceNone from specific provenances
	if provenance == models.ProvenanceNone {
		return storedProvenance == models.ProvenanceAPI ||
			storedProvenance == models.ProvenanceConvertedPrometheus
	}

	return false
}

type ProvenanceStatusTransitionValidator = func(ctx context.Context, from, to models.Provenance) error

// NewPermissionAwareValidator
// returns a ProvenanceStatusTransitionValidator that requires user to have the SetProvisioningStatus permission unless the provenance is None and is not changed
func NewPermissionAwareValidator(ac accesscontrol.AccessControl) ProvenanceStatusTransitionValidator {
	return func(ctx context.Context, from, to models.Provenance) error {
		// converted_prometheus is a special case that comes from imported resources. We should not allow users set or unset it.
		if from == models.ProvenanceConvertedPrometheus || to == models.ProvenanceConvertedPrometheus {
			return MakeErrProvenanceChangeNotAllowedWithReason(from, to, "cannot change provenance from or to 'converted_prometheus'")
		}
		// only none to none does not require permissions check
		if from == models.ProvenanceNone && to == models.ProvenanceNone {
			return nil
		}
		user, err := identity.GetRequester(ctx)
		if err != nil {
			// Treat missing/invalid requester as a deterministic authorization failure
			return MakeErrProvenanceChangeNotAllowedWithReason(from, to, "missing requester")
		}
		ok, err := ac.Evaluate(ctx, user,
			accesscontrol.EvalAny(
				accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningWrite),
				accesscontrol.EvalPermission(accesscontrol.ActionAlertingNotificationsProvisioningWrite),
				accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningSetStatus),
			),
		)
		if err != nil {
			return err
		}
		if !ok {
			return MakeErrProvenanceChangeNotAllowedWithReason(from, to, "missing permission")
		}
		return nil
	}
}

// ValidateProvenanceRelaxed checks if the transition of provenance status from `from` to `to` is allowed.
// Applies relaxed checks that prevents only transition from any status to `none`.
// Returns ErrProvenanceChangeNotAllowed if transition is not allowed
func ValidateProvenanceRelaxed(_ context.Context, from, to models.Provenance) error {
	if from == models.ProvenanceNone { // allow any transition from none
		return nil
	}
	if to == models.ProvenanceNone { // allow any transition to none unless it's from "none" either
		return MakeErrProvenanceChangeNotAllowedWithReason(from, to, "transition is not allowed")
	}
	return nil
}

// ValidateProvenanceOfDependentResources returns a list of allowed provenance statuses for dependent resources
// in the case when they need to be updated when the resource they depend on is changed.
func ValidateProvenanceOfDependentResources(parentProvenance models.Provenance) func(childProvenance models.Provenance) bool {
	return func(childProvenance models.Provenance) bool {
		return parentProvenance == childProvenance || childProvenance == models.ProvenanceNone
	}
}
