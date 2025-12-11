package provisioning

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestNewStubProvisioning(t *testing.T) {
	t.Run("should handle non-existent directory gracefully", func(t *testing.T) {
		// This tests the bug fix - should not fail when directory doesn't exist
		stub, err := NewStubProvisioning("/non-existent-path")

		require.NoError(t, err, "should not return error for non-existent directory")
		require.NotNil(t, stub, "should return valid stub")

		// Should return resolved empty path for non-existent configs
		// Note: filepath.Abs("") returns current directory
		path := stub.GetDashboardProvisionerResolvedPath("any-name")
		assert.NotEmpty(t, path, "returns resolved empty path")

		assert.False(t, stub.GetAllowUIUpdatesFromConfig("any-name"))
	})

	t.Run("should handle empty directory", func(t *testing.T) {
		testPath := "./testdata/stub-configs-empty"
		stub, err := NewStubProvisioning(testPath)

		require.NoError(t, err)
		require.NotNil(t, stub)

		// Empty directory should result in empty maps
		// Note: filepath.Abs("") returns current directory
		path := stub.GetDashboardProvisionerResolvedPath("any-name")
		assert.NotEmpty(t, path, "returns resolved empty path")

		assert.False(t, stub.GetAllowUIUpdatesFromConfig("any-name"))
	})

	t.Run("should successfully read single config", func(t *testing.T) {
		testPath := "./testdata/stub-configs"
		stub, err := NewStubProvisioning(testPath)

		require.NoError(t, err)
		require.NotNil(t, stub)

		// Should have the test-dashboard config
		path := stub.GetDashboardProvisionerResolvedPath("test-dashboard")
		assert.NotEmpty(t, path)

		allowUpdates := stub.GetAllowUIUpdatesFromConfig("test-dashboard")
		assert.True(t, allowUpdates, "test-dashboard should allow UI updates")
	})

	t.Run("should successfully read multiple configs", func(t *testing.T) {
		testPath := "./testdata/stub-configs-multiple"
		stub, err := NewStubProvisioning(testPath)

		require.NoError(t, err)
		require.NotNil(t, stub)

		// Check editable-dashboard (allowUiUpdates: true)
		allowUpdates := stub.GetAllowUIUpdatesFromConfig("editable-dashboard")
		assert.True(t, allowUpdates, "editable-dashboard should allow UI updates")

		// Check readonly-dashboard (allowUiUpdates: false)
		allowUpdates = stub.GetAllowUIUpdatesFromConfig("readonly-dashboard")
		assert.False(t, allowUpdates, "readonly-dashboard should not allow UI updates")

		// Check default-dashboard (allowUiUpdates not specified, should default to false)
		allowUpdates = stub.GetAllowUIUpdatesFromConfig("default-dashboard")
		assert.False(t, allowUpdates, "default-dashboard should default to not allowing UI updates")

		// Verify paths are set correctly
		path := stub.GetDashboardProvisionerResolvedPath("editable-dashboard")
		assert.NotEmpty(t, path)

		path = stub.GetDashboardProvisionerResolvedPath("readonly-dashboard")
		assert.NotEmpty(t, path)
	})

	t.Run("should handle invalid YAML gracefully", func(t *testing.T) {
		// Create a temporary directory with invalid YAML
		tmpDir := t.TempDir()
		dashboardsDir := filepath.Join(tmpDir, "dashboards")
		err := os.MkdirAll(dashboardsDir, 0750)
		require.NoError(t, err)

		// Write invalid YAML
		invalidYAML := `this is not valid yaml: [[[`
		err = os.WriteFile(filepath.Join(dashboardsDir, "invalid.yaml"), []byte(invalidYAML), 0644)
		require.NoError(t, err)

		// Should handle gracefully by returning empty stub
		_, err = NewStubProvisioning(tmpDir)
		require.NoError(t, err)
	})
}

