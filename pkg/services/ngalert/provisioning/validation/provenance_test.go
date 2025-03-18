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
