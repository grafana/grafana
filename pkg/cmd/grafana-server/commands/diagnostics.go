package commands

import (
	"fmt"
	"net/http"
	"os"
	"runtime"
	"runtime/trace"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	profilingEnabledEnvName   = "GF_DIAGNOSTICS_PROFILING_ENABLED"
	profilingAddrEnvName      = "GF_DIAGNOSTICS_PROFILING_ADDR"
	profilingPortEnvName      = "GF_DIAGNOSTICS_PROFILING_PORT"
	profilingBlockRateEnvName = "GF_DIAGNOSTICS_PROFILING_BLOCK_RATE"
	profilingMutexRateEnvName = "GF_DIAGNOSTICS_PROFILING_MUTEX_RATE"
	tracingEnabledEnvName     = "GF_DIAGNOSTICS_TRACING_ENABLED"
	tracingFileEnvName        = "GF_DIAGNOSTICS_TRACING_FILE"
)

type profilingDiagnostics struct {
	enabled   bool
	addr      string
	port      uint64
	blockRate int
	mutexRate int
}

func newProfilingDiagnostics(enabled bool, addr string, port uint64, blockRate int, mutexRate int) *profilingDiagnostics {
	return &profilingDiagnostics{
		enabled:   enabled,
		addr:      addr,
		port:      port,
		blockRate: blockRate,
		mutexRate: mutexRate,
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

	blockRateEnv := os.Getenv(profilingBlockRateEnvName)
	if blockRateEnv != "" {
		blockRate, err := strconv.Atoi(blockRateEnv)
		if err != nil {
			return fmt.Errorf("failed to parse %s environment variable as int", profilingBlockRateEnvName)
		}
		pd.blockRate = blockRate
	}

	mutexFractionEnv := os.Getenv(profilingMutexRateEnvName)
	if mutexFractionEnv != "" {
		mutexProfileFraction, err := strconv.Atoi(mutexFractionEnv)
		if err != nil {
			return fmt.Errorf("failed to parse %s environment variable as int", profilingMutexRateEnvName)
		}
		pd.mutexRate = mutexProfileFraction
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

func setupProfiling(profile bool, profileAddr string, profilePort uint64, blockRate int, mutexFraction int) error {
	profileDiagnostics := newProfilingDiagnostics(profile, profileAddr, profilePort, blockRate, mutexFraction)
	if err := profileDiagnostics.overrideWithEnv(); err != nil {
		return err
	}

	if profileDiagnostics.enabled {
		fmt.Println("diagnostics: pprof profiling enabled", "addr", profileDiagnostics.addr, "port", profileDiagnostics.port, "blockProfileRate", profileDiagnostics.blockRate, "mutexProfileRate", profileDiagnostics.mutexRate)
		runtime.SetBlockProfileRate(profileDiagnostics.blockRate)
		runtime.SetMutexProfileFraction(profileDiagnostics.mutexRate)

		go func() {
			// TODO: We should enable the linter and fix G114 here.
			//	G114: Use of net/http serve function that has no support for setting timeouts (gosec)
			//
			//nolint:gosec
			err := http.ListenAndServe(fmt.Sprintf("%s:%d", profileDiagnostics.addr, profileDiagnostics.port), nil)
			if err != nil {
				panic(err)
			}
		}()
	}
	return nil
}

func setupTracing(tracing bool, tracingFile string, logger *log.ConcreteLogger) error {
	traceDiagnostics := newTracingDiagnostics(tracing, tracingFile)
	if err := traceDiagnostics.overrideWithEnv(); err != nil {
		return err
	}

	if traceDiagnostics.enabled {
		fmt.Println("diagnostics: tracing enabled", "file", traceDiagnostics.file)
		f, err := os.Create(traceDiagnostics.file)
		if err != nil {
			panic(err)
		}
		defer func() {
			if err := f.Close(); err != nil {
				logger.Error("Failed to write trace diagnostics", "path", traceDiagnostics.file, "err", err)
			}
		}()

		if err := trace.Start(f); err != nil {
			panic(err)
		}
		defer trace.Stop()
	}
	return nil
}
