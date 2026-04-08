package validation

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

func TestNewPermissionAwareValidator(t *testing.T) {
	// provenance values that can be freely set/unset (excluding converted_prometheus)
	settable := []models.Provenance{
		models.ProvenanceAPI,
		models.ProvenanceFile,
	}

	ctxWithUser := identity.WithRequester(context.Background(), &user.SignedInUser{})
	ctxNoUser := context.Background()

	vDenied := NewPermissionAwareValidator(actest.FakeAccessControl{ExpectedEvaluate: false})
	vAllowed := NewPermissionAwareValidator(actest.FakeAccessControl{ExpectedEvaluate: true})

	t.Run("None to None is always allowed", func(t *testing.T) {
		require.NoError(t, vDenied(ctxWithUser, models.ProvenanceNone, models.ProvenanceNone))
		require.NoError(t, vDenied(ctxNoUser, models.ProvenanceNone, models.ProvenanceNone))
	})

	t.Run("any transition involving converted_prometheus is always blocked", func(t *testing.T) {
		all := append(settable, models.ProvenanceNone, models.ProvenanceConvertedPrometheus)
		for _, p := range all {
			require.Error(t, vAllowed(ctxWithUser, models.ProvenanceConvertedPrometheus, p),
				"transition converted_prometheus -> %s should be blocked", p)
			require.Error(t, vAllowed(ctxWithUser, p, models.ProvenanceConvertedPrometheus),
				"transition %s -> converted_prometheus should be blocked", p)
		}
	})

	t.Run("all other transitions require permission", func(t *testing.T) {
		type transition struct{ from, to models.Provenance }
		var transitions []transition
		for _, from := range append(settable, models.ProvenanceNone) {
			for _, to := range append(settable, models.ProvenanceNone) {
				if from == models.ProvenanceNone && to == models.ProvenanceNone {
					continue // already covered above
				}
				transitions = append(transitions, transition{from, to})
			}
		}

		for _, tr := range transitions {
			require.Error(t, vDenied(ctxWithUser, tr.from, tr.to),
				"transition %s -> %s should be blocked without permission", tr.from, tr.to)
			require.NoError(t, vAllowed(ctxWithUser, tr.from, tr.to),
				"transition %s -> %s should be allowed with permission", tr.from, tr.to)
			require.Error(t, vAllowed(ctxNoUser, tr.from, tr.to),
				"transition %s -> %s should error when no user in ctx", tr.from, tr.to)
		}
	})
}

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
			assert.NoError(t, ValidateProvenanceRelaxed(context.Background(), models.ProvenanceNone, provenance))
		}
	})
	t.Run("noop transitions are allowed", func(t *testing.T) {
		for _, provenance := range all {
			assert.NoError(t, ValidateProvenanceRelaxed(context.Background(), provenance, provenance))
		}
	})
	t.Run("no transitions to 'none' are allowed", func(t *testing.T) {
		for _, from := range all {
			if from == models.ProvenanceNone {
				continue
			}
			assert.ErrorIsf(t, ErrProvenanceChangeNotAllowed.Base, ValidateProvenanceRelaxed(context.Background(), from, models.ProvenanceNone), "transition %s -> 'none' is allowed but should not", from)
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
				assert.NoError(t, ValidateProvenanceRelaxed(context.Background(), from, to))
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