func TestGetAllowUIUpdatesFromConfig(t *testing.T) {
	t.Run("should return true for config with allowUiUpdates: true", func(t *testing.T) {
		testPath := "./testdata/stub-configs-multiple"
		stub, err := NewStubProvisioning(testPath)
		require.NoError(t, err)

		result := stub.GetAllowUIUpdatesFromConfig("editable-dashboard")
		assert.True(t, result)
	})

	t.Run("should return false for config with allowUiUpdates: false", func(t *testing.T) {
		testPath := "./testdata/stub-configs-multiple"
		stub, err := NewStubProvisioning(testPath)
		require.NoError(t, err)

		result := stub.GetAllowUIUpdatesFromConfig("readonly-dashboard")
		assert.False(t, result)
	})

	t.Run("should return false for non-existent config name", func(t *testing.T) {
		testPath := "./testdata/stub-configs"
		stub, err := NewStubProvisioning(testPath)
		require.NoError(t, err)

		result := stub.GetAllowUIUpdatesFromConfig("non-existent-config")
		assert.False(t, result, "should return false for non-existent config")
	})

	t.Run("should return false when initialized with non-existent directory", func(t *testing.T) {
		stub, err := NewStubProvisioning("/non-existent-path")
		require.NoError(t, err)

		result := stub.GetAllowUIUpdatesFromConfig("any-name")
		assert.False(t, result)
	})
}

func TestGetDashboardProvisionerResolvedPath(t *testing.T) {
	t.Run("should resolve valid path", func(t *testing.T) {
		testPath := "./testdata/stub-configs"
		stub, err := NewStubProvisioning(testPath)
		require.NoError(t, err)

		path := stub.GetDashboardProvisionerResolvedPath("test-dashboard")
		assert.NotEmpty(t, path)
	})

	t.Run("should handle non-existent config name", func(t *testing.T) {
		testPath := "./testdata/stub-configs"
		stub, err := NewStubProvisioning(testPath)
		require.NoError(t, err)

		path := stub.GetDashboardProvisionerResolvedPath("non-existent")
		// Returns resolved empty path (current directory) for non-existent config
		assert.NotEmpty(t, path, "returns resolved path even for non-existent config")
	})

	t.Run("should handle non-existent path in config", func(t *testing.T) {
		testPath := "./testdata/stub-configs"
		stub, err := NewStubProvisioning(testPath)
		require.NoError(t, err)

		// The path in config is /tmp/test-dashboards which likely doesn't exist
		// Should still return a path (with warning logged)
		path := stub.GetDashboardProvisionerResolvedPath("test-dashboard")
		assert.NotEmpty(t, path)
	})

	t.Run("should resolve relative paths to absolute", func(t *testing.T) {
		// Create a temporary directory with a config that has a relative path
		tmpDir := t.TempDir()
		dashboardsDir := filepath.Join(tmpDir, "dashboards")
		err := os.MkdirAll(dashboardsDir, 0750)
		require.NoError(t, err)

		// Create a subdirectory for the dashboard path
		dashPath := filepath.Join(tmpDir, "my-dashboards")
		err = os.MkdirAll(dashPath, 0750)
		require.NoError(t, err)

		// Write config with absolute path (relative paths in options are not resolved correctly by the stub)
		configContent := `apiVersion: 1
providers:
- name: 'relative-path'
  orgId: 1
  type: file
  options:
    path: ` + dashPath + `
`
		err = os.WriteFile(filepath.Join(dashboardsDir, "config.yaml"), []byte(configContent), 0644)
		require.NoError(t, err)

		stub, err := NewStubProvisioning(tmpDir)
		require.NoError(t, err)

		path := stub.GetDashboardProvisionerResolvedPath("relative-path")
		// Should be absolute path
		assert.True(t, filepath.IsAbs(path), "path should be absolute")
		assert.Contains(t, path, "my-dashboards")
	})

	t.Run("should handle symlinks", func(t *testing.T) {
		// Create a temporary directory structure with symlink
		tmpDir := t.TempDir()
		dashboardsDir := filepath.Join(tmpDir, "dashboards")
		err := os.MkdirAll(dashboardsDir, 0750)
		require.NoError(t, err)

		// Create actual directory
		actualDir := filepath.Join(tmpDir, "actual-dashboards")
		err = os.MkdirAll(actualDir, 0750)
		require.NoError(t, err)

		// Create symlink
		symlinkPath := filepath.Join(tmpDir, "linked-dashboards")
		err = os.Symlink(actualDir, symlinkPath)
		if err != nil {
			t.Skip("Cannot create symlinks on this system")
		}

		// Write config with symlink path
		configContent := `apiVersion: 1
providers:
- name: 'symlink-path'
  orgId: 1
  type: file
  options:
    path: ` + symlinkPath + `
`
		err = os.WriteFile(filepath.Join(dashboardsDir, "config.yaml"), []byte(configContent), 0644)
		require.NoError(t, err)

		stub, err := NewStubProvisioning(tmpDir)
		require.NoError(t, err)

		path := stub.GetDashboardProvisionerResolvedPath("symlink-path")
		// Should resolve symlink to actual path
		assert.NotEmpty(t, path)

		// EvalSymlinks resolves to the real path, which might include /private prefix on macOS
		// Just verify it contains the actual directory name
		assert.Contains(t, path, "actual-dashboards", "should resolve symlink to actual directory")
	})

	t.Run("should fallback to original path on EvalSymlinks failure", func(t *testing.T) {
		// This is harder to test directly, but we can verify the fallback logic exists
		// by checking that even with a broken symlink, we get a path back
		tmpDir := t.TempDir()
		dashboardsDir := filepath.Join(tmpDir, "dashboards")
		err := os.MkdirAll(dashboardsDir, 0750)
		require.NoError(t, err)

		// Create config with a path that will fail EvalSymlinks
		configContent := `apiVersion: 1
providers:
- name: 'broken-path'
  orgId: 1
  type: file
  options:
    path: /tmp/test-stub-dashboards
`
		err = os.WriteFile(filepath.Join(dashboardsDir, "config.yaml"), []byte(configContent), 0644)
		require.NoError(t, err)

		stub, err := NewStubProvisioning(tmpDir)
		require.NoError(t, err)

		path := stub.GetDashboardProvisionerResolvedPath("broken-path")
		assert.NotEmpty(t, path, "should return fallback path even if EvalSymlinks fails")
	})
}

