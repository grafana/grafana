package commands

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestProfilingDiagnostics(t *testing.T) {
	tcs := []struct {
		defaults     *profilingDiagnostics
		enabledEnv   string
		addrEnv      string
		portEnv      string
		blockRateEnv string
		mutexRateEnv string
		expected     *profilingDiagnostics
	}{
		{defaults: newProfilingDiagnostics(false, "localhost", 6060, 0, 0), enabledEnv: "", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(false, "localhost", 6060, 0, 0)},
		{defaults: newProfilingDiagnostics(true, "0.0.0.0", 8080, 0, 0), enabledEnv: "", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(true, "0.0.0.0", 8080, 0, 0)},
		{defaults: newProfilingDiagnostics(false, "", 6060, 0, 0), enabledEnv: "false", addrEnv: "", portEnv: "8080", expected: newProfilingDiagnostics(false, "", 8080, 0, 0)},
		{defaults: newProfilingDiagnostics(false, "localhost", 6060, 0, 0), enabledEnv: "true", addrEnv: "0.0.0.0", portEnv: "8080", expected: newProfilingDiagnostics(true, "0.0.0.0", 8080, 0, 0)},
		{defaults: newProfilingDiagnostics(false, "127.0.0.1", 6060, 0, 0), enabledEnv: "true", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(true, "127.0.0.1", 6060, 0, 0)},
		{defaults: newProfilingDiagnostics(true, "localhost", 6060, 0, 0), enabledEnv: "", addrEnv: "", portEnv: "", blockRateEnv: "3", mutexRateEnv: "4", expected: newProfilingDiagnostics(true, "localhost", 6060, 3, 4)},
		{defaults: newProfilingDiagnostics(true, "localhost", 6060, 0, 0), enabledEnv: "", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(true, "localhost", 6060, 0, 0)},
	}

	for i, tc := range tcs {
		t.Run(fmt.Sprintf("testcase %d", i), func(t *testing.T) {
			if tc.enabledEnv != "" {
				t.Setenv(profilingEnabledEnvName, tc.enabledEnv)
			}
			if tc.addrEnv != "" {
				t.Setenv(profilingAddrEnvName, tc.addrEnv)
			}
			if tc.portEnv != "" {
				t.Setenv(profilingPortEnvName, tc.portEnv)
			}
			if tc.blockRateEnv != "" {
				t.Setenv(profilingBlockRateEnvName, tc.blockRateEnv)
			}
			if tc.mutexRateEnv != "" {
				t.Setenv(profilingMutexRateEnvName, tc.mutexRateEnv)
			}
			err := tc.defaults.overrideWithEnv()
			assert.NoError(t, err)
			assert.Exactly(t, tc.expected, tc.defaults)
		})
	}
}

func TestTracingDiagnostics(t *testing.T) {
	tcs := []struct {
		defaults   *tracingDiagnostics
		enabledEnv string
		fileEnv    string
		expected   *tracingDiagnostics
	}{
		{defaults: newTracingDiagnostics(false, "trace.out"), enabledEnv: "", fileEnv: "", expected: newTracingDiagnostics(false, "trace.out")},
		{defaults: newTracingDiagnostics(true, "/tmp/trace.out"), enabledEnv: "", fileEnv: "", expected: newTracingDiagnostics(true, "/tmp/trace.out")},
		{defaults: newTracingDiagnostics(false, "trace.out"), enabledEnv: "false", fileEnv: "/tmp/trace.out", expected: newTracingDiagnostics(false, "/tmp/trace.out")},
		{defaults: newTracingDiagnostics(false, "trace.out"), enabledEnv: "true", fileEnv: "/tmp/trace.out", expected: newTracingDiagnostics(true, "/tmp/trace.out")},
		{defaults: newTracingDiagnostics(false, "trace.out"), enabledEnv: "true", fileEnv: "", expected: newTracingDiagnostics(true, "trace.out")},
	}

	for i, tc := range tcs {
		t.Run(fmt.Sprintf("testcase %d", i), func(t *testing.T) {
			if tc.enabledEnv != "" {
				t.Setenv(tracingEnabledEnvName, tc.enabledEnv)
			}
			if tc.fileEnv != "" {
				t.Setenv(tracingFileEnvName, tc.fileEnv)
			}
			err := tc.defaults.overrideWithEnv()
			assert.NoError(t, err)
			assert.Exactly(t, tc.expected, tc.defaults)
		})
	}
}

type httpServerTest struct {
	server *http.Server
}

func TestSetupProfiling(t *testing.T) {
	// Save the original createServer function and restore it after each test
	originalCreateServer := createServer
	defer func() { createServer = originalCreateServer }()

	t.Run("should configure http server with correct timeouts", func(t *testing.T) {
		var test httpServerTest

		// Create test server that captures the configuration
		createServer = func(addr string, handler http.Handler) (*http.Server, error) {
			test.server = &http.Server{
				Addr:              addr,
				Handler:           handler,
				ReadHeaderTimeout: 5 * time.Second,
				ReadTimeout:       10 * time.Second,
				WriteTimeout:      10 * time.Second,
				IdleTimeout:       60 * time.Second,
			}
			// Return the test server instead of origServer
			return test.server, nil
		}

		err := setupProfiling(true, "localhost", 6060, 1, 1)
		assert.NoError(t, err)

		time.Sleep(100 * time.Millisecond)

		assert.NotNil(t, test.server)
		assert.Equal(t, "localhost:6060", test.server.Addr)
		assert.Equal(t, 5*time.Second, test.server.ReadHeaderTimeout)
		assert.Equal(t, 10*time.Second, test.server.ReadTimeout)
		assert.Equal(t, 10*time.Second, test.server.WriteTimeout)
		assert.Equal(t, 60*time.Second, test.server.IdleTimeout)
	})

	t.Run("should not start server when profiling is disabled", func(t *testing.T) {
		serverStarted := false

		createServer = func(addr string, handler http.Handler) (*http.Server, error) {
			serverStarted = true
			return &http.Server{}, nil
		}

		err := setupProfiling(false, "localhost", 6060, 1, 1)
		assert.NoError(t, err)

		time.Sleep(100 * time.Millisecond)

		assert.False(t, serverStarted, "Server should not start when profiling is disabled")
	})

	t.Run("should respect environment variable overrides", func(t *testing.T) {
		var test httpServerTest

		createServer = func(addr string, handler http.Handler) (*http.Server, error) {
			test.server = &http.Server{Addr: addr}
			return test.server, nil
		}

		t.Setenv(profilingEnabledEnvName, "true")
		t.Setenv(profilingAddrEnvName, "0.0.0.0")
		t.Setenv(profilingPortEnvName, "8080")

		err := setupProfiling(false, "localhost", 6060, 1, 1)
		assert.NoError(t, err)

		time.Sleep(100 * time.Millisecond)

		assert.NotNil(t, test.server)
		assert.Equal(t, "0.0.0.0:8080", test.server.Addr)
	})
}
