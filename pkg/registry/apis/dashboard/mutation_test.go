package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestDashboardAPIBuilder_Mutate(t *testing.T) {
	migration.Initialize(testutil.GetTestDataSourceProvider(), testutil.GetTestPanelProvider())
	tests := []struct {
		name                string
		inputObj            runtime.Object
		operation           admission.Operation
		expectedID          int64
		migrationExpected   bool
		expectedTitle       string
		expectedError       bool
		fieldValidationMode string
	}{
		{
			name: "should skip non-create/update operations",
			inputObj: &dashv1.Dashboard{
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
			inputObj: &dashv0.Dashboard{
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
			name: "v0 should not fail with invalid schema",
			inputObj: &dashv0.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"id":       float64(123),
						"revision": "revision-is-a-number",
					},
				},
			},
			operation:  admission.Create,
			expectedID: 123,
		},
		{
			name: "v1 should fail with invalid schema",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"id":       float64(123),
						"revision": "revision-is-a-number",
					},
				},
			},
			operation:     admission.Create,
			expectedError: true,
		},
		{
			name: "v1 should not fail with invalid schema and FieldValidationIgnore is set",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"id":       float64(123),
						"revision": "revision-is-a-number",
					},
				},
			},
			operation:           admission.Create,
			fieldValidationMode: metav1.FieldValidationIgnore,
			expectedError:       false,
			expectedID:          123,
		},
		{
			name: "v1 should migrate dashboard to the latest version, if possible, and set as label",
			inputObj: &dashv1.Dashboard{
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
			name: "v1 should error mutation hook if migration fails",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"id":            float64(456),
						"schemaVersion": schemaversion.MIN_VERSION - 1,
					},
				},
			},
			operation:     admission.Create,
			expectedError: true,
		},
		{
			name: "v1 should not error mutation hook if migration fails and FieldValidationIgnore is set",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"id":            float64(456),
						"schemaVersion": schemaversion.MIN_VERSION - 1,
					},
				},
			},
			expectedID:          456,
			operation:           admission.Create,
			fieldValidationMode: metav1.FieldValidationIgnore,
			expectedError:       false,
		},
		{
			name: "v2alpha1 should set layout if it is not set",
			inputObj: &dashv2alpha1.Dashboard{
				Spec: dashv2alpha1.DashboardSpec{
					Title: "test123",
				},
			},
			operation:     admission.Create,
			expectedTitle: "test123",
		},
		{
			name: "v2beta1 should set layout if it is not set",
			inputObj: &dashv2beta1.Dashboard{
				Spec: dashv2beta1.DashboardSpec{
					Title: "test123",
				},
			},
			operation:     admission.Create,
			expectedTitle: "test123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &DashboardsAPIBuilder{
				features: featuremgmt.WithFeatures(),
			}
			var operationOptions runtime.Object
			switch tt.operation {
			case admission.Create:
				operationOptions = &metav1.CreateOptions{FieldValidation: tt.fieldValidationMode}
			case admission.Update:
				operationOptions = &metav1.UpdateOptions{FieldValidation: tt.fieldValidationMode}
			default:
				operationOptions = nil
			}
			err := b.Mutate(context.Background(), admission.NewAttributesRecord(
				tt.inputObj,
				nil,
				schema.GroupVersionKind{},
				"",
				"test",
				schema.GroupVersionResource{},
				"",
				tt.operation,
				operationOptions,
				false,
				nil,
			), nil)

			if tt.expectedError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			if tt.operation == admission.Create || tt.operation == admission.Update {
				meta, err := utils.MetaAccessor(tt.inputObj)
				require.NoError(t, err)
				require.Equal(t, tt.expectedID, meta.GetDeprecatedInternalID()) //nolint:staticcheck

				switch v := tt.inputObj.(type) {
				case *dashv0.Dashboard:
					_, exists := v.Spec.Object["id"]
					require.False(t, exists, "id should be removed from spec")
				case *dashv1.Dashboard:
					_, exists := v.Spec.Object["id"]
					require.False(t, exists, "id should be removed from spec")
					schemaVersion, ok := v.Spec.Object["schemaVersion"].(int)
					require.True(t, ok, "schemaVersion should be an integer")
					if tt.migrationExpected {
						require.Equal(t, schemaversion.LATEST_VERSION, schemaVersion, "dashboard should be migrated to the latest version")
					}
				case *dashv2alpha1.Dashboard:
				case *dashv2beta1.Dashboard:
					require.Equal(t, tt.expectedTitle, v.Spec.Title, "title should be set")
					require.NotNil(t, v.Spec.Layout, "layout should be set")
					require.NotNil(t, v.Spec.Layout.GridLayoutKind, "layout should be a GridLayout")
				}
			}
		})
	}
}
