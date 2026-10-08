package config

import (
	"fmt"
	"maps"
	"math"
	"slices"
	"strconv"
	"strings"
)

// MemoryLimitKey is the [plugin.<id>] setting that Grafana passes to the plugin process as GOMEMLIMIT.
const MemoryLimitKey = "memory_limit"

var memoryLimitUnits = map[string]uint{"B": 0, "KiB": 10, "MiB": 20, "GiB": 30, "TiB": 40}

// MemoryLimit returns the memory_limit setting of a plugin, or "" when it is not set.
func (ps PluginSettings) MemoryLimit(pluginID string) string {
	settings := ps[pluginID]
	for _, k := range slices.Sorted(maps.Keys(settings)) {
		if strings.EqualFold(k, MemoryLimitKey) {
			return settings[k]
		}
	}
	return ""
}

// ValidateMemoryLimit returns an error unless v is "off" or a positive byte count with a B, KiB, MiB, GiB or TiB
// suffix that fits in an int64, which is what the Go runtime accepts in GOMEMLIMIT without aborting the process.
func ValidateMemoryLimit(v string) error {
	if v == "off" {
		return nil
	}
	unit := strings.TrimLeft(v, "0123456789")
	shift, ok := memoryLimitUnits[unit]
	if !ok {
		return invalidMemoryLimit(v)
	}
	n, err := strconv.ParseUint(strings.TrimSuffix(v, unit), 10, 64)
	if err != nil || n == 0 || n > math.MaxInt64>>shift {
		return invalidMemoryLimit(v)
	}
	return nil
}

func invalidMemoryLimit(v string) error {
	return fmt.Errorf("invalid memory limit %q, expected off or a positive byte count with a B, KiB, MiB, GiB or TiB suffix such as 512MiB", v)
}
