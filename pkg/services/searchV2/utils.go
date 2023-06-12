package searchV2

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
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
