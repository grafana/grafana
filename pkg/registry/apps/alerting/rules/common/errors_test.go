package common

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestToAPIError(t *testing.T) {
	for _, resource := range []string{"alertrules", "recordingrules"} {
		t.Run(resource, func(t *testing.T) {
			groupResource := schema.GroupResource{Group: "rules.alerting.grafana.app", Resource: resource}
			for _, tc := range []struct {
				name string
				err  error
				code int32
			}{
				{name: "validation", err: fmt.Errorf("%w: missing annotations.summary", ngmodels.ErrAlertRuleFailedValidation), code: 400},
				{name: "quota", err: fmt.Errorf("create failed: %w", ngmodels.ErrQuotaReached), code: 403},
				{name: "not found", err: fmt.Errorf("update failed: %w", ngmodels.ErrAlertRuleNotFound), code: 404},
			} {
				t.Run(tc.name, func(t *testing.T) {
					err := ToAPIError(groupResource, "my-rule", tc.err)
					var statusErr *apierrors.StatusError
					require.ErrorAs(t, err, &statusErr)
					require.Equal(t, tc.code, statusErr.Status().Code)
					if tc.code != 400 {
						require.Equal(t, "my-rule", statusErr.Status().Details.Name)
						require.Equal(t, groupResource.Group, statusErr.Status().Details.Group)
						require.Equal(t, groupResource.Resource, statusErr.Status().Details.Kind)
					}
				})
			}
			t.Run("unrecognized error passes through unchanged", func(t *testing.T) {
				original := fmt.Errorf("boom")
				require.Same(t, original, ToAPIError(groupResource, "my-rule", original))
			})
		})
	}
}
