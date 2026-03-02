package secretsconsolidation

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"runtime/pprof"
	"time"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/server"
)

func ConsolidateSecrets(cmd utils.CommandLine, runner server.Runner) error {
	ctx := context.Background()

	cpuProfilePath := cmd.String("cpuprofile")
	memProfilePath := cmd.String("memprofile")
	benchmark := cmd.Bool("benchmark")
	cpuProfileRate := cmd.Int("cpu-profile-rate")
	if cpuProfileRate <= 0 {
		cpuProfileRate = 5000
	}

	if cpuProfilePath != "" {
		runtime.SetCPUProfileRate(cpuProfileRate)
		f, err := os.Create(cpuProfilePath)
		if err != nil {
			return fmt.Errorf("create CPU profile file: %w", err)
		}
		defer func() {
			_ = f.Close()
		}()
		if err := pprof.StartCPUProfile(f); err != nil {
			return fmt.Errorf("start CPU profile: %w", err)
		}
		defer pprof.StopCPUProfile()
		logger.Info("CPU profiling enabled", "rate", cpuProfileRate, "output", cpuProfilePath)
	} else if benchmark {
		runtime.SetCPUProfileRate(cpuProfileRate)
	}

	start := time.Now()
	err := runner.SecretsConsolidationService.Consolidate(ctx)
	elapsed := time.Since(start)

	if benchmark || err != nil {
		logger.Info("Consolidate finished", "duration_sec", elapsed.Seconds(), "duration", elapsed.String(), "error", err)
	}
	if err != nil {
		return err
	}

	if memProfilePath != "" {
		f, err := os.Create(memProfilePath)
		if err != nil {
			return fmt.Errorf("create memory profile file: %w", err)
		}
		defer func() {
			_ = f.Close()
		}()
		runtime.GC()
		if err := pprof.WriteHeapProfile(f); err != nil {
			return fmt.Errorf("write heap profile: %w", err)
		}
		logger.Info("Heap profile written", "output", memProfilePath)
	}

	return nil
}