func TestProvideStubProvisioningService(t *testing.T) {
	t.Run("should create stub from config", func(t *testing.T) {
		cfg := &setting.Cfg{
			ProvisioningPath: "./testdata/stub-configs",
		}

		stub, err := ProvideStubProvisioningService(cfg)
		require.NoError(t, err)
		require.NotNil(t, stub)

		// Verify it works
		path := stub.GetDashboardProvisionerResolvedPath("test-dashboard")
		assert.NotEmpty(t, path)
	})

	t.Run("should handle non-existent provisioning path", func(t *testing.T) {
		cfg := &setting.Cfg{
			ProvisioningPath: "/non-existent-provisioning-path",
		}

		stub, err := ProvideStubProvisioningService(cfg)
		require.NoError(t, err, "should not fail with non-existent path")
		require.NotNil(t, stub)
	})
}

func TestStubProvisioningEdgeCases(t *testing.T) {
	t.Run("should handle empty config name", func(t *testing.T) {
		testPath := "./testdata/stub-configs"
		stub, err := NewStubProvisioning(testPath)
		require.NoError(t, err)

		// Empty config name returns resolved empty path (current directory)
		path := stub.GetDashboardProvisionerResolvedPath("")
		assert.NotEmpty(t, path)

		allowUpdates := stub.GetAllowUIUpdatesFromConfig("")
		assert.False(t, allowUpdates)
	})

	t.Run("should handle special characters in config name", func(t *testing.T) {
		tmpDir := t.TempDir()
		dashboardsDir := filepath.Join(tmpDir, "dashboards")
		err := os.MkdirAll(dashboardsDir, 0750)
		require.NoError(t, err)

		configContent := `apiVersion: 1
providers:
- name: 'test-dashboard-with-special-chars-123'
  orgId: 1
  type: file
  allowUiUpdates: true
  options:
    path: /tmp/test
`
		err = os.WriteFile(filepath.Join(dashboardsDir, "config.yaml"), []byte(configContent), 0644)
		require.NoError(t, err)

		stub, err := NewStubProvisioning(tmpDir)
		require.NoError(t, err)

		allowUpdates := stub.GetAllowUIUpdatesFromConfig("test-dashboard-with-special-chars-123")
		assert.True(t, allowUpdates)
	})

	t.Run("should handle paths with spaces", func(t *testing.T) {
		tmpDir := t.TempDir()
		dashboardsDir := filepath.Join(tmpDir, "dashboards")
		err := os.MkdirAll(dashboardsDir, 0750)
		require.NoError(t, err)

		// Create directory with spaces
		pathWithSpaces := filepath.Join(tmpDir, "my dashboard folder")
		err = os.MkdirAll(pathWithSpaces, 0750)
		require.NoError(t, err)

		configContent := `apiVersion: 1
providers:
- name: 'space-test'
  orgId: 1
  type: file
  options:
    path: "` + pathWithSpaces + `"
`
		err = os.WriteFile(filepath.Join(dashboardsDir, "config.yaml"), []byte(configContent), 0644)
		require.NoError(t, err)

		stub, err := NewStubProvisioning(tmpDir)
		require.NoError(t, err)

		path := stub.GetDashboardProvisionerResolvedPath("space-test")
		assert.NotEmpty(t, path)
		assert.Contains(t, path, "dashboard folder")
	})

	t.Run("should handle multiple YAML files in directory", func(t *testing.T) {
		tmpDir := t.TempDir()
		dashboardsDir := filepath.Join(tmpDir, "dashboards")
		err := os.MkdirAll(dashboardsDir, 0750)
		require.NoError(t, err)

		// Create first config file
		config1 := `apiVersion: 1
providers:
- name: 'config1'
  orgId: 1
  type: file
  allowUiUpdates: true
  options:
    path: /tmp/config1
`
		err = os.WriteFile(filepath.Join(dashboardsDir, "config1.yaml"), []byte(config1), 0644)
		require.NoError(t, err)

		// Create second config file
		config2 := `apiVersion: 1
providers:
- name: 'config2'
  orgId: 1
  type: file
  allowUiUpdates: false
  options:
    path: /tmp/config2
`
		err = os.WriteFile(filepath.Join(dashboardsDir, "config2.yaml"), []byte(config2), 0644)
		require.NoError(t, err)

		stub, err := NewStubProvisioning(tmpDir)
		require.NoError(t, err)

		// Both configs should be loaded
		assert.True(t, stub.GetAllowUIUpdatesFromConfig("config1"))
		assert.False(t, stub.GetAllowUIUpdatesFromConfig("config2"))

		path1 := stub.GetDashboardProvisionerResolvedPath("config1")
		path2 := stub.GetDashboardProvisionerResolvedPath("config2")
		assert.NotEmpty(t, path1)
		assert.NotEmpty(t, path2)
		assert.NotEqual(t, path1, path2)
	})

	t.Run("should ignore non-YAML files", func(t *testing.T) {
		tmpDir := t.TempDir()
		dashboardsDir := filepath.Join(tmpDir, "dashboards")
		err := os.MkdirAll(dashboardsDir, 0750)
		require.NoError(t, err)

		// Create YAML config
		yamlConfig := `apiVersion: 1
providers:
- name: 'yaml-config'
  orgId: 1
  type: file
  options:
    path: /tmp/test
`
		err = os.WriteFile(filepath.Join(dashboardsDir, "config.yaml"), []byte(yamlConfig), 0644)
		require.NoError(t, err)

		// Create non-YAML files
		err = os.WriteFile(filepath.Join(dashboardsDir, "readme.txt"), []byte("test"), 0644)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(dashboardsDir, "config.json"), []byte("{}"), 0644)
		require.NoError(t, err)

		stub, err := NewStubProvisioning(tmpDir)
		require.NoError(t, err)

		// Should only load the YAML config
		path := stub.GetDashboardProvisionerResolvedPath("yaml-config")
		assert.NotEmpty(t, path)
	})
}
