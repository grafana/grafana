package client

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

type testSetup struct {
	handler            *K8sClientWithFallback
	mockClientV1Alpha1 *client.MockK8sHandler
	mockClientV2Alpha1 *client.MockK8sHandler
	mockMetrics        *k8sClientMetrics
	mockFactoryCalls   map[string]int
	t                  *testing.T
}

func setupTest(t *testing.T) *testSetup {
	mockClientV1Alpha1 := &client.MockK8sHandler{}
	mockClientV2Alpha1 := &client.MockK8sHandler{}
	mockMetrics := newK8sClientMetrics(prometheus.NewRegistry())
	mockFactoryCalls := make(map[string]int)

	handler := &K8sClientWithFallback{
		K8sHandler: mockClientV1Alpha1,
		newClientFunc: func(ctx context.Context, version string) client.K8sHandler {
			mockFactoryCalls[version]++
			if version == "v2alpha1" {
				return mockClientV2Alpha1
			}
			if version == dashboardv1.VERSION {
				return mockClientV1Alpha1
			}
			t.Fatalf("Unexpected call to newClientFunc with version %s", version)
			return nil
		},
		log:     log.New("test"),
		metrics: mockMetrics,
	}

	return &testSetup{
		handler:            handler,
		mockClientV1Alpha1: mockClientV1Alpha1,
		mockClientV2Alpha1: mockClientV2Alpha1,
		mockMetrics:        mockMetrics,
		mockFactoryCalls:   mockFactoryCalls,
		t:                  t,
	}
}

func TestK8sHandlerWithFallback_Get(t *testing.T) {
	t.Run("Get without fallback", func(t *testing.T) {
		setup := setupTest(t)

		ctx := context.Background()
		name := "test-dashboard"
		orgID := int64(1)
		options := metav1.GetOptions{}

		expectedResult := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": name,
				},
				"status": map[string]interface{}{
					"someOtherStatus": "ok",
				},
			},
		}

		setup.mockClientV1Alpha1.On("Get", mock.Anything, name, orgID, options, mock.Anything).Return(expectedResult, nil).Once()

		result, err := setup.handler.Get(ctx, name, orgID, options)
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
		require.Equal(t, 0, len(setup.mockFactoryCalls), "Factory should not be called for non-fallback case")

		setup.mockClientV1Alpha1.AssertExpectations(t)
		setup.mockClientV2Alpha1.AssertExpectations(t)
	})

	t.Run("Get with fallback due to conversion error", func(t *testing.T) {
		setup := setupTest(t)

		ctx := context.Background()
		name := "test-dashboard-fallback"
		orgID := int64(2)
		options := metav1.GetOptions{ResourceVersion: "123"}
		storedVersion := "v2alpha1"
		conversionErr := "failed to convert"

		v1alpha1Result := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": name,
				},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{
						"failed":        true,
						"storedVersion": storedVersion,
						"error":         conversionErr,
					},
				},
			},
		}

		expectedResultFallback := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "dashboard/v2alpha1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name": name,
				},
			},
		}

		setup.mockClientV1Alpha1.On("Get", mock.Anything, name, orgID, options, mock.Anything).Return(v1alpha1Result, nil).Once()
		setup.mockClientV2Alpha1.On("Get", mock.Anything, name, orgID, options, mock.Anything).Return(expectedResultFallback, nil).Once()

		result, err := setup.handler.Get(ctx, name, orgID, options)
		require.NoError(t, err)
		require.Equal(t, expectedResultFallback, result)
		require.Equal(t, 1, setup.mockFactoryCalls["v2alpha1"], "Factory should be called once with v2alpha1")

		setup.mockClientV1Alpha1.AssertExpectations(t)
		setup.mockClientV2Alpha1.AssertExpectations(t)
	})

	t.Run("Get initial error", func(t *testing.T) {
		setup := setupTest(t)

		ctx := context.Background()
		name := "test-dashboard-error"
		orgID := int64(3)
		options := metav1.GetOptions{}
		expectedErr := errors.New("initial get failed")

		setup.mockClientV1Alpha1.On("Get", mock.Anything, name, orgID, options, mock.Anything).Return(nil, expectedErr).Once()

		_, err := setup.handler.Get(ctx, name, orgID, options)
		require.Error(t, err)
		require.Equal(t, expectedErr, err)
		require.Equal(t, 0, len(setup.mockFactoryCalls), "Factory should not be called for error case")

		setup.mockClientV1Alpha1.AssertExpectations(t)
		setup.mockClientV2Alpha1.AssertExpectations(t)
	})

	t.Run("Get with fallback fails", func(t *testing.T) {
		setup := setupTest(t)

		ctx := context.Background()
		name := "test-dashboard-fallback-error"
		orgID := int64(4)
		options := metav1.GetOptions{}
		storedVersion := "v2alpha1"
		conversionErr := "failed to convert again"
		fallbackErr := errors.New("fallback get failed")

		v1alpha1Result := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": name,
				},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{
						"failed":        true,
						"storedVersion": storedVersion,
						"error":         conversionErr,
					},
				},
			},
		}

		setup.mockClientV1Alpha1.On("Get", mock.Anything, name, orgID, options, mock.Anything).Return(v1alpha1Result, nil).Once()
		setup.mockClientV2Alpha1.On("Get", mock.Anything, name, orgID, options, mock.Anything).Return(nil, fallbackErr).Once()

		_, err := setup.handler.Get(ctx, name, orgID, options)
		require.Error(t, err)
		require.Equal(t, fallbackErr, err)
		require.Equal(t, 1, setup.mockFactoryCalls["v2alpha1"], "Factory should be called once with v2alpha1")

		setup.mockClientV1Alpha1.AssertExpectations(t)
		setup.mockClientV2Alpha1.AssertExpectations(t)
	})
}

