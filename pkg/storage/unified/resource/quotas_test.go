package resource

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
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
				content := `overrides:
  "123":
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
			errorMsg:    "overrides file path is required",
		},
		{
			name: "error when file does not exist",
			opts: ReloadOptions{
				FilePath: "/nonexistent/path/overrides.yaml",
			},
			setupFile:   func(t *testing.T) string { return "/nonexistent/path/overrides.yaml" },
			expectError: true,
			errorMsg:    "overrides file does not exist",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			logger := log.NewNopLogger()
			reg := prometheus.NewRegistry()
			tcr := tracing.NewNoopTracerService()

			filePath := tt.setupFile(t)
			if filePath != "" && tt.opts.FilePath == "" {
				tt.opts.FilePath = filePath
			}

			service, err := NewOverridesService(ctx, logger, reg, tcr, tt.opts)

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

func TestQuotaService_ConfigReload(t *testing.T) {
	ctx := context.Background()
	logger := log.NewNopLogger()
	reg := prometheus.NewRegistry()
	tcr := tracing.NewNoopTracerService()

	// Create a temporary config file
	tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
	initialConfig := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1500
`
	require.NoError(t, os.WriteFile(tmpFile, []byte(initialConfig), 0644))

	// Create service with a very short reload period
	service, err := NewOverridesService(ctx, logger, reg, tcr, ReloadOptions{
		FilePath:     tmpFile,
		ReloadPeriod: 100 * time.Millisecond, // Very short reload period for testing
	})
	require.NoError(t, err)
	require.NotNil(t, service)

	// Initialize the service
	err = service.init(ctx)
	require.NoError(t, err)
	defer func(service *OverridesService, ctx context.Context) {
		err := service.stop(ctx)
		require.NoError(t, err)
	}(service, ctx)

	// Verify initial config
	nsr := NamespacedResource{
		Namespace: "stacks-123",
		Group:     "grafana.dashboard.app",
		Resource:  "dashboards",
	}
	quota, err := service.GetQuota(ctx, nsr)
	require.NoError(t, err)
	assert.Equal(t, 1500, quota.Limit, "initial quota should be 1500")

	// Update the config file with new values
	updatedConfig := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 2500
  "456":
    quotas:
      grafana.folder.app/folders:
        limit: 3000
`
	require.NoError(t, os.WriteFile(tmpFile, []byte(updatedConfig), 0644))

	// Wait for the config to be reloaded (wait longer than reload period)
	time.Sleep(500 * time.Millisecond)

	// Verify the config was updated for existing tenant
	quota, err = service.GetQuota(ctx, nsr)
	require.NoError(t, err)
	assert.Equal(t, 2500, quota.Limit, "quota should be updated to 2500")

	// Verify new tenant config is also loaded
	nsr2 := NamespacedResource{
		Namespace: "stacks-456",
		Group:     "grafana.folder.app",
		Resource:  "folders",
	}
	quota2, err := service.GetQuota(ctx, nsr2)
	require.NoError(t, err)
	assert.Equal(t, 3000, quota2.Limit, "new tenant quota should be 3000")
}

func TestQuotaService_GetQuota(t *testing.T) {
	tests := []struct {
		name          string
		setupFile     func(t *testing.T) string
		nsr           NamespacedResource
		expectedLimit int
		expectError   bool
		errorMsg      string
		description   string
	}{
		{
			name: "returns custom quota for matching tenant and resource",
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				content := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1500
`
				require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))
				return tmpFile
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
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				content := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1500
`
				require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))
				return tmpFile
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
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				content := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1500
`
				require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))
				return tmpFile
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
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				content := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1500
`
				require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))
				return tmpFile
			},
			nsr: NamespacedResource{
				Namespace: "123",
				Group:     "grafana.dashboard.app",
				Resource:  "dashboards",
			},
			expectedLimit: 1500,
			expectError:   false,
			description:   "should handle namespace without stacks- prefix",
		},
		{
			name: "returns default quota when config is empty",
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				content := ""
				require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))
				return tmpFile
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
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				content := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1500
      grafana.folder.app/folders:
        limit: 2500
`
				require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))
				return tmpFile
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
			name: "returns error when namespace is empty",
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				content := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1500
      grafana.folder.app/folders:
        limit: 2500
`
				require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))
				return tmpFile
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
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				content := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1500
      grafana.folder.app/folders:
        limit: 2500
`
				require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))
				return tmpFile
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
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				content := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1500
      grafana.folder.app/folders:
        limit: 2500
`
				require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))
				return tmpFile
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
			setupFile: func(t *testing.T) string {
				tmpFile := filepath.Join(t.TempDir(), "overrides.yaml")
				content := `overrides:
  "123":
    quotas:
      grafana.dashboard.app/dashboards:
        limit: 1500
      grafana.folder.app/folders:
        limit: 2500
`
				require.NoError(t, os.WriteFile(tmpFile, []byte(content), 0644))
				return tmpFile
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
			ctx := context.Background()
			logger := log.NewNopLogger()
			reg := prometheus.NewRegistry()
			tcr := tracing.NewNoopTracerService()
			opts := ReloadOptions{
				FilePath: tt.setupFile(t),
			}

			service, err := NewOverridesService(ctx, logger, reg, tcr, opts)
			require.NoError(t, err, "failed to create quota service")
			err = service.init(ctx)
			require.NoError(t, err, "failed to initialize quota service")

			quota, err := service.GetQuota(ctx, tt.nsr)

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
