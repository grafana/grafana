package client

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
)

// mockAccessClient is a mock implementation of authlib.AccessClient for testing
type mockAccessClient struct {
	checkFunc      func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error)
	compileFunc    func(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error)
	batchCheckFunc func(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error)
}

func (m *mockAccessClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	if m.checkFunc != nil {
		return m.checkFunc(ctx, id, req, folder)
	}
	return authlib.CheckResponse{}, nil
}

func (m *mockAccessClient) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	if m.compileFunc != nil {
		return m.compileFunc(ctx, id, req)
	}
	return nil, authlib.NoopZookie{}, nil
}

func (m *mockAccessClient) BatchCheck(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	if m.batchCheckFunc != nil {
		return m.batchCheckFunc(ctx, id, req)
	}
	return authlib.BatchCheckResponse{}, nil
}

func newTestAuthInfo() authlib.AuthInfo {
	return authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject:  authlib.NewTypeID(authlib.TypeAccessPolicy, "test-service"),
			Audience: []string{"authzservice"},
		},
		Rest: authn.AccessTokenClaims{Namespace: "org-1"},
	})
}

// getCounterValue safely reads the current value of a prometheus counter
func getCounterValue(counter prometheus.Counter) float64 {
	var metric dto.Metric
	if err := counter.Write(&metric); err != nil {
		return 0
	}
	return metric.GetCounter().GetValue()
}

func TestShadowClient_BatchCheck(t *testing.T) {
	tests := []struct {
		name            string
		rbacResponse    authlib.BatchCheckResponse
		rbacErr         error
		zanzanaResponse authlib.BatchCheckResponse
		zanzanaErr      error
		hasZanzana      bool            // whether zanzana client is present
		expectedResult  map[string]bool // correlationID -> allowed
		expectedErr     string
		// metrics expectations (only checked if > 0)
		expectedSuccessMetric float64
		expectedErrorMetric   float64
	}{
		{
			name: "returns RBAC result when both clients match",
			rbacResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
					"check2": {Allowed: false},
				},
			},
			hasZanzana: true,
			zanzanaResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
					"check2": {Allowed: false},
				},
			},
			expectedResult:        map[string]bool{"check1": true, "check2": false},
			expectedSuccessMetric: 2,
		},
		{
			name: "returns RBAC result when zanzana client is nil",
			rbacResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
				},
			},
			hasZanzana:     false,
			expectedResult: map[string]bool{"check1": true},
		},
		{
			name: "returns RBAC result even when zanzana fails",
			rbacResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
				},
			},
			hasZanzana:     true,
			zanzanaErr:     errors.New("zanzana error"),
			expectedResult: map[string]bool{"check1": true},
		},
		{
			name:        "returns error when RBAC fails",
			rbacErr:     errors.New("rbac error"),
			hasZanzana:  false,
			expectedErr: "rbac error",
		},
		{
			name: "increments error metric when results differ",
			rbacResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
				},
			},
			hasZanzana: true,
			zanzanaResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: false}, // Different from RBAC
				},
			},
			expectedResult:      map[string]bool{"check1": true},
			expectedErrorMetric: 1,
		},
		{
			name: "increments error metric when zanzana missing result",
			rbacResponse: authlib.BatchCheckResponse{
				Results: map[string]authlib.BatchCheckResult{
					"check1": {Allowed: true},
					"check2": {Allowed: false},
				},
			},
			hasZanzana: true,
			zanzanaResponse: authlib.BatchCheckResponse{
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

			rbacClient := &mockAccessClient{
				batchCheckFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
					return tt.rbacResponse, tt.rbacErr
				},
			}

			// Use explicit nil interface to avoid Go's nil interface gotcha
			var zanzanaClient authlib.AccessClient
			if tt.hasZanzana {
				zanzanaClient = &mockAccessClient{
					batchCheckFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
						return tt.zanzanaResponse, tt.zanzanaErr
					},
				}
			}

			client, err := WithShadowClient(rbacClient, zanzanaClient, reg)
			require.NoError(t, err)
			shadowClient := client.(*ShadowClient)

			res, err := client.BatchCheck(context.Background(), newTestAuthInfo(), authlib.BatchCheckRequest{Namespace: "org-1"})

			// Check error expectation
			if tt.expectedErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErr)
				return
			}
			require.NoError(t, err)

			// Check results
			for correlationID, expectedAllowed := range tt.expectedResult {
				assert.Equal(t, expectedAllowed, res.Results[correlationID].Allowed, "unexpected result for %s", correlationID)
			}

			// Check metrics if expected
			if tt.expectedSuccessMetric > 0 || tt.expectedErrorMetric > 0 {
				successCounter, _ := shadowClient.metrics.evaluationStatusTotal.GetMetricWithLabelValues("success")
				errorCounter, _ := shadowClient.metrics.evaluationStatusTotal.GetMetricWithLabelValues("error")

				require.Eventually(t, func() bool {
					successMatch := tt.expectedSuccessMetric == 0 || getCounterValue(successCounter) == tt.expectedSuccessMetric
					errorMatch := tt.expectedErrorMetric == 0 || getCounterValue(errorCounter) == tt.expectedErrorMetric
					return successMatch && errorMatch
				}, time.Second, 10*time.Millisecond, "metrics did not match expected values")
			}
		})
	}
}

func TestShadowClient_Check(t *testing.T) {
	tests := []struct {
		name            string
		rbacAllowed     bool
		rbacErr         error
		hasZanzana      bool
		zanzanaAllowed  bool
		expectedAllowed bool
		expectedErr     string
	}{
		{
			name:            "returns RBAC result when both succeed",
			rbacAllowed:     true,
			hasZanzana:      true,
			zanzanaAllowed:  true,
			expectedAllowed: true,
		},
		{
			name:            "returns RBAC result when zanzana is nil",
			rbacAllowed:     true,
			hasZanzana:      false,
			expectedAllowed: true,
		},
		{
			name:            "returns RBAC denied result",
			rbacAllowed:     false,
			hasZanzana:      true,
			zanzanaAllowed:  false,
			expectedAllowed: false,
		},
		{
			name:        "returns error when RBAC fails",
			rbacErr:     errors.New("rbac error"),
			hasZanzana:  false,
			expectedErr: "rbac error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()

			rbacClient := &mockAccessClient{
				checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
					return authlib.CheckResponse{Allowed: tt.rbacAllowed}, tt.rbacErr
				},
			}

			// Use explicit nil interface to avoid Go's nil interface gotcha
			var zanzanaClient authlib.AccessClient
			if tt.hasZanzana {
				zanzanaClient = &mockAccessClient{
					checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
						return authlib.CheckResponse{Allowed: tt.zanzanaAllowed}, nil
					},
				}
			}

			client, err := WithShadowClient(rbacClient, zanzanaClient, reg)
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
