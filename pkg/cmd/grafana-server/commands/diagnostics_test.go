package commands

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

// LOGZ.IO GRAFANA CHANGE :: APPZ-3027 withBlockRate builds an expectation with a non-zero block rate.
func withBlockRate(pd *profilingDiagnostics, rate int) *profilingDiagnostics {
	pd.blockRate = rate
	return pd
}

// LOGZ.IO GRAFANA CHANGE :: End

func TestProfilingDiagnostics(t *testing.T) {
	tcs := []struct {
		defaults     *profilingDiagnostics
		enabledEnv   string
		addrEnv      string
		portEnv      string
		blockRateEnv string // LOGZ.IO GRAFANA CHANGE :: APPZ-3027
		expected     *profilingDiagnostics
	}{
		{defaults: newProfilingDiagnostics(false, "localhost", 6060), enabledEnv: "", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(false, "localhost", 6060)},
		{defaults: newProfilingDiagnostics(true, "0.0.0.0", 8080), enabledEnv: "", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(true, "0.0.0.0", 8080)},
		{defaults: newProfilingDiagnostics(false, "", 6060), enabledEnv: "false", addrEnv: "", portEnv: "8080", expected: newProfilingDiagnostics(false, "", 8080)},
		{defaults: newProfilingDiagnostics(false, "localhost", 6060), enabledEnv: "true", addrEnv: "0.0.0.0", portEnv: "8080", expected: newProfilingDiagnostics(true, "0.0.0.0", 8080)},
		{defaults: newProfilingDiagnostics(false, "127.0.0.1", 6060), enabledEnv: "true", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(true, "127.0.0.1", 6060)},
		// LOGZ.IO GRAFANA CHANGE :: APPZ-3027 The block rate defaults to 0 (off) and is only set from the env.
		{defaults: newProfilingDiagnostics(true, "0.0.0.0", 6060), enabledEnv: "", addrEnv: "", portEnv: "", blockRateEnv: "", expected: newProfilingDiagnostics(true, "0.0.0.0", 6060)},
		{defaults: newProfilingDiagnostics(true, "0.0.0.0", 6060), enabledEnv: "", addrEnv: "", portEnv: "", blockRateEnv: "1", expected: withBlockRate(newProfilingDiagnostics(true, "0.0.0.0", 6060), 1)},
		{defaults: newProfilingDiagnostics(true, "0.0.0.0", 6060), enabledEnv: "", addrEnv: "", portEnv: "", blockRateEnv: "10000", expected: withBlockRate(newProfilingDiagnostics(true, "0.0.0.0", 6060), 10000)},
		// LOGZ.IO GRAFANA CHANGE :: End
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
			// LOGZ.IO GRAFANA CHANGE :: APPZ-3027
			if tc.blockRateEnv != "" {
				t.Setenv(profilingBlockRateEnvName, tc.blockRateEnv)
			}
			// LOGZ.IO GRAFANA CHANGE :: End
			err := tc.defaults.overrideWithEnv()
			assert.NoError(t, err)
			assert.Exactly(t, tc.expected, tc.defaults)
		})
	}
}

// LOGZ.IO GRAFANA CHANGE :: APPZ-3027 A bad block rate must be rejected, not silently ignored.
func TestProfilingDiagnostics_InvalidBlockRate(t *testing.T) {
	t.Setenv(profilingBlockRateEnvName, "not-a-number")

	pd := newProfilingDiagnostics(true, "0.0.0.0", 6060)
	err := pd.overrideWithEnv()

	assert.Error(t, err)
	assert.Zero(t, pd.blockRate, "block rate stays off when the value cannot be parsed")
}

// LOGZ.IO GRAFANA CHANGE :: End

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
