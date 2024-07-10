package options

import (
	"runtime"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/spf13/pflag"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

type ProfilingOptions struct {
	logger             log.Logger
	blockProfilingRate int
	mutexProfilingRate int
}

func NewProfilingOptions(logger log.Logger) *ProfilingOptions {
	return &ProfilingOptions{
		logger: logger,
	}
}

func (o *ProfilingOptions) AddFlags(fs *pflag.FlagSet) {
	fs.IntVar(&o.blockProfilingRate, "grafana.profiling.block-rate", 0, "Controls the fraction of goroutine blocking events that are reported in the blocking profile. The profiler aims to sample an average of one blocking event per rate nanoseconds spent blocked. To turn off profiling entirely, use 0.")
	fs.IntVar(&o.mutexProfilingRate, "grafana.profiling.mutex-rate", 0, "Controls the fraction of mutex contention events that are reported in the mutex profile. On average 1/rate events are reported. To turn off mutex profiling entirely, use 0.")
}

func (o *ProfilingOptions) Validate() []error {
	return nil
}

func (o *ProfilingOptions) ApplyTo(config *genericapiserver.RecommendedConfig) error {
	if !config.EnableProfiling {
		return nil
	}

	// We bring our own block/mutex profiling configuration
	config.EnableContentionProfiling = false

	runtime.SetBlockProfileRate(o.blockProfilingRate)
	runtime.SetMutexProfileFraction(o.mutexProfilingRate)

	o.logger.Info("Profiling enabled", "blockProfileRate", o.blockProfilingRate, "mutexProfileRate", o.mutexProfilingRate)

	return nil
}
