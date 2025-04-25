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
