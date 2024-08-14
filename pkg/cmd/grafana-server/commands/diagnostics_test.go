package commands

import (
	"fmt"
	"testing"

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
		enabledArg   bool
		addrArg      string
		portArg      uint64
		blockRateArg int
		mutexRateArg int
		expected     *profilingDiagnostics
	}{
		{defaults: newProfilingDiagnostics(false, "localhost", 6060, 0, 0), enabledEnv: "", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(false, "localhost", 6060, 0, 0)},
		{defaults: newProfilingDiagnostics(true, "0.0.0.0", 8080, 0, 0), enabledEnv: "", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(true, "0.0.0.0", 8080, 0, 0)},
		{defaults: newProfilingDiagnostics(false, "", 6060, 0, 0), enabledEnv: "false", addrEnv: "", portEnv: "8080", expected: newProfilingDiagnostics(false, "", 8080, 0, 0)},
		{defaults: newProfilingDiagnostics(false, "localhost", 6060, 0, 0), enabledEnv: "true", addrEnv: "0.0.0.0", portEnv: "8080", expected: newProfilingDiagnostics(true, "0.0.0.0", 8080, 0, 0)},
		{defaults: newProfilingDiagnostics(false, "127.0.0.1", 6060, 0, 0), enabledEnv: "true", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(true, "127.0.0.1", 6060, 0, 0)},
		{defaults: newProfilingDiagnostics(true, "localhost", 6060, 0, 0), enabledEnv: "", addrEnv: "", portEnv: "", blockRateEnv: "3", mutexRateEnv: "4", expected: newProfilingDiagnostics(true, "localhost", 6060, 3, 4)},
		{defaults: newProfilingDiagnostics(true, "localhost", 6060, 0, 0), enabledEnv: "", addrEnv: "", portEnv: "", expected: newProfilingDiagnostics(true, "localhost", 6060, 0, 0)},
		{defaults: newProfilingDiagnostics(false, "localhost", 6060, 0, 0), enabledArg: true, addrArg: "0.0.0.0", portArg: 8080, blockRateArg: 1, mutexRateArg: 1, expected: newProfilingDiagnostics(true, "0.0.0.0", 8080, 1, 1)},
		{defaults: newProfilingDiagnostics(true, "0.0.0.0", 8080, 1, 1), enabledArg: false, addrArg: "", portArg: 0, blockRateArg: 0, mutexRateArg: 0, expected: newProfilingDiagnostics(true, "0.0.0.0", 8080, 1, 1)},
		{defaults: newProfilingDiagnostics(false, "localhost", 6060, 0, 0), enabledArg: false, addrArg: "1.1.1.1", portArg: 1111, blockRateArg: 1, mutexRateArg: 1, enabledEnv: "true", addrEnv: "2.2.2.2", portEnv: "2222", blockRateEnv: "2", mutexRateEnv: "2", expected: newProfilingDiagnostics(true, "2.2.2.2", 2222, 2, 2)},
	}

	for i, tc := range tcs {
		t.Run(fmt.Sprintf("testcase %d", i), func(t *testing.T) {
			tc.defaults.overrideWithArgs(tc.enabledArg, tc.addrArg, tc.portArg, tc.blockRateArg, tc.mutexRateArg)
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
		enabledArg bool
		fileArg    string
		expected   *tracingDiagnostics
	}{
		{defaults: newTracingDiagnostics(false, "trace.out"), enabledEnv: "", fileEnv: "", expected: newTracingDiagnostics(false, "trace.out")},
		{defaults: newTracingDiagnostics(true, "/tmp/trace.out"), enabledEnv: "", fileEnv: "", expected: newTracingDiagnostics(true, "/tmp/trace.out")},
		{defaults: newTracingDiagnostics(false, "trace.out"), enabledEnv: "false", fileEnv: "/tmp/trace.out", expected: newTracingDiagnostics(false, "/tmp/trace.out")},
		{defaults: newTracingDiagnostics(false, "trace.out"), enabledEnv: "true", fileEnv: "/tmp/trace.out", expected: newTracingDiagnostics(true, "/tmp/trace.out")},
		{defaults: newTracingDiagnostics(false, "trace.out"), enabledEnv: "true", fileEnv: "", expected: newTracingDiagnostics(true, "trace.out")},
		{defaults: newTracingDiagnostics(false, "trace.out"), enabledArg: true, fileArg: "/tmp/trace.out", expected: newTracingDiagnostics(true, "/tmp/trace.out")},
		{defaults: newTracingDiagnostics(true, "/tmp/trace.out"), enabledArg: false, fileArg: "", expected: newTracingDiagnostics(true, "/tmp/trace.out")},
		{defaults: newTracingDiagnostics(false, "trace.out"), enabledArg: false, fileArg: "/tmp/trace.out", enabledEnv: "true", fileEnv: "/tmp/traceEnv.out", expected: newTracingDiagnostics(true, "/tmp/traceEnv.out")},
	}

	for i, tc := range tcs {
		t.Run(fmt.Sprintf("testcase %d", i), func(t *testing.T) {
			tc.defaults.overrideWithArgs(tc.enabledArg, tc.fileArg)
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
