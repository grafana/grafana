package alertrule

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestToAPIError(t *testing.T) {
	t.Run("validation failure becomes BadRequest", func(t *testing.T) {
		err := toAPIError(fmt.Errorf("%w: missing annotations.summary", ngmodels.ErrAlertRuleFailedValidation))
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.Status().Code)
	})

	t.Run("quota reached becomes Forbidden", func(t *testing.T) {
		err := toAPIError(ngmodels.ErrQuotaReached)
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(403), statusErr.Status().Code)
	})

	t.Run("not found stays NotFound", func(t *testing.T) {
		err := toAPIError(ngmodels.ErrAlertRuleNotFound)
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(404), statusErr.Status().Code)
	})

	t.Run("unrecognized error passes through unchanged", func(t *testing.T) {
		original := fmt.Errorf("boom")
		require.Same(t, original, toAPIError(original))
	})
}
