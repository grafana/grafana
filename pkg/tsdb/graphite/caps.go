package graphite

import (
	"os"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// caps bounds the memory a single request can consume. The /render and
// resource-call paths read upstream bodies into memory, and the resource
// handler accepts inbound request bodies; without limits a large or
// adversarial payload can force disproportionate heap allocation.
type caps struct {
	renderResponseMaxBytes   int64
	resourceResponseMaxBytes int64
	resourceRequestMaxBytes  int64
}

const (
	defaultRenderResponseMaxBytes   int64 = 200 << 20 // 200 MiB, aligned with the plugin gRPC receive ceiling
	defaultResourceResponseMaxBytes int64 = 32 << 20  // 32 MiB
	defaultResourceRequestMaxBytes  int64 = 1 << 20   // 1 MiB

	// Defence-in-depth bounds on operator-supplied overrides. The floor
	// rejects values so small every legitimate response would fail (a typo);
	// the ceiling rejects values large enough to re-introduce the OOM risk
	// these caps exist to mitigate.
	capMinBytes int64 = 1 << 10 // 1 KiB
	capMaxBytes int64 = 1 << 30 // 1 GiB
)

// loadCaps reads operator-configurable overrides from GF_PLUGIN_* environment
// variables. When this datasource runs as a standalone plugin process, Grafana
// delivers the [plugin.graphite] configuration section as these variables;
// when it runs in-process they can be set directly on the Grafana server
// process. An unset, empty, unparseable, or non-positive value uses the
// built-in default; an out-of-range positive value is clamped to [capMinBytes,
// capMaxBytes] with a warning.
func loadCaps() caps {
	return caps{
		renderResponseMaxBytes:   capFromEnv("GF_PLUGIN_RENDER_RESPONSE_MAX_BYTES", defaultRenderResponseMaxBytes),
		resourceResponseMaxBytes: capFromEnv("GF_PLUGIN_RESOURCE_RESPONSE_MAX_BYTES", defaultResourceResponseMaxBytes),
		resourceRequestMaxBytes:  capFromEnv("GF_PLUGIN_RESOURCE_REQUEST_MAX_BYTES", defaultResourceRequestMaxBytes),
	}
}

// renderResponse, resourceResponse, and resourceRequest return the effective
// cap, falling back to the built-in default when the field is unset (zero).
// This keeps a zero-value caps{} safe: it enforces the defaults rather than a
// 0-byte limit.
func (c caps) renderResponse() int64 {
	return orDefault(c.renderResponseMaxBytes, defaultRenderResponseMaxBytes)
}
func (c caps) resourceResponse() int64 {
	return orDefault(c.resourceResponseMaxBytes, defaultResourceResponseMaxBytes)
}
func (c caps) resourceRequest() int64 {
	return orDefault(c.resourceRequestMaxBytes, defaultResourceRequestMaxBytes)
}

func orDefault(v, def int64) int64 {
	if v > 0 {
		return v
	}
	return def
}

func capFromEnv(key string, def int64) int64 {
	raw := os.Getenv(key)
	if raw == "" {
		return def
	}

	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || v <= 0 {
		backend.Logger.Warn("Ignoring invalid graphite body-size cap; using default", "key", key, "value", raw, "default", def)
		return def
	}
	if v < capMinBytes {
		backend.Logger.Warn("Graphite body-size cap below safe minimum; clamping", "key", key, "configured", v, "min", capMinBytes)
		return capMinBytes
	}
	if v > capMaxBytes {
		backend.Logger.Warn("Graphite body-size cap above safe maximum; clamping", "key", key, "configured", v, "max", capMaxBytes)
		return capMaxBytes
	}
	return v
}
