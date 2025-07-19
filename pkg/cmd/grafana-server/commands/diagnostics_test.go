package commands

import (
	"fmt"
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

func TestCreateProfilingServer(t *testing.T) {
    tcs := []struct {
        name     string
        addr     string
        handler  http.Handler
    }{
        {
            name:    "default configuration",
            addr:    "localhost:6060",
            handler: nil,
        },
        {
            name:    "custom address and port",
            addr:    "0.0.0.0:8080",
            handler: http.DefaultServeMux,
        },
        {
            name:    "IPv6 address",
            addr:    "[::1]:9090",
            handler: nil,
        },
    }

    for _, tc := range tcs {
        t.Run(tc.name, func(t *testing.T) {
            server := createProfilingServer(tc.addr, tc.handler)
            
            // Verify server configuration
            assert.Equal(t, tc.addr, server.Addr)
            assert.Equal(t, tc.handler, server.Handler)
            
            // Verify timeout configurations
            assert.Equal(t, 5*time.Second, server.ReadHeaderTimeout, "ReadHeaderTimeout should be 5 seconds")
            assert.Equal(t, 10*time.Second, server.ReadTimeout, "ReadTimeout should be 10 seconds")
            assert.Equal(t, 10*time.Second, server.WriteTimeout, "WriteTimeout should be 10 seconds")
            assert.Equal(t, 60*time.Second, server.IdleTimeout, "IdleTimeout should be 60 seconds")
        })
    }
}

func TestCreateProfilingServerTimeoutValues(t *testing.T) {
    server := createProfilingServer("test:1234", nil)
    
    // Test that all required timeouts are set to prevent G114 security issue
    assert.NotZero(t, server.ReadHeaderTimeout, "ReadHeaderTimeout must be set to prevent DoS attacks")
    assert.NotZero(t, server.ReadTimeout, "ReadTimeout must be set to prevent resource exhaustion")
    assert.NotZero(t, server.WriteTimeout, "WriteTimeout must be set to prevent hanging connections")
    assert.NotZero(t, server.IdleTimeout, "IdleTimeout must be set to prevent idle connection buildup")
    
    // Verify the timeout values are reasonable (not too short, not too long)
    assert.True(t, server.ReadHeaderTimeout >= 1*time.Second && server.ReadHeaderTimeout <= 30*time.Second)
    assert.True(t, server.ReadTimeout >= 5*time.Second && server.ReadTimeout <= 60*time.Second)
    assert.True(t, server.WriteTimeout >= 5*time.Second && server.WriteTimeout <= 60*time.Second)
    assert.True(t, server.IdleTimeout >= 30*time.Second && server.IdleTimeout <= 300*time.Second)
}