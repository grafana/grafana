package validation

import (
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// CanUpdateProvenanceInRuleGroup checks if a provenance can be updated for a rule group and its alerts.
// ReplaceRuleGroup function intends to replace an entire rule group: inserting, updating, and removing rules.
func CanUpdateProvenanceInRuleGroup(storedProvenance, provenance models.Provenance) bool {
	return storedProvenance == provenance ||
		storedProvenance == models.ProvenanceNone ||
		(storedProvenance == models.ProvenanceAPI && provenance == models.ProvenanceNone)
}

type ProvenanceStatusTransitionValidator = func(from, to models.Provenance) error

// ValidateProvenanceRelaxed checks if the transition of provenance status from `from` to `to` is allowed.
// Applies relaxed checks that prevents only transition from any status to `none`.
// Returns ErrProvenanceChangeNotAllowed if transition is not allowed
func ValidateProvenanceRelaxed(from, to models.Provenance) error {
	if from == models.ProvenanceNone { // allow any transition from none
		return nil
	}
	if to == models.ProvenanceNone { // allow any transition to none unless it's from "none" either
		return MakeErrProvenanceChangeNotAllowed(from, to)
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
