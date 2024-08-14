package setting

import "runtime"

type DiagnosticsSettings struct {
	Profile              bool
	ProfileAddr          string
	ProfilePort          uint64
	ProfileBlockRate     int
	ProfileMutexFraction int
	ProfileContention    bool
	Tracing              bool
	TracingFile          string
}

func (cfg *Cfg) readDiagnosticsSettings() {
	diagnostics := cfg.Raw.Section("diagnostics")

	cfg.Diagnostics.Profile = diagnostics.Key("profiling_enabled").MustBool(false)
	cfg.Diagnostics.ProfileAddr = diagnostics.Key("profiling_addr").MustString("localhost")
	cfg.Diagnostics.ProfilePort = diagnostics.Key("profiling_port").MustUint64(6060)
	cfg.Diagnostics.ProfileBlockRate = diagnostics.Key("profiling_block_rate").MustInt(1)
	cfg.Diagnostics.ProfileMutexFraction = diagnostics.Key("profiling_mutex_rate").MustInt(runtime.SetMutexProfileFraction(-1))
	cfg.Diagnostics.ProfileContention = diagnostics.Key("profiling_contention").MustBool(false)

	cfg.Diagnostics.Tracing = diagnostics.Key("tracing_enabled").MustBool(false)
	cfg.Diagnostics.TracingFile = diagnostics.Key("tracing_file").MustString("trace.out")
}

func (cfg *Cfg) OverrideDiagnosticProfileSettings(profile bool, profileAddr string, profilePort uint64, profileBlockRate int, profileMutexFraction int, profileContention bool) {
	if profile {
		cfg.Diagnostics.Profile = profile
	}
	cfg.Diagnostics.ProfileAddr = profileAddr
	cfg.Diagnostics.ProfilePort = profilePort
	cfg.Diagnostics.ProfileBlockRate = profileBlockRate
	cfg.Diagnostics.ProfileMutexFraction = profileMutexFraction
	cfg.Diagnostics.ProfileContention = profileContention
}
