package commands

import (
	"fmt"
	"os"
	"strconv"
)

const (
	profilingEnabledEnvName = "GF_DIAGNOSTICS_PROFILING_ENABLED"
	profilingAddrEnvName    = "GF_DIAGNOSTICS_PROFILING_ADDR"
	profilingPortEnvName    = "GF_DIAGNOSTICS_PROFILING_PORT"
	tracingEnabledEnvName   = "GF_DIAGNOSTICS_TRACING_ENABLED"
	tracingFileEnvName      = "GF_DIAGNOSTICS_TRACING_FILE"
)

type profilingDiagnostics struct {
	enabled bool
	addr    string
	port    uint64
}

func newProfilingDiagnostics(enabled bool, addr string, port uint64) *profilingDiagnostics {
	return &profilingDiagnostics{
		enabled: enabled,
		addr:    addr,
		port:    port,
	}
}

func (pd *profilingDiagnostics) overrideWithEnv() error {
	enabledEnv := os.Getenv(profilingEnabledEnvName)
	if enabledEnv != "" {
		enabled, err := strconv.ParseBool(enabledEnv)
		if err != nil {
			return fmt.Errorf("failed to parse %s environment variable as bool", profilingEnabledEnvName)
		}
		pd.enabled = enabled
	}

	addrEnv := os.Getenv(profilingAddrEnvName)
	if addrEnv != "" {
		pd.addr = addrEnv
	}

	portEnv := os.Getenv(profilingPortEnvName)
	if portEnv != "" {
		port, parseErr := strconv.ParseUint(portEnv, 0, 64)
		if parseErr != nil {
			return fmt.Errorf("failed to parse %s environment variable to unsigned integer", profilingPortEnvName)
		}
		pd.port = port
	}

	return nil
}

type tracingDiagnostics struct {
	enabled bool
	file    string
}

func newTracingDiagnostics(enabled bool, file string) *tracingDiagnostics {
	return &tracingDiagnostics{
		enabled: enabled,
		file:    file,
	}
}

func (td *tracingDiagnostics) overrideWithEnv() error {
	enabledEnv := os.Getenv(tracingEnabledEnvName)
	if enabledEnv != "" {
		enabled, err := strconv.ParseBool(enabledEnv)
		if err != nil {
			return fmt.Errorf("failed to parse %s environment variable as bool", tracingEnabledEnvName)
		}
		td.enabled = enabled
	}

	fileEnv := os.Getenv(tracingFileEnvName)
	if fileEnv != "" {
		td.file = fileEnv
	}

	return nil
}
