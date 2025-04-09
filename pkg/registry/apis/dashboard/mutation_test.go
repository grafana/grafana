package dashboard

import (
	"context"
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
)

func TestDashboardAPIBuilder_Mutate(t *testing.T) {
	tests := []struct {
		name              string
		inputObj          runtime.Object
		operation         admission.Operation
		expectedID        int64
		migrationExpected bool
	}{
		{
			name: "should skip non-create/update operations",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"id": float64(123),
					},
				},
			},
			operation:  admission.Delete,
			expectedID: 0,
		},
		{
			name: "v0 should extract id and set as label",
			inputObj: &v0alpha1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"id": float64(123),
					},
				},
			},
			operation:  admission.Create,
			expectedID: 123,
		},
		{
			name: "v1 should migrate dashboard to the latest version, if possible, and set as label",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"id":            float64(456),
						"schemaVersion": schemaversion.MIN_VERSION,
					},
				},
			},
			operation:         admission.Create,
			expectedID:        456,
			migrationExpected: true,
		},
		{
			name: "v1 should not error mutation hook if migration fails",
			inputObj: &v1alpha1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"id":            float64(456),
						"schemaVersion": schemaversion.MIN_VERSION - 1,
					},
				},
			},
			operation:  admission.Create,
			expectedID: 456,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &DashboardsAPIBuilder{}
			err := b.Mutate(context.Background(), admission.NewAttributesRecord(
				tt.inputObj,
				nil,
				schema.GroupVersionKind{},
				"",
				"test",
				schema.GroupVersionResource{},
				"",
				tt.operation,
				nil,
				false,
				nil,
			), nil)
			require.NoError(t, err)

			if tt.operation == admission.Create || tt.operation == admission.Update {
				meta, err := utils.MetaAccessor(tt.inputObj)
				require.NoError(t, err)
				require.Equal(t, tt.expectedID, meta.GetDeprecatedInternalID()) //nolint:staticcheck

				switch v := tt.inputObj.(type) {
				case *v0alpha1.Dashboard:
					_, exists := v.Spec.Object["id"]
					require.False(t, exists, "id should be removed from spec")
				case *v1alpha1.Dashboard:
					_, exists := v.Spec.Object["id"]
					require.False(t, exists, "id should be removed from spec")
					schemaVersion, ok := v.Spec.Object["schemaVersion"].(int)
					require.True(t, ok, "schemaVersion should be an integer")
					if tt.migrationExpected {
						require.Equal(t, schemaversion.LATEST_VERSION, schemaVersion, "dashboard should be migrated to the latest version")
					}
				}
			}
		})
	}
}
