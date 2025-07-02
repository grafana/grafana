package validation

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func TestValidateProvenanceRelaxed(t *testing.T) {
	all := []models.Provenance{
		models.ProvenanceNone,
		models.ProvenanceAPI,
		models.ProvenanceFile,
		models.ProvenanceConvertedPrometheus,
		models.Provenance(fmt.Sprintf("random-%s", util.GenerateShortUID())),
	}
	t.Run("all transitions from 'none' are allowed", func(t *testing.T) {
		for _, provenance := range all {
			assert.NoError(t, ValidateProvenanceRelaxed(models.ProvenanceNone, provenance))
		}
	})
	t.Run("noop transitions are allowed", func(t *testing.T) {
		for _, provenance := range all {
			assert.NoError(t, ValidateProvenanceRelaxed(provenance, provenance))
		}
	})
	t.Run("no transitions to 'none' are allowed", func(t *testing.T) {
		for _, from := range all {
			if from == models.ProvenanceNone {
				continue
			}
			assert.ErrorIsf(t, ErrProvenanceChangeNotAllowed.Base, ValidateProvenanceRelaxed(from, models.ProvenanceNone), "transition %s -> 'none' is allowed but should not", from)
		}
	})
	t.Run("transitions between others are are allowed", func(t *testing.T) {
		for _, from := range all {
			if from == models.ProvenanceNone {
				continue
			}
			for _, to := range all {
				if to == models.ProvenanceNone || from == to {
					continue
				}
				assert.NoError(t, ValidateProvenanceRelaxed(from, to))
			}
		}
	})
}

func TestCanUpdateProvenanceInRuleGroup(t *testing.T) {
	all := []models.Provenance{
		models.ProvenanceNone,
		models.ProvenanceAPI,
		models.ProvenanceFile,
		models.ProvenanceConvertedPrometheus,
		models.Provenance(fmt.Sprintf("random-%s", util.GenerateShortUID())),
	}

	t.Run("same provenance transitions are allowed", func(t *testing.T) {
		for _, provenance := range all {
			assert.True(t, CanUpdateProvenanceInRuleGroup(provenance, provenance))
		}
	})

	t.Run("all transitions from 'none' are allowed", func(t *testing.T) {
		for _, provenance := range all {
			assert.True(t, CanUpdateProvenanceInRuleGroup(models.ProvenanceNone, provenance))
		}
	})

	t.Run("only specific provenances can transition to 'none'", func(t *testing.T) {
		allowed := []models.Provenance{
			models.ProvenanceAPI,
			models.ProvenanceConvertedPrometheus,
		}

		for _, from := range allowed {
			assert.True(t, CanUpdateProvenanceInRuleGroup(from, models.ProvenanceNone),
				"transition %s -> 'none' should be allowed", from)
		}

		notAllowed := []models.Provenance{
			models.ProvenanceFile,
			models.Provenance(fmt.Sprintf("random-%s", util.GenerateShortUID())),
		}

		for _, from := range notAllowed {
			assert.False(t, CanUpdateProvenanceInRuleGroup(from, models.ProvenanceNone),
				"transition %s -> 'none' should not be allowed", from)
		}
	})

	t.Run("transitions between different provenances are not allowed", func(t *testing.T) {
		for _, from := range all {
			if from == models.ProvenanceNone {
				continue // always allowed
			}
			for _, to := range all {
				if from == to || to == models.ProvenanceNone {
					continue // always allowed
				}
				assert.False(t, CanUpdateProvenanceInRuleGroup(from, to),
					"transition %s -> '%s' should not be allowed", from, to)
			}
		}
	})
}
