package commands

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestProfilingDiagnostics(t *testing.T) {
	tcs := []struct {
		defaults   *profilingDiagnostics
		enabledEnv string
		addrEnv    string
		portEnv    string
		expected   *profilingDiagnostics
	}{
		{defaults: newProfilingDiagnostics(false, "localhost", 6060), enabledEnv: "", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(false, "localhost", 6060)},
		{defaults: newProfilingDiagnostics(true, "0.0.0.0", 8080), enabledEnv: "", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(true, "0.0.0.0", 8080)},
		{defaults: newProfilingDiagnostics(false, "", 6060), enabledEnv: "false", addrEnv: "", portEnv: "8080", expected: newProfilingDiagnostics(false, "", 8080)},
		{defaults: newProfilingDiagnostics(false, "localhost", 6060), enabledEnv: "true", addrEnv: "0.0.0.0", portEnv: "8080", expected: newProfilingDiagnostics(true, "0.0.0.0", 8080)},
		{defaults: newProfilingDiagnostics(false, "127.0.0.1", 6060), enabledEnv: "true", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(true, "127.0.0.1", 6060)},
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
