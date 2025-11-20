package resource

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewQuotaService(t *testing.T) {
	tests := []struct {
		name        string
		opts        ReloadOptions
		setupFile   func(t *testing.T) string
		expectError bool
		errorMsg    string
	}{
		{
			name: "success with valid file",
			opts: ReloadOptions{},
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				content := `"123":
  quotas:
    grafana.dashboard.app/dashboards:
      limit: 1500
`
				require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))
				return tmpFile
			},
			expectError: false,
		},
		{
			name: "success with custom reload period",
			opts: ReloadOptions{
				ReloadPeriod: time.Minute,
			},
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				require.NoError(t, os.WriteFile(tmpFile, []byte{}, 0644))
				return tmpFile
			},
			expectError: false,
		},
		{
			name: "error when file path is empty",
			opts: ReloadOptions{
				FilePath: "",
			},
			setupFile:   func(t *testing.T) string { return "" },
			expectError: true,
			errorMsg:    "quota overrides file path is required",
		},
		{
			name: "error when file does not exist",
			opts: ReloadOptions{
				FilePath: "/nonexistent/path/overrides.yaml",
			},
			setupFile:   func(t *testing.T) string { return "/nonexistent/path/overrides.yaml" },
			expectError: true,
			errorMsg:    "quota overrides file does not exist",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			logger := log.NewNopLogger()
			reg := prometheus.NewRegistry()

			filePath := tt.setupFile(t)
			if filePath != "" && tt.opts.FilePath == "" {
				tt.opts.FilePath = filePath
			}

			service, err := NewQuotaService(ctx, logger, reg, tt.opts)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, service)
			} else {
				require.NoError(t, err)
				assert.NotNil(t, service)
				assert.NotNil(t, service.manager)
				assert.NotNil(t, service.logger)
			}
		})
	}
}

