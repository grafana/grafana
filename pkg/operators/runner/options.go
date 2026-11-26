package runner

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

// Options are the [operator] keys every operator shares. An operator sets its
// own defaults in [Operator.Defaults], and the runner resolves them into
// [Runtime.Options].
//
// [operator]
// worker_count =
// resync_interval =
// drain_timeout =
type Options struct {
	Workers int
	Resync  time.Duration
	// NATSResync is the resync_interval default when [nats] is enabled, where
	// live events make frequent re-lists unnecessary. Zero uses Resync.
	NATSResync   time.Duration
	DrainTimeout time.Duration
}

func parseOptions(cfg *setting.Cfg, defaults Options) Options {
	resync := defaults.Resync
	if cfg.NATS.Enabled && defaults.NATSResync > 0 {
		resync = defaults.NATSResync
	}
	sec := cfg.SectionWithEnvOverrides("operator")
	return Options{
		Workers:      sec.Key("worker_count").MustInt(defaults.Workers),
		Resync:       sec.Key("resync_interval").MustDuration(resync),
		DrainTimeout: sec.Key("drain_timeout").MustDuration(defaults.DrainTimeout),
	}
}

// validateExternalNATS rejects NATS settings an operator process cannot use:
// it runs no embedded server, so it must reach an external one.
func validateExternalNATS(cfg *setting.Cfg) error {
	if !cfg.NATS.Enabled {
		return nil
	}
	if cfg.NATS.Mode != setting.NATSModeExternal {
		return fmt.Errorf("[nats] mode must be %q for operators, got %q", setting.NATSModeExternal, cfg.NATS.Mode)
	}
	if len(cfg.NATS.ClientURLs) == 0 {
		return fmt.Errorf("[nats] client_urls must be set for operators")
	}
	return nil
}
