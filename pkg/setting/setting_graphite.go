package setting

import (
	"gopkg.in/ini.v1"
)

// Defence-in-depth bounds applied to operator-supplied tsdb.graphite caps.
// A value of 0 means "use the built-in default" and bypasses clamping. The
// floor catches values so small that every legitimate response would fail
// (almost certainly a typo). The ceiling catches values so large they
// defeat the purpose of the cap (re-introducing the OOM risk these knobs
// exist to mitigate). Operators with genuinely unusual needs sit
// comfortably inside [1 KiB, 1 GiB].
const (
	graphiteCapMinBytes int64 = 1 << 10 // 1 KiB
	graphiteCapMaxBytes int64 = 1 << 30 // 1 GiB
)

func readGraphiteSettings(iniFile *ini.File, cfg *Cfg) error {
	graphite := iniFile.Section("tsdb.graphite")
	cfg.GraphiteRenderResponseMaxBytes = clampGraphiteCap(cfg, graphite.Key("render_response_max_bytes").MustInt64(0), "tsdb.graphite.render_response_max_bytes")
	cfg.GraphiteResourceResponseMaxBytes = clampGraphiteCap(cfg, graphite.Key("resource_response_max_bytes").MustInt64(0), "tsdb.graphite.resource_response_max_bytes")
	cfg.GraphiteResourceRequestMaxBytes = clampGraphiteCap(cfg, graphite.Key("resource_request_max_bytes").MustInt64(0), "tsdb.graphite.resource_request_max_bytes")
	return nil
}

// clampGraphiteCap enforces sane bounds on an operator-supplied byte cap.
// A zero (or negative) value is passed through unchanged so the consuming
// service falls back to its built-in default. Out-of-range positive values
// are clamped and a warning is logged so the misconfiguration is visible
// at startup rather than silently degrading runtime behaviour.
func clampGraphiteCap(cfg *Cfg, v int64, key string) int64 {
	if v <= 0 {
		return 0
	}
	if v < graphiteCapMinBytes {
		cfg.Logger.Warn("Graphite cap configured below safe minimum; clamping", "key", key, "configured", v, "min", graphiteCapMinBytes)
		return graphiteCapMinBytes
	}
	if v > graphiteCapMaxBytes {
		cfg.Logger.Warn("Graphite cap configured above safe maximum; clamping", "key", key, "configured", v, "max", graphiteCapMaxBytes)
		return graphiteCapMaxBytes
	}
	return v
}
