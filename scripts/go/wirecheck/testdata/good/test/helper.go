package test

import (
	"testing"
	"time"

	"github.com/grafana/grafana/scripts/go/wirecheck/testdata/good"
)

// TestConfig represents test configuration
type TestConfig struct {
	Name string
}

// NewTestConfig creates a test configuration
func NewTestConfig(name string) *TestConfig {
	return &TestConfig{Name: name}
}

// TestHelper provides helper functions for testing
type TestHelper struct {
	config *TestConfig
}

// NewTestHelper creates a new test helper
func NewTestHelper(config *TestConfig) *TestHelper {
	return &TestHelper{config: config}
}

// CreateTestApp creates an application for testing
// This function does NOT call methods on dependencies - should NOT be detected
func CreateTestApp() *good.Application {
	config := good.ProvideConfig()
	repository := good.ProvideRepository(config)
	service := good.ProvideService(config, repository)
	return good.ProvideApplication(config, service)
}

// ProvideTestConfig creates a test configuration
// This function does NOT call methods on dependencies - should NOT be detected
func ProvideTestConfig() *good.Config {
	return good.NewConfig(9090, "testhost", 10*time.Second, false)
}

// ProvideTestHelper creates a test helper
// This function does NOT call methods on dependencies - should NOT be detected
func ProvideTestHelper(testConfig *TestConfig) *TestHelper {
	return NewTestHelper(testConfig)
}

// ValidateApp validates an application instance
func ValidateApp(t *testing.T, app *good.Application) {
	if app == nil {
		t.Error("Application should not be nil")
	}
}
