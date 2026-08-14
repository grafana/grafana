package v2beta1

import (
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestTrimStringArrays(t *testing.T) {
	tests := []struct {
		name     string
		input    [][]string
		expected [][]string
	}{
		{
			name:     "nil input",
			input:    nil,
			expected: nil,
		},
		{
			name:     "empty input",
			input:    [][]string{},
			expected: [][]string{},
		},
		{
			name:     "arrays with exactly 2 elements",
			input:    [][]string{{"key1", "value1"}, {"key2", "value2"}},
			expected: [][]string{{"key1", "value1"}, {"key2", "value2"}},
		},
		{
			name:     "arrays with less than 2 elements",
			input:    [][]string{{"key1"}, {}},
			expected: [][]string{{"key1"}, {}},
		},
		{
			name:     "arrays with more than 2 elements",
			input:    [][]string{{"key1", "value1", "extra1"}, {"key2", "value2", "extra2", "extra3"}},
			expected: [][]string{{"key1", "value1"}, {"key2", "value2"}},
		},
		{
			name:     "mixed arrays",
			input:    [][]string{{"key1"}, {"key2", "value2"}, {"key3", "value3", "extra"}},
			expected: [][]string{{"key1"}, {"key2", "value2"}, {"key3", "value3"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := trimStringArrays(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestProcessActions(t *testing.T) {
	tests := []struct {
		name     string
		actions  []DashboardAction
		expected []DashboardAction
	}{
		{
			name:     "empty actions",
			actions:  []DashboardAction{},
			expected: []DashboardAction{},
		},
		{
			name: "action with fetch options having oversized arrays",
			actions: []DashboardAction{
				{
					Type:  DashboardActionTypeFetch,
					Title: "Test Fetch",
					Fetch: &DashboardFetchOptions{
						Method: DashboardHttpRequestMethodGET,
						Url:    "http://example.com",
						QueryParams: [][]string{
							{"param1", "value1", "extra1"},
							{"param2", "value2"},
						},
						Headers: [][]string{
							{"header1", "value1", "extra1", "extra2"},
							{"header2", "value2"},
						},
					},
				},
			},
			expected: []DashboardAction{
				{
					Type:  DashboardActionTypeFetch,
					Title: "Test Fetch",
					Fetch: &DashboardFetchOptions{
						Method: DashboardHttpRequestMethodGET,
						Url:    "http://example.com",
						QueryParams: [][]string{
							{"param1", "value1"},
							{"param2", "value2"},
						},
						Headers: [][]string{
							{"header1", "value1"},
							{"header2", "value2"},
						},
					},
				},
			},
		},
		{
			name: "action with infinity options having oversized arrays",
			actions: []DashboardAction{
				{
					Type:  DashboardActionTypeInfinity,
					Title: "Test Infinity",
					Infinity: &DashboardInfinityOptions{
						Method:        DashboardHttpRequestMethodPOST,
						Url:           "http://example.com",
						DatasourceUid: "test-uid",
						QueryParams: [][]string{
							{"param1", "value1", "extra1"},
							{"param2", "value2"},
						},
						Headers: [][]string{
							{"header1", "value1", "extra1", "extra2"},
							{"header2", "value2"},
						},
					},
				},
			},
			expected: []DashboardAction{
				{
					Type:  DashboardActionTypeInfinity,
					Title: "Test Infinity",
					Infinity: &DashboardInfinityOptions{
						Method:        DashboardHttpRequestMethodPOST,
						Url:           "http://example.com",
						DatasourceUid: "test-uid",
						QueryParams: [][]string{
							{"param1", "value1"},
							{"param2", "value2"},
						},
						Headers: [][]string{
							{"header1", "value1"},
							{"header2", "value2"},
						},
					},
				},
			},
		},
		{
			name: "action without fetch or infinity options",
			actions: []DashboardAction{
				{
					Type:  DashboardActionTypeFetch,
					Title: "Test Action",
				},
			},
			expected: []DashboardAction{
				{
					Type:  DashboardActionTypeFetch,
					Title: "Test Action",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a copy to avoid modifying the original
			actionsCopy := make([]DashboardAction, len(tt.actions))
			for i, action := range tt.actions {
				actionsCopy[i] = action
				// Deep copy the fetch options if they exist
				if action.Fetch != nil {
					fetchCopy := *action.Fetch
					if action.Fetch.QueryParams != nil {
						fetchCopy.QueryParams = make([][]string, len(action.Fetch.QueryParams))
						for j, param := range action.Fetch.QueryParams {
							fetchCopy.QueryParams[j] = make([]string, len(param))
							copy(fetchCopy.QueryParams[j], param)
						}
					}
					if action.Fetch.Headers != nil {
						fetchCopy.Headers = make([][]string, len(action.Fetch.Headers))
						for j, header := range action.Fetch.Headers {
							fetchCopy.Headers[j] = make([]string, len(header))
							copy(fetchCopy.Headers[j], header)
						}
					}
					actionsCopy[i].Fetch = &fetchCopy
				}
				// Deep copy the infinity options if they exist
				if action.Infinity != nil {
					infinityCopy := *action.Infinity
					if action.Infinity.QueryParams != nil {
						infinityCopy.QueryParams = make([][]string, len(action.Infinity.QueryParams))
						for j, param := range action.Infinity.QueryParams {
							infinityCopy.QueryParams[j] = make([]string, len(param))
							copy(infinityCopy.QueryParams[j], param)
						}
					}
					if action.Infinity.Headers != nil {
						infinityCopy.Headers = make([][]string, len(action.Infinity.Headers))
						for j, header := range action.Infinity.Headers {
							infinityCopy.Headers[j] = make([]string, len(header))
							copy(infinityCopy.Headers[j], header)
						}
					}
					actionsCopy[i].Infinity = &infinityCopy
				}
			}

			processActions(actionsCopy)
			assert.Equal(t, tt.expected, actionsCopy)
		})
	}
}

func TestValidateAndTrimActionArrays(t *testing.T) {
	tests := []struct {
		name      string
		dashboard *Dashboard
		expected  *Dashboard
	}{
		{
			name: "dashboard with no elements",
			dashboard: &Dashboard{
				TypeMeta: metav1.TypeMeta{
					Kind:       "Dashboard",
					APIVersion: "v2beta1",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-dashboard",
				},
				Spec: DashboardSpec{
					Elements: map[string]DashboardElement{},
				},
			},
			expected: &Dashboard{
				TypeMeta: metav1.TypeMeta{
					Kind:       "Dashboard",
					APIVersion: "v2beta1",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-dashboard",
				},
				Spec: DashboardSpec{
					Elements: map[string]DashboardElement{},
				},
			},
		},
		{
			name: "dashboard with panel having actions with oversized arrays",
			dashboard: &Dashboard{
				TypeMeta: metav1.TypeMeta{
					Kind:       "Dashboard",
					APIVersion: "v2beta1",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-dashboard",
				},
				Spec: DashboardSpec{
					Elements: map[string]DashboardElement{
						"panel1": {
							PanelKind: &DashboardPanelKind{
								Spec: DashboardPanelSpec{
									VizConfig: DashboardVizConfigKind{
										Spec: DashboardVizConfigSpec{
											FieldConfig: DashboardFieldConfigSource{
												Defaults: DashboardFieldConfig{
													Actions: []DashboardAction{
														{
															Type:  DashboardActionTypeFetch,
															Title: "Test Action",
															Fetch: &DashboardFetchOptions{
																Method: DashboardHttpRequestMethodGET,
																Url:    "http://example.com",
																QueryParams: [][]string{
																	{"param1", "value1", "extra1"},
																	{"param2", "value2"},
																},
																Headers: [][]string{
																	{"header1", "value1", "extra1", "extra2"},
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
			expected: &Dashboard{
				TypeMeta: metav1.TypeMeta{
					Kind:       "Dashboard",
					APIVersion: "v2beta1",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-dashboard",
				},
				Spec: DashboardSpec{
					Elements: map[string]DashboardElement{
						"panel1": {
							PanelKind: &DashboardPanelKind{
								Spec: DashboardPanelSpec{
									VizConfig: DashboardVizConfigKind{
										Spec: DashboardVizConfigSpec{
											FieldConfig: DashboardFieldConfigSource{
												Defaults: DashboardFieldConfig{
													Actions: []DashboardAction{
														{
															Type:  DashboardActionTypeFetch,
															Title: "Test Action",
															Fetch: &DashboardFetchOptions{
																Method: DashboardHttpRequestMethodGET,
																Url:    "http://example.com",
																QueryParams: [][]string{
																	{"param1", "value1"},
																	{"param2", "value2"},
																},
																Headers: [][]string{
																	{"header1", "value1"},
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with panel having no actions",
			dashboard: &Dashboard{
				TypeMeta: metav1.TypeMeta{
					Kind:       "Dashboard",
					APIVersion: "v2beta1",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-dashboard",
				},
				Spec: DashboardSpec{
					Elements: map[string]DashboardElement{
						"panel1": {
							PanelKind: &DashboardPanelKind{
								Spec: DashboardPanelSpec{
									VizConfig: DashboardVizConfigKind{
										Spec: DashboardVizConfigSpec{
											FieldConfig: DashboardFieldConfigSource{
												Defaults: DashboardFieldConfig{
													Actions: nil,
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
			expected: &Dashboard{
				TypeMeta: metav1.TypeMeta{
					Kind:       "Dashboard",
					APIVersion: "v2beta1",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-dashboard",
				},
				Spec: DashboardSpec{
					Elements: map[string]DashboardElement{
						"panel1": {
							PanelKind: &DashboardPanelKind{
								Spec: DashboardPanelSpec{
									VizConfig: DashboardVizConfigKind{
										Spec: DashboardVizConfigSpec{
											FieldConfig: DashboardFieldConfigSource{
												Defaults: DashboardFieldConfig{
													Actions: nil,
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a deep copy to avoid modifying the original
			dashboardCopy := deepCopyDashboard(tt.dashboard)

			validateAndTrimActionArrays(dashboardCopy)
			assert.Equal(t, tt.expected, dashboardCopy)
		})
	}
}

// Helper function to create a deep copy of a Dashboard for testing
func deepCopyDashboard(original *Dashboard) *Dashboard {
	if original == nil {
		return nil
	}

	result := &Dashboard{
		TypeMeta:   original.TypeMeta,
		ObjectMeta: original.ObjectMeta,
		Spec: DashboardSpec{
			Elements: make(map[string]DashboardElement),
		},
		Status: original.Status,
	}

	for key, element := range original.Spec.Elements {
		elementCopy := element

		if element.PanelKind != nil {
			panelCopy := *element.PanelKind
			elementCopy.PanelKind = &panelCopy

			if element.PanelKind.Spec.VizConfig.Spec.FieldConfig.Defaults.Actions != nil {
				actions := element.PanelKind.Spec.VizConfig.Spec.FieldConfig.Defaults.Actions
				actionsCopy := make([]DashboardAction, len(actions))

				for j, action := range actions {
					actionsCopy[j] = action

					// Deep copy fetch options
					if action.Fetch != nil {
						fetchCopy := *action.Fetch
						if action.Fetch.QueryParams != nil {
							fetchCopy.QueryParams = make([][]string, len(action.Fetch.QueryParams))
							for k, param := range action.Fetch.QueryParams {
								fetchCopy.QueryParams[k] = make([]string, len(param))
								copy(fetchCopy.QueryParams[k], param)
							}
						}
						if action.Fetch.Headers != nil {
							fetchCopy.Headers = make([][]string, len(action.Fetch.Headers))
							for k, header := range action.Fetch.Headers {
								fetchCopy.Headers[k] = make([]string, len(header))
								copy(fetchCopy.Headers[k], header)
							}
						}
						actionsCopy[j].Fetch = &fetchCopy
					}

					// Deep copy infinity options
					if action.Infinity != nil {
						infinityCopy := *action.Infinity
						if action.Infinity.QueryParams != nil {
							infinityCopy.QueryParams = make([][]string, len(action.Infinity.QueryParams))
							for k, param := range action.Infinity.QueryParams {
								infinityCopy.QueryParams[k] = make([]string, len(param))
								copy(infinityCopy.QueryParams[k], param)
							}
						}
						if action.Infinity.Headers != nil {
							infinityCopy.Headers = make([][]string, len(action.Infinity.Headers))
							for k, header := range action.Infinity.Headers {
								infinityCopy.Headers[k] = make([]string, len(header))
								copy(infinityCopy.Headers[k], header)
							}
						}
						actionsCopy[j].Infinity = &infinityCopy
					}
				}

				elementCopy.PanelKind.Spec.VizConfig.Spec.FieldConfig.Defaults.Actions = actionsCopy
			}
		}

		if element.LibraryPanelKind != nil {
			libraryCopy := *element.LibraryPanelKind
			elementCopy.LibraryPanelKind = &libraryCopy
		}

		result.Spec.Elements[key] = elementCopy
	}

	return result
}
