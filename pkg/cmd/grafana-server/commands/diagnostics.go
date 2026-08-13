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
	profilingEnabledEnvName = "GF_DIAGNOSTICS_PROFILING_ENABLED"
	profilingAddrEnvName    = "GF_DIAGNOSTICS_PROFILING_ADDR"
	profilingPortEnvName    = "GF_DIAGNOSTICS_PROFILING_PORT"
	// LOGZ.IO GRAFANA CHANGE :: APPZ-3027 Make the block profile rate opt-in
	profilingBlockRateEnvName = "GF_DIAGNOSTICS_PROFILING_BLOCK_RATE"
	// LOGZ.IO GRAFANA CHANGE :: End
	tracingEnabledEnvName = "GF_DIAGNOSTICS_TRACING_ENABLED"
	tracingFileEnvName    = "GF_DIAGNOSTICS_TRACING_FILE"
)

type profilingDiagnostics struct {
	enabled bool
	addr    string
	port    uint64
	// LOGZ.IO GRAFANA CHANGE :: APPZ-3027 blockRate is passed to runtime.SetBlockProfileRate. It is the
	// average number of nanoseconds of blocking per sampled event, so 1 samples every blocking event and
	// 0 disables block profiling entirely. Enabling profiling used to hardcode 1, which instruments every
	// channel and mutex wait in the process - too expensive to leave on in production, and not needed for
	// heap profiles, which are always sampled regardless of this setting.
	blockRate int
	// LOGZ.IO GRAFANA CHANGE :: End
}

func newProfilingDiagnostics(enabled bool, addr string, port uint64) *profilingDiagnostics {
	return &profilingDiagnostics{
		enabled: enabled,
		addr:    addr,
		port:    port,
		// LOGZ.IO GRAFANA CHANGE :: APPZ-3027 Off unless explicitly asked for
		blockRate: 0,
		// LOGZ.IO GRAFANA CHANGE :: End
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

	// LOGZ.IO GRAFANA CHANGE :: APPZ-3027 Make the block profile rate opt-in
	blockRateEnv := os.Getenv(profilingBlockRateEnvName)
	if blockRateEnv != "" {
		blockRate, parseErr := strconv.Atoi(blockRateEnv)
		if parseErr != nil {
			return fmt.Errorf("failed to parse %s environment variable to integer", profilingBlockRateEnvName)
		}
		pd.blockRate = blockRate
	}
	// LOGZ.IO GRAFANA CHANGE :: End

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

func setupProfiling(profile bool, profileAddr string, profilePort uint64) error {
	profileDiagnostics := newProfilingDiagnostics(profile, profileAddr, profilePort)
	if err := profileDiagnostics.overrideWithEnv(); err != nil {
		return err
	}

	if profileDiagnostics.enabled {
		fmt.Println("diagnostics: pprof profiling enabled", "addr", profileDiagnostics.addr, "port", profileDiagnostics.port,
			"blockRate", profileDiagnostics.blockRate) // LOGZ.IO GRAFANA CHANGE :: APPZ-3027 Report the block rate in use
		// LOGZ.IO GRAFANA CHANGE :: APPZ-3027 Only instrument blocking events when explicitly asked to.
		// Heap and CPU profiles do not depend on this, so leaving it off keeps enabling pprof cheap.
		if profileDiagnostics.blockRate > 0 {
			runtime.SetBlockProfileRate(profileDiagnostics.blockRate)
		}
		// LOGZ.IO GRAFANA CHANGE :: End
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
