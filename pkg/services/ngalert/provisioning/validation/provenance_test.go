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
	nonNone := []models.Provenance{
		models.ProvenanceAPI,
		models.ProvenanceFile,
		models.ProvenanceConvertedPrometheus,
	}

	ctxWithUser := identity.WithRequester(context.Background(), &user.SignedInUser{})
	ctxNoUser := context.Background()

	t.Run("None to None is always allowed", func(t *testing.T) {
		v := NewPermissionAwareValidator(actest.FakeAccessControl{ExpectedEvaluate: false})
		require.NoError(t, v(ctxWithUser, models.ProvenanceNone, models.ProvenanceNone))
		require.NoError(t, v(ctxNoUser, models.ProvenanceNone, models.ProvenanceNone))
	})

	t.Run("non-None to None is always allowed", func(t *testing.T) {
		v := NewPermissionAwareValidator(actest.FakeAccessControl{ExpectedEvaluate: false})
		for _, from := range nonNone {
			require.NoError(t, v(ctxWithUser, from, models.ProvenanceNone),
				"transition %s -> None should be allowed", from)
			require.NoError(t, v(ctxNoUser, from, models.ProvenanceNone),
				"transition %s -> None should be allowed without user in ctx", from)
		}
	})

	t.Run("non-None to non-None is always allowed", func(t *testing.T) {
		v := NewPermissionAwareValidator(actest.FakeAccessControl{ExpectedEvaluate: false})
		for _, from := range nonNone {
			for _, to := range nonNone {
				require.NoError(t, v(ctxWithUser, from, to),
					"transition %s -> %s should be allowed", from, to)
			}
		}
	})

	t.Run("None to non-None is blocked without permission", func(t *testing.T) {
		v := NewPermissionAwareValidator(actest.FakeAccessControl{ExpectedEvaluate: false})
		for _, to := range nonNone {
			err := v(ctxWithUser, models.ProvenanceNone, to)
			require.Error(t, err, "transition None -> %s should be blocked without permission", to)
		}
	})

	t.Run("None to non-None is allowed with permission", func(t *testing.T) {
		v := NewPermissionAwareValidator(actest.FakeAccessControl{ExpectedEvaluate: true})
		for _, to := range nonNone {
			require.NoError(t, v(ctxWithUser, models.ProvenanceNone, to),
				"transition None -> %s should be allowed with permission", to)
		}
	})

	t.Run("None to non-None returns error when no user in context", func(t *testing.T) {
		v := NewPermissionAwareValidator(actest.FakeAccessControl{ExpectedEvaluate: true})
		for _, to := range nonNone {
			err := v(ctxNoUser, models.ProvenanceNone, to)
			require.Error(t, err, "transition None -> %s should error when no user in ctx", to)
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
