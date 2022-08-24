package searchV2

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

func dirSize(path string) (int64, error) {
	var size int64
	err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return err
	})
	return size, err
}

func logN(n, b float64) float64 {
	return math.Log(n) / math.Log(b)
}

// Slightly modified function from https://github.com/dustin/go-humanize (MIT).
func formatBytes(numBytes uint64) string {
	base := 1024.0
	sizes := []string{"B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"}
	if numBytes < 10 {
		return fmt.Sprintf("%d B", numBytes)
	}
	e := math.Floor(logN(float64(numBytes), base))
	suffix := sizes[int(e)]
	val := math.Floor(float64(numBytes)/math.Pow(base, e)*10+0.5) / 10
	return fmt.Sprintf("%.1f %s", val, suffix)
}

// This is a naive implementation of process CPU getting (credits to
// https://stackoverflow.com/a/11357813/1288429). Should work on both Linux and Darwin.
// Since we only use this during development – seems simple and cheap solution to get
// process CPU usage in cross-platform way.
func getProcessCPU(currentPid int) (float64, error) {
	cmd := exec.Command("ps", "aux")
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return 0, err
	}
	for {
		line, err := out.ReadString('\n')
		if err != nil {
			break
		}
		tokens := strings.Split(line, " ")
		ft := make([]string, 0)
		for _, t := range tokens {
			if t != "" && t != "\t" {
				ft = append(ft, t)
			}
		}
		pid, err := strconv.Atoi(ft[1])
		if err != nil {
			continue
		}
		if pid != currentPid {
			continue
		}
		cpu, err := strconv.ParseFloat(ft[2], 64)
		if err != nil {
			return 0, err
		}
		return cpu, nil
	}
	return 0, errors.New("process not found")
}

func debugResourceUsage(ctx context.Context, logger log.Logger, frequency time.Duration) {
	var maxHeapInuse uint64
	var maxSys uint64

	captureMemStats := func() {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		if m.HeapInuse > maxHeapInuse {
			maxHeapInuse = m.HeapInuse
		}
		if m.Sys > maxSys {
			maxSys = m.Sys
		}
	}

	var cpuUtilization []float64

	captureCPUStats := func() {
		cpu, err := getProcessCPU(os.Getpid())
		if err != nil {
			logger.Error("CPU stats error", "error", err)
			return
		}
		// Just collect CPU utilization to a slice and show in the of index build.
		cpuUtilization = append(cpuUtilization, cpu)
	}

	captureMemStats()
	captureCPUStats()

	for {
		select {
		case <-ctx.Done():
			logger.Warn("Resource usage during indexing", "maxHeapInUse", formatBytes(maxHeapInuse), "maxSys", formatBytes(maxSys), "cpuPercent", cpuUtilization)
			return
		case <-time.After(frequency):
			captureMemStats()
			captureCPUStats()
		}
	}
}

func reportSizeOfIndexDiskBackup(index Index, logger log.Logger) {
	reader, cancel, err := index.Reader()
	if err != nil {
		logger.Warn("Error getting reader", "error", err)
		return
	}
	defer cancel()

	// create a temp directory to store the index
	tmpDir, err := os.MkdirTemp("", "grafana.dashboard_index")
	if err != nil {
		logger.Error("can't create temp dir", "error", err)
		return
	}
	defer func() {
		err := os.RemoveAll(tmpDir)
		if err != nil {
			logger.Error("can't remove temp dir", "error", err, "tmpDir", tmpDir)
			return
		}
	}()

	cancelCh := make(chan struct{})
	err = reader.Backup(tmpDir, cancelCh)
	if err != nil {
		logger.Error("can't create index disk backup", "error", err)
		return
	}

	size, err := dirSize(tmpDir)
	if err != nil {
		logger.Error("can't calculate dir size", "error", err)
		return
	}

	logger.Warn("Size of index disk backup", "size", formatBytes(uint64(size)))
}
