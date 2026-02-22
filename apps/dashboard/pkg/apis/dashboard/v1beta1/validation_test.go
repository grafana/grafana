package v1beta1

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestValidateDashboardSpec_GnetID(t *testing.T) {
	t.Run("accepts numeric gnetId", func(t *testing.T) {
		obj := &Dashboard{
			Spec: DashboardSpec{
				Object: map[string]any{
					"schemaVersion": schemaversion.LATEST_VERSION,
					"title":         "gnet-id-dashboard",
					"gnetId":        int64(9628),
				},
			},
		}

		errs, schemaVersionErrs := ValidateDashboardSpec(obj, false)
		require.Empty(t, schemaVersionErrs)
		require.Empty(t, errs)
	})

	t.Run("rejects string gnetId", func(t *testing.T) {
		obj := &Dashboard{
			Spec: DashboardSpec{
				Object: map[string]any{
					"schemaVersion": schemaversion.LATEST_VERSION,
					"title":         "gnet-id-dashboard",
					"gnetId":        "9628",
				},
			},
		}

		errs, schemaVersionErrs := ValidateDashboardSpec(obj, false)
		require.Empty(t, schemaVersionErrs)
		require.NotEmpty(t, errs)
		require.Contains(t, errs.ToAggregate().Error(), "gnetId")
	})
}