func TestQuotaService_GetQuota(t *testing.T) {
	tests := []struct {
		name          string
		config        *QuotaOverrides
		nsr           NamespacedResource
		expectedLimit int
		expectError   bool
		errorMsg      string
		description   string
	}{
		{
			name: "returns custom quota for matching tenant and resource",
			config: &QuotaOverrides{
				Tenants: map[string]TenantQuotas{
					"123": {
						Quotas: map[string]ResourceQuota{
							"grafana.dashboard.app/dashboards": {Limit: 1500},
						},
					},
				},
			},
			nsr: NamespacedResource{
				Namespace: "stacks-123",
				Group:     "grafana.dashboard.app",
				Resource:  "dashboards",
			},
			expectedLimit: 1500,
			expectError:   false,
			description:   "should return custom limit for matching tenant",
		},
		{
			name: "returns default quota when tenant not found",
			config: &QuotaOverrides{
				Tenants: map[string]TenantQuotas{
					"123": {
						Quotas: map[string]ResourceQuota{
							"grafana.dashboard.app/dashboards": {Limit: 1500},
						},
					},
				},
			},
			nsr: NamespacedResource{
				Namespace: "stacks-456",
				Group:     "grafana.dashboard.app",
				Resource:  "dashboards",
			},
			expectedLimit: DEFAULT_RESOURCE_LIMIT,
			expectError:   false,
			description:   "should return default limit when tenant not found",
		},
		{
			name: "returns default quota when resource not found",
			config: &QuotaOverrides{
				Tenants: map[string]TenantQuotas{
					"123": {
						Quotas: map[string]ResourceQuota{
							"grafana.dashboard.app/dashboards": {Limit: 1500},
						},
					},
				},
			},
			nsr: NamespacedResource{
				Namespace: "stacks-123",
				Group:     "grafana.folder.app",
				Resource:  "folders",
			},
			expectedLimit: DEFAULT_RESOURCE_LIMIT,
			expectError:   false,
			description:   "should return default limit when resource not found",
		},
		{
			name: "handles namespace without stacks- prefix",
			config: &QuotaOverrides{
				Tenants: map[string]TenantQuotas{
					"123": {
						Quotas: map[string]ResourceQuota{
							"grafana.dashboard.app/dashboards": {Limit: 2000},
						},
					},
				},
			},
			nsr: NamespacedResource{
				Namespace: "123",
				Group:     "grafana.dashboard.app",
				Resource:  "dashboards",
			},
			expectedLimit: 2000,
			expectError:   false,
			description:   "should handle namespace without stacks- prefix",
		},
		{
			name: "returns default quota when config is empty",
			config: &QuotaOverrides{
				Tenants: map[string]TenantQuotas{},
			},
			nsr: NamespacedResource{
				Namespace: "stacks-123",
				Group:     "grafana.dashboard.app",
				Resource:  "dashboards",
			},
			expectedLimit: DEFAULT_RESOURCE_LIMIT,
			expectError:   false,
			description:   "should return default limit when config is empty",
		},
		{
			name: "handles multiple resources for same tenant",
			config: &QuotaOverrides{
				Tenants: map[string]TenantQuotas{
					"123": {
						Quotas: map[string]ResourceQuota{
							"grafana.dashboard.app/dashboards": {Limit: 1500},
							"grafana.folder.app/folders":       {Limit: 2500},
						},
					},
				},
			},
			nsr: NamespacedResource{
				Namespace: "stacks-123",
				Group:     "grafana.folder.app",
				Resource:  "folders",
			},
			expectedLimit: 2500,
			expectError:   false,
			description:   "should return correct limit for specific resource",
		},
		{
			name:   "handles nil config",
			config: nil,
			nsr: NamespacedResource{
				Namespace: "stacks-123",
				Group:     "grafana.dashboard.app",
				Resource:  "dashboards",
			},
			expectedLimit: DEFAULT_RESOURCE_LIMIT,
			expectError:   false,
			description:   "should return default limit when config is nil",
		},
		{
			name: "returns error when namespace is empty",
			config: &QuotaOverrides{
				Tenants: map[string]TenantQuotas{},
			},
			nsr: NamespacedResource{
				Namespace: "",
				Group:     "grafana.dashboard.app",
				Resource:  "dashboards",
			},
			expectError: true,
			errorMsg:    "invalid namespaced resource",
			description: "should return error when namespace is empty",
		},
		{
			name: "returns error when group is empty",
			config: &QuotaOverrides{
				Tenants: map[string]TenantQuotas{},
			},
			nsr: NamespacedResource{
				Namespace: "stacks-123",
				Group:     "",
				Resource:  "dashboards",
			},
			expectError: true,
			errorMsg:    "invalid namespaced resource",
			description: "should return error when group is empty",
		},
		{
			name: "returns error when resource is empty",
			config: &QuotaOverrides{
				Tenants: map[string]TenantQuotas{},
			},
			nsr: NamespacedResource{
				Namespace: "stacks-123",
				Group:     "grafana.dashboard.app",
				Resource:  "",
			},
			expectError: true,
			errorMsg:    "invalid namespaced resource",
			description: "should return error when resource is empty",
		},
		{
			name: "returns error when all fields are empty",
			config: &QuotaOverrides{
				Tenants: map[string]TenantQuotas{},
			},
			nsr: NamespacedResource{
				Namespace: "",
				Group:     "",
				Resource:  "",
			},
			expectError: true,
			errorMsg:    "invalid namespaced resource",
			description: "should return error when all fields are empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := &QuotaService{
				quotaOverrides: tt.config,
				logger:         log.NewNopLogger(),
			}

			quota, err := service.GetQuota(tt.nsr)

			if tt.expectError {
				require.Error(t, err, tt.description)
				assert.Contains(t, err.Error(), tt.errorMsg, tt.description)
				assert.Equal(t, ResourceQuota{}, quota, "should return empty quota on error")
			} else {
				require.NoError(t, err, tt.description)
				assert.Equal(t, tt.expectedLimit, quota.Limit, tt.description)
			}
		})
	}
}
