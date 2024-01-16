package provisioning

import (
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// canUpdateProvenanceInRuleGroup checks if a provenance can be updated for a rule group and its alerts.
// ReplaceRuleGroup function intends to replace an entire rule group: inserting, updating, and removing rules.
func canUpdateProvenanceInRuleGroup(storedProvenance, provenance models.Provenance) bool {
	return storedProvenance == provenance ||
		storedProvenance == models.ProvenanceNone ||
		(storedProvenance == models.ProvenanceAPI && provenance == models.ProvenanceNone)
}
