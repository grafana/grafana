package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/utils/ptr"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// nolint:gocyclo
func TestDashboardAPIBuilder_Mutate(t *testing.T) {
	migration.Initialize(testutil.NewDataSourceProvider(testutil.StandardTestConfig), testutil.NewLibraryElementProvider(), migration.DefaultCacheTTL)
	tests := []struct {
		name                string
		inputObj            runtime.Object
		operation           admission.Operation
		expectedID          int64
		migrationExpected   bool
		expectedTitle       string
		expectedDescription string
		expectedError       bool
		fieldValidationMode string
		checkBOMStripping   bool
		expectedPanelTitle  string
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
		{
			name: "v0 should strip BOMs from dashboard spec",
			inputObj: &dashv0.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"title":       "\ufeffDashboard Title",
						"description": "Description\ufeffwith BOM",
						"panels": []interface{}{
							map[string]interface{}{
								"title": "\ufeffPanel 1",
								"type":  "graph",
							},
						},
					},
				},
			},
			operation:           admission.Create,
			checkBOMStripping:   true,
			expectedTitle:       "Dashboard Title",
			expectedDescription: "Descriptionwith BOM",
			expectedPanelTitle:  "Panel 1",
		},
		{
			name: "v1 should strip BOMs from dashboard spec",
			inputObj: &dashv1.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"title":         "\ufeffDashboard Title",
						"description":   "Description\ufeffwith BOM",
						"schemaVersion": schemaversion.LATEST_VERSION,
						"panels": []interface{}{
							map[string]interface{}{
								"title": "\ufeffPanel 1",
								"type":  "graph",
							},
						},
					},
				},
			},
			operation:           admission.Create,
			checkBOMStripping:   true,
			expectedTitle:       "Dashboard Title",
			expectedDescription: "Descriptionwith BOM",
			expectedPanelTitle:  "Panel 1",
		},
		{
			name: "v2alpha1 should strip BOMs from title and description",
			inputObj: &dashv2alpha1.Dashboard{
				Spec: dashv2alpha1.DashboardSpec{
					Title:       "\ufeffDashboard Title",
					Description: ptr.To("Description\ufeffwith BOM"),
				},
			},
			operation:           admission.Create,
			checkBOMStripping:   true,
			expectedTitle:       "Dashboard Title",
			expectedDescription: "Descriptionwith BOM",
		},
		{
			name: "v2beta1 should strip BOMs from title and description",
			inputObj: &dashv2beta1.Dashboard{
				Spec: dashv2beta1.DashboardSpec{
					Title:       "\ufeffDashboard Title",
					Description: ptr.To("Description\ufeffwith BOM"),
				},
			},
			operation:           admission.Create,
			checkBOMStripping:   true,
			expectedTitle:       "Dashboard Title",
			expectedDescription: "Descriptionwith BOM",
		},
		{
			name: "v0 should strip BOMs during UPDATE operation (simulating PATCH)",
			inputObj: &dashv0.Dashboard{
				Spec: common.Unstructured{
					Object: map[string]interface{}{
						"title":       "\ufeffDashboard Title",
						"description": "Description\ufeffwith BOM",
					},
				},
			},
			operation:           admission.Update,
			checkBOMStripping:   true,
			expectedTitle:       "Dashboard Title",
			expectedDescription: "Descriptionwith BOM",
		},
		{
			name: "v2alpha1 should strip BOMs from nested fields (tags, links)",
			inputObj: &dashv2alpha1.Dashboard{
				Spec: dashv2alpha1.DashboardSpec{
					Title:       "\ufeffDashboard with nested BOMs",
					Description: ptr.To("Description\ufeffwith BOM"),
					Tags:        []string{"\ufeffTag1", "Tag2\ufeff", "Tag3"},
					Links: []dashv2alpha1.DashboardDashboardLink{
						{
							Title:   "\ufeffLink Title",
							Tooltip: "Tooltip\ufeffwith BOM",
							Icon:    "\ufefficon-name",
						},
					},
				},
			},
			operation:         admission.Create,
			checkBOMStripping: true,
			expectedTitle:     "Dashboard with nested BOMs",
		},
		{
			name: "v2beta1 should strip BOMs from nested fields (tags, links)",
			inputObj: &dashv2beta1.Dashboard{
				Spec: dashv2beta1.DashboardSpec{
					Title:       "\ufeffDashboard with nested BOMs v2beta1",
					Description: ptr.To("Description\ufeffwith BOM"),
					Tags:        []string{"\ufeffTag1", "Tag2\ufeff", "Tag3"},
					Links: []dashv2beta1.DashboardDashboardLink{
						{
							Title:   "\ufeffLink Title",
							Tooltip: "Tooltip\ufeffwith BOM",
							Icon:    "\ufefficon-name",
						},
					},
				},
			},
			operation:         admission.Create,
			checkBOMStripping: true,
			expectedTitle:     "Dashboard with nested BOMs v2beta1",
		},
		{
			name: "v2 should strip BOMs from nested fields (tags, links)",
			inputObj: &dashv2.Dashboard{
				Spec: dashv2.DashboardSpec{
					Title:       "\ufeffDashboard with nested BOMs v2",
					Description: ptr.To("Description\ufeffwith BOM"),
					Tags:        []string{"\ufeffTag1", "Tag2\ufeff", "Tag3"},
					Links: []dashv2.DashboardDashboardLink{
						{
							Title:   "\ufeffLink Title",
							Tooltip: "Tooltip\ufeffwith BOM",
							Icon:    "\ufefficon-name",
						},
					},
				},
			},
			operation:         admission.Create,
			checkBOMStripping: true,
			expectedTitle:     "Dashboard with nested BOMs v2",
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
				dashv1.DashboardResourceInfo.GroupVersionKind(),
				"",
				"test",
				dashv1.DashboardResourceInfo.GroupVersionResource(),
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
					if tt.checkBOMStripping {
						title, _ := v.Spec.Object["title"].(string)
						require.Equal(t, tt.expectedTitle, title, "title should have BOMs stripped")
						require.NotContains(t, title, "\ufeff", "title should not contain BOMs")

						description, _ := v.Spec.Object["description"].(string)
						require.Equal(t, tt.expectedDescription, description, "description should have BOMs stripped")
						require.NotContains(t, description, "\ufeff", "description should not contain BOMs")

						if tt.expectedPanelTitle != "" {
							panels, ok := v.Spec.Object["panels"].([]interface{})
							require.True(t, ok, "panels should be a slice")
							require.NotEmpty(t, panels, "panels should not be empty")
							panel, ok := panels[0].(map[string]interface{})
							require.True(t, ok, "panel should be a map")
							panelTitle, _ := panel["title"].(string)
							require.Equal(t, tt.expectedPanelTitle, panelTitle, "panel title should have BOMs stripped")
							require.NotContains(t, panelTitle, "\ufeff", "panel title should not contain BOMs")
						}
					}
				case *dashv1.Dashboard:
					_, exists := v.Spec.Object["id"]
					require.False(t, exists, "id should be removed from spec")
					schemaVersion, ok := v.Spec.Object["schemaVersion"].(int)
					require.True(t, ok, "schemaVersion should be an integer")
					if tt.migrationExpected {
						require.Equal(t, schemaversion.LATEST_VERSION, schemaVersion, "dashboard should be migrated to the latest version")
					}
					if tt.checkBOMStripping {
						title, _ := v.Spec.Object["title"].(string)
						require.Equal(t, tt.expectedTitle, title, "title should have BOMs stripped")
						require.NotContains(t, title, "\ufeff", "title should not contain BOMs")

						description, _ := v.Spec.Object["description"].(string)
						require.Equal(t, tt.expectedDescription, description, "description should have BOMs stripped")
						require.NotContains(t, description, "\ufeff", "description should not contain BOMs")

						if tt.expectedPanelTitle != "" {
							panels, ok := v.Spec.Object["panels"].([]interface{})
							require.True(t, ok, "panels should be a slice")
							require.NotEmpty(t, panels, "panels should not be empty")
							panel, ok := panels[0].(map[string]interface{})
							require.True(t, ok, "panel should be a map")
							panelTitle, _ := panel["title"].(string)
							require.Equal(t, tt.expectedPanelTitle, panelTitle, "panel title should have BOMs stripped")
							require.NotContains(t, panelTitle, "\ufeff", "panel title should not contain BOMs")
						}
					}
				case *dashv2alpha1.Dashboard:
					if tt.checkBOMStripping {
						require.Equal(t, tt.expectedTitle, v.Spec.Title, "title should have BOMs stripped")
						require.NotContains(t, v.Spec.Title, "\ufeff", "title should not contain BOMs")
						if v.Spec.Description != nil {
							require.NotContains(t, *v.Spec.Description, "\ufeff", "description should not contain BOMs")
						}
						// Check nested fields (tags, links)
						for _, tag := range v.Spec.Tags {
							require.NotContains(t, tag, "\ufeff", "tags should not contain BOMs")
						}
						for _, link := range v.Spec.Links {
							require.NotContains(t, link.Title, "\ufeff", "link title should not contain BOMs")
							require.NotContains(t, link.Tooltip, "\ufeff", "link tooltip should not contain BOMs")
							require.NotContains(t, link.Icon, "\ufeff", "link icon should not contain BOMs")
						}
					}
				case *dashv2beta1.Dashboard:
					if tt.checkBOMStripping {
						require.Equal(t, tt.expectedTitle, v.Spec.Title, "title should have BOMs stripped")
						require.NotContains(t, v.Spec.Title, "\ufeff", "title should not contain BOMs")
						if v.Spec.Description != nil {
							require.NotContains(t, *v.Spec.Description, "\ufeff", "description should not contain BOMs")
						}
						// Check nested fields (tags, links)
						for _, tag := range v.Spec.Tags {
							require.NotContains(t, tag, "\ufeff", "tags should not contain BOMs")
						}
						for _, link := range v.Spec.Links {
							require.NotContains(t, link.Title, "\ufeff", "link title should not contain BOMs")
							require.NotContains(t, link.Tooltip, "\ufeff", "link tooltip should not contain BOMs")
							require.NotContains(t, link.Icon, "\ufeff", "link icon should not contain BOMs")
						}
					} else if tt.expectedTitle != "" {
						require.Equal(t, tt.expectedTitle, v.Spec.Title, "title should be set")
					}
					if !tt.checkBOMStripping {
						require.NotNil(t, v.Spec.Layout, "layout should be set")
						require.NotNil(t, v.Spec.Layout.GridLayoutKind, "layout should be a GridLayout")
					}
				case *dashv2.Dashboard:
					if tt.checkBOMStripping {
						require.Equal(t, tt.expectedTitle, v.Spec.Title, "title should have BOMs stripped")
						require.NotContains(t, v.Spec.Title, "\ufeff", "title should not contain BOMs")
						if v.Spec.Description != nil {
							require.NotContains(t, *v.Spec.Description, "\ufeff", "description should not contain BOMs")
						}
						// Check nested fields (tags, links)
						for _, tag := range v.Spec.Tags {
							require.NotContains(t, tag, "\ufeff", "tags should not contain BOMs")
						}
						for _, link := range v.Spec.Links {
							require.NotContains(t, link.Title, "\ufeff", "link title should not contain BOMs")
							require.NotContains(t, link.Tooltip, "\ufeff", "link tooltip should not contain BOMs")
							require.NotContains(t, link.Icon, "\ufeff", "link icon should not contain BOMs")
						}
					}
				}
			}
		})
	}
}