func TestK8sHandlerWithFallback_List(t *testing.T) {
	// Helper function to create a dashboard item
	createDashboard := func(name, resourceVersion string, status map[string]interface{}) unstructured.Unstructured {
		return unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name":            name,
					"resourceVersion": resourceVersion,
				},
				"status": status,
			},
		}
	}

	// Helper function to create a fallback dashboard item
	createFallbackDashboard := func(name, resourceVersion, apiVersion string) unstructured.Unstructured {
		return unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": apiVersion,
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name":            name,
					"resourceVersion": resourceVersion,
				},
			},
		}
	}

	// Helper function to create conversion status
	conversionStatus := func(failed bool, storedVersion, errorMsg string) map[string]interface{} {
		return map[string]interface{}{
			"conversion": map[string]interface{}{
				"failed":        failed,
				"storedVersion": storedVersion,
				"error":         errorMsg,
			},
		}
	}

	t.Run("List without fallback needed", func(t *testing.T) {
		setup := setupTest(t)
		expectedResult := &unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{
				createDashboard("dashboard-1", "123", map[string]interface{}{"someOtherStatus": "ok"}),
				createDashboard("dashboard-2", "456", map[string]interface{}{"anotherStatus": "ok"}),
			},
		}

		setup.mockClientV1Alpha1.On("List", mock.Anything, int64(1), metav1.ListOptions{}).Return(expectedResult, nil).Once()

		result, err := setup.handler.List(context.Background(), 1, metav1.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, expectedResult, result)

		setup.mockClientV1Alpha1.AssertExpectations(t)
		setup.mockClientV2Alpha1.AssertExpectations(t)
	})

	t.Run("List with some items needing fallback", func(t *testing.T) {
		setup := setupTest(t)
		initialResult := &unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{
				createDashboard("dashboard-ok", "123", map[string]interface{}{"someOtherStatus": "ok"}),
				createDashboard("dashboard-fallback", "456", conversionStatus(true, "v2alpha1", "conversion failed")),
			},
		}

		fallbackResult := createFallbackDashboard("dashboard-fallback", "456", "dashboard/v2alpha1")

		setup.mockClientV1Alpha1.On("List", mock.Anything, int64(2), metav1.ListOptions{}).Return(initialResult, nil).Once()
		setup.mockClientV2Alpha1.On("Get", mock.Anything, "dashboard-fallback", int64(2), metav1.GetOptions{ResourceVersion: "456"}, mock.Anything).Return(&fallbackResult, nil).Once()

		result, err := setup.handler.List(context.Background(), 2, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, result.Items, 2)

		expectedItems := []unstructured.Unstructured{
			createDashboard("dashboard-ok", "123", map[string]interface{}{"someOtherStatus": "ok"}),
			fallbackResult,
		}
		require.ElementsMatch(t, expectedItems, result.Items)

		setup.mockClientV1Alpha1.AssertExpectations(t)
		setup.mockClientV2Alpha1.AssertExpectations(t)
	})

	t.Run("List with all items needing fallback", func(t *testing.T) {
		setup := setupTest(t)
		initialResult := &unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{
				createDashboard("dashboard-1-fallback", "111", conversionStatus(true, "v2alpha1", "conversion failed 1")),
				createDashboard("dashboard-2-fallback", "222", conversionStatus(true, "v2alpha1", "conversion failed 2")),
			},
		}

		fallbackResult1 := createFallbackDashboard("dashboard-1-fallback", "111", "dashboard/v2alpha1")
		fallbackResult2 := createFallbackDashboard("dashboard-2-fallback", "222", "dashboard/v2alpha1")

		setup.mockClientV1Alpha1.On("List", mock.Anything, int64(3), metav1.ListOptions{}).Return(initialResult, nil).Once()
		setup.mockClientV2Alpha1.On("Get", mock.Anything, "dashboard-1-fallback", int64(3), metav1.GetOptions{ResourceVersion: "111"}, mock.Anything).Return(&fallbackResult1, nil).Once()
		setup.mockClientV2Alpha1.On("Get", mock.Anything, "dashboard-2-fallback", int64(3), metav1.GetOptions{ResourceVersion: "222"}, mock.Anything).Return(&fallbackResult2, nil).Once()

		result, err := setup.handler.List(context.Background(), 3, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, result.Items, 2)

		expectedItems := []unstructured.Unstructured{fallbackResult1, fallbackResult2}
		require.ElementsMatch(t, expectedItems, result.Items)

		setup.mockClientV1Alpha1.AssertExpectations(t)
		setup.mockClientV2Alpha1.AssertExpectations(t)
	})

	t.Run("List with different versions needing fallback", func(t *testing.T) {
		setup := setupTest(t)
		initialResult := &unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{
				createDashboard("dashboard-v2alpha1", "333", conversionStatus(true, "v2alpha1", "conversion failed v2alpha1")),
				createDashboard("dashboard-v1beta1", "444", conversionStatus(true, "v1beta1", "conversion failed v1beta1")),
			},
		}

		fallbackResultV2Alpha1 := createFallbackDashboard("dashboard-v2alpha1", "333", "dashboard/v2alpha1")
		fallbackResultV1Beta1 := createFallbackDashboard("dashboard-v1beta1", "444", "dashboard/v1beta1")

		setup.mockClientV1Alpha1.On("List", mock.Anything, int64(4), metav1.ListOptions{}).Return(initialResult, nil).Once()
		setup.mockClientV2Alpha1.On("Get", mock.Anything, "dashboard-v2alpha1", int64(4), metav1.GetOptions{ResourceVersion: "333"}, mock.Anything).Return(&fallbackResultV2Alpha1, nil).Once()
		setup.mockClientV1Alpha1.On("Get", mock.Anything, "dashboard-v1beta1", int64(4), metav1.GetOptions{ResourceVersion: "444"}, mock.Anything).Return(&fallbackResultV1Beta1, nil).Once()

		result, err := setup.handler.List(context.Background(), 4, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, result.Items, 2)

		expectedItems := []unstructured.Unstructured{fallbackResultV2Alpha1, fallbackResultV1Beta1}
		require.ElementsMatch(t, expectedItems, result.Items)

		setup.mockClientV1Alpha1.AssertExpectations(t)
		setup.mockClientV2Alpha1.AssertExpectations(t)
	})

	t.Run("List with initial fetch error", func(t *testing.T) {
		setup := setupTest(t)
		expectedErr := errors.New("initial list failed")

		setup.mockClientV1Alpha1.On("List", mock.Anything, int64(5), metav1.ListOptions{}).Return(nil, expectedErr).Once()

		_, err := setup.handler.List(context.Background(), 5, metav1.ListOptions{})
		require.Error(t, err)
		require.Equal(t, expectedErr, err)

		setup.mockClientV1Alpha1.AssertExpectations(t)
		setup.mockClientV2Alpha1.AssertExpectations(t)
	})

	t.Run("List with fallback fetch error", func(t *testing.T) {
		setup := setupTest(t)
		initialResult := &unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{
				createDashboard("dashboard-fallback-error", "555", conversionStatus(true, "v2alpha1", "conversion failed")),
			},
		}

		fallbackErr := errors.New("fallback get failed")

		setup.mockClientV1Alpha1.On("List", mock.Anything, int64(6), metav1.ListOptions{}).Return(initialResult, nil).Once()
		setup.mockClientV2Alpha1.On("Get", mock.Anything, "dashboard-fallback-error", int64(6), metav1.GetOptions{ResourceVersion: "555"}, mock.Anything).Return(nil, fallbackErr).Once()

		_, err := setup.handler.List(context.Background(), 6, metav1.ListOptions{})
		require.Error(t, err)
		require.Equal(t, fallbackErr, err)

		setup.mockClientV1Alpha1.AssertExpectations(t)
		setup.mockClientV2Alpha1.AssertExpectations(t)
	})

	t.Run("List with empty result", func(t *testing.T) {
		setup := setupTest(t)
		emptyResult := &unstructured.UnstructuredList{Items: []unstructured.Unstructured{}}

		setup.mockClientV1Alpha1.On("List", mock.Anything, int64(7), metav1.ListOptions{}).Return(emptyResult, nil).Once()

		result, err := setup.handler.List(context.Background(), 7, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, result.Items, 0)

		setup.mockClientV1Alpha1.AssertExpectations(t)
		setup.mockClientV2Alpha1.AssertExpectations(t)
	})
}

