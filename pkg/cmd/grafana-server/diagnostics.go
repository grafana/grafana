package main

import (
	"fmt"
	"os"
	"strconv"
)

const (
	profilingEnabledEnvName = "GF_DIAGNOSTICS_PROFILING_ENABLED"
	profilingPortEnvName    = "GF_DIAGNOSTICS_PROFILING_PORT"
	tracingEnabledEnvName   = "GF_DIAGNOSTICS_TRACING_ENABLED"
	tracingFileEnvName      = "GF_DIAGNOSTICS_TRACING_FILE"
)

type profilingDiagnostics struct {
	enabled bool
	port    uint
}

func newProfilingDiagnostics(enabled bool, port uint) *profilingDiagnostics {
	return &profilingDiagnostics{
		enabled: enabled,
		port:    port,
	}
}

func (pd *profilingDiagnostics) overrideWithEnv() error {
	enabledEnv := os.Getenv(profilingEnabledEnvName)
	if enabledEnv != "" {
		enabled, err := strconv.ParseBool(enabledEnv)
		if err != nil {
			return fmt.Errorf("Failed to parse %s environment variable as bool", profilingEnabledEnvName)
		}
		pd.enabled = enabled
	}

	portEnv := os.Getenv(profilingPortEnvName)
	if portEnv != "" {
		port, parseErr := strconv.ParseUint(portEnv, 0, 64)
		if parseErr != nil {
			return fmt.Errorf("Failed to parse %s environment variable to unsigned integer", profilingPortEnvName)
		}
		pd.port = uint(port)
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
			return fmt.Errorf("Failed to parse %s environment variable as bool", tracingEnabledEnvName)
		}
		td.enabled = enabled
	}

	fileEnv := os.Getenv(tracingFileEnvName)
	if fileEnv != "" {
		td.file = fileEnv
	}

	return nil
}
