package setting

import "time"

const DefaultPreinstallPluginsSyncTimeout time.Duration = 0

// PreinstallPluginsSyncTimeout returns the optional maximum time allowed for
// synchronous plugin preinstallation during startup. A value <= 0 disables the timeout.
func PreinstallPluginsSyncTimeout(cfg *Cfg) time.Duration {
	if cfg == nil || cfg.Raw == nil {
		return DefaultPreinstallPluginsSyncTimeout
	}

	return cfg.Raw.Section("plugins").Key("preinstall_sync_timeout").MustDuration(DefaultPreinstallPluginsSyncTimeout)
}