func TestGetConversionStatus(t *testing.T) {
	tests := []struct {
		name                  string
		obj                   *unstructured.Unstructured
		expectedFailed        bool
		expectedStoredVersion string
		expectedError         string
	}{
		{
			name: "No status field",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
			}},
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
		{
			name: "Status field, but no conversion field",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status":   map[string]interface{}{"someOtherStatus": "ok"},
			}},
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
		{
			name: "Conversion field, failed=true, with storedVersion and error",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{
						"failed":        true,
						"storedVersion": "v2alpha1",
						"error":         "conversion failed",
					},
				},
			}},
			expectedFailed:        true,
			expectedStoredVersion: "v2alpha1",
			expectedError:         "conversion failed",
		},
		{
			name: "Conversion field, failed=false",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{
						"failed":        false,
						"storedVersion": "v1alpha1",
						"error":         "",
					},
				},
			}},
			expectedFailed:        false,
			expectedStoredVersion: "v1alpha1",
			expectedError:         "",
		},
		{
			name: "Conversion field, missing failed (defaults to false)",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{

						"storedVersion": "v1alpha1",
						"error":         "",
					},
				},
			}},
			expectedFailed:        false,
			expectedStoredVersion: "v1alpha1",
			expectedError:         "",
		},
		{
			name: "Conversion field, failed=true, missing storedVersion",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{
						"failed": true,

						"error": "conversion failed",
					},
				},
			}},
			expectedFailed:        true,
			expectedStoredVersion: "",
			expectedError:         "conversion failed",
		},
		{
			name: "Conversion field, failed=true, missing error",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": map[string]interface{}{
						"failed":        true,
						"storedVersion": "v2alpha1",
					},
				},
			}},
			expectedFailed:        true,
			expectedStoredVersion: "v2alpha1",
			expectedError:         "",
		},
		{
			name:                  "Empty object",
			obj:                   &unstructured.Unstructured{Object: map[string]interface{}{}},
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
		{
			name:                  "Nil object",
			obj:                   nil,
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
		{
			name: "Status not a map",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status":   "not a map",
			}},
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
		{
			name: "Conversion not a map",
			obj: &unstructured.Unstructured{Object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "test"},
				"status": map[string]interface{}{
					"conversion": "not a map",
				},
			}},
			expectedFailed:        false,
			expectedStoredVersion: "",
			expectedError:         "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var input *unstructured.Unstructured
			if tt.obj != nil {
				input = tt.obj.DeepCopy()
			} else {
				input = &unstructured.Unstructured{Object: map[string]interface{}{}}
			}

			failed, storedVersion, conversionErr := getConversionStatus(input)
			require.Equal(t, tt.expectedFailed, failed, "failed mismatch")
			require.Equal(t, tt.expectedStoredVersion, storedVersion, "storedVersion mismatch")
			require.Equal(t, tt.expectedError, conversionErr, "conversionErr mismatch")
		})
	}
}
