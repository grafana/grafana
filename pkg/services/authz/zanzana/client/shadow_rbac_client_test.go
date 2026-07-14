package client

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"
)

func TestShadowRBACClient_BatchCheck(t *testing.T) {
	tests := []struct {
		name            string
		zanzanaResponse authlib.BatchCheckResponse
		zanzanaErr      error
		rbacResponse    authlib.BatchCheckResponse
		rbacErr         error
		hasRBAC         bool            // whether legacy RBAC client is present
		expectedResult  map[string]bool // correlationID -> allowed
		expectedErr     string
		// metrics expectations (only checked if > 0)
		expectedSuccessMetric float64
		expectedErrorMetric   float64
	}{
		{
			name: "returns zanzana result when both clients match",
			zanzanaResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
					"check2": {Allowed: false},
				},
			},
			hasRBAC: true,
			rbacResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
					"check2": {Allowed: false},
				},
			},
			expectedResult:        map[string]bool{"check1": true, "check2": false},
			expectedSuccessMetric: 2,
		},
		{
			name: "returns zanzana result when rbac client is nil",
			zanzanaResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
				},
			},
			hasRBAC:        false,
			expectedResult: map[string]bool{"check1": true},
		},
		{
			name: "returns zanzana result even when rbac fails",
			zanzanaResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
				},
			},
			hasRBAC:        true,
			rbacErr:        errors.New("rbac error"),
			expectedResult: map[string]bool{"check1": true},
		},
		{
			name:        "returns error when zanzana fails",
			zanzanaErr:  errors.New("zanzana error"),
			hasRBAC:     false,
			expectedErr: "zanzana error",
		},
		{
			name: "increments error metric when results differ",
			zanzanaResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
				},
			},
			hasRBAC: true,
			rbacResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: false}, // differs from zanzana
				},
			},
			expectedResult:      map[string]bool{"check1": true},
			expectedErrorMetric: 1,
		},
		{
			name: "increments error metric when rbac missing result",
			zanzanaResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
					"check2": {Allowed: false},
				},
			},
			hasRBAC: true,
			rbacResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
					// check2 is missing
				},
			},
			expectedResult:        map[string]bool{"check1": true, "check2": false},
			expectedSuccessMetric: 1,
			expectedErrorMetric:   1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()

			zanzanaClient := &mockAccessClient{
				batchCheckFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
					return tt.zanzanaResponse, tt.zanzanaErr
				},
			}

			var rbacClient authlib.AccessClient
			if tt.hasRBAC {
				rbacClient = &mockAccessClient{
					batchCheckFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
						return tt.rbacResponse, tt.rbacErr
					},
				}
			}

			client, err := WithShadowRBACClient(zanzanaClient, rbacClient, reg)
			require.NoError(t, err)
			shadowClient := client.(*ShadowRBACClient)

			res, err := client.BatchCheck(context.Background(), newTestAuthInfo(), authlib.BatchCheckRequest{Namespace: "org-1"})

			if tt.expectedErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				return
			}
			require.NoError(t, err)

			for correlationID, expectedAllowed := range tt.expectedResult {
				assert.Equal(t, expectedAllowed, res.Results[correlationID].Allowed, "unexpected result for %s", correlationID)
			}

			if tt.expectedSuccessMetric > 0 || tt.expectedErrorMetric > 0 {
				statusMetric, err := shadowClient.metrics.evaluationStatusTotal.CurryWith(prometheus.Labels{
					"method":            "batch_check",
					"resource":          "other",
					"request_namespace": "org-1",
				})
				require.NoError(t, err)
				successCounter, err := statusMetric.GetMetricWithLabelValues("success")
				require.NoError(t, err)
				errorCounter, err := statusMetric.GetMetricWithLabelValues("error")
				require.NoError(t, err)

				require.Eventually(t, func() bool {
					successMatch := tt.expectedSuccessMetric == 0 || getCounterValue(successCounter) == tt.expectedSuccessMetric
					errorMatch := tt.expectedErrorMetric == 0 || getCounterValue(errorCounter) == tt.expectedErrorMetric
					return successMatch && errorMatch
				}, time.Second, 10*time.Millisecond, "metrics did not match expected values")
			}
		})
	}
}

func TestShadowRBACClient_Check(t *testing.T) {
	tests := []struct {
		name            string
		zanzanaAllowed  bool
		zanzanaErr      error
		hasRBAC         bool
		rbacAllowed     bool
		expectedAllowed bool
		expectedErr     string
	}{
		{
			name:            "returns zanzana result when both succeed",
			zanzanaAllowed:  true,
			hasRBAC:         true,
			rbacAllowed:     true,
			expectedAllowed: true,
		},
		{
			name:            "returns zanzana result when rbac client is nil",
			zanzanaAllowed:  true,
			hasRBAC:         false,
			expectedAllowed: true,
		},
		{
			name:            "returns zanzana denied result",
			zanzanaAllowed:  false,
			hasRBAC:         true,
			rbacAllowed:     false,
			expectedAllowed: false,
		},
		{
			name:        "returns error when zanzana fails",
			zanzanaErr:  errors.New("zanzana error"),
			hasRBAC:     false,
			expectedErr: "zanzana error",
		},
		{
			name:            "returns zanzana result even when rbac fails",
			zanzanaAllowed:  true,
			hasRBAC:         true,
			expectedAllowed: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()

			zanzanaClient := &mockAccessClient{
				checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
					return authlib.CheckResponse{Allowed: tt.zanzanaAllowed}, tt.zanzanaErr
				},
			}

			var rbacClient authlib.AccessClient
			if tt.hasRBAC {
				rbacClient = &mockAccessClient{
					checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
						return authlib.CheckResponse{Allowed: tt.rbacAllowed}, nil
					},
				}
			}

			client, err := WithShadowRBACClient(zanzanaClient, rbacClient, reg)
			require.NoError(t, err)

			req := authlib.CheckRequest{
				Namespace: "org-1",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			}

			res, err := client.Check(context.Background(), newTestAuthInfo(), req, "folder1")

			if tt.expectedErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectedAllowed, res.Allowed)
		})
	}
}

func TestShadowRBACClient_Check_MetricsOnMismatch(t *testing.T) {
	reg := prometheus.NewRegistry()

	zanzanaClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{Allowed: true}, nil
		},
	}
	rbacClient := &mockAccessClient{
		checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{Allowed: false}, nil // differs from zanzana
		},
	}

	client, err := WithShadowRBACClient(zanzanaClient, rbacClient, reg)
	require.NoError(t, err)
	shadowClient := client.(*ShadowRBACClient)

	res, err := client.Check(context.Background(), newTestAuthInfo(), authlib.CheckRequest{Namespace: "org-1"}, "")
	require.NoError(t, err)
	assert.True(t, res.Allowed, "should return zanzana result")

	statusMetric, err := shadowClient.metrics.evaluationStatusTotal.CurryWith(prometheus.Labels{
		"method":            "check",
		"resource":          "other",
		"request_namespace": "org-1",
	})
	require.NoError(t, err)
	errorCounter, err := statusMetric.GetMetricWithLabelValues("error")
	require.NoError(t, err)

	require.Eventually(t, func() bool {
		return getCounterValue(errorCounter) == 1
	}, time.Second, 10*time.Millisecond, "error metric should be incremented on mismatch")
}
