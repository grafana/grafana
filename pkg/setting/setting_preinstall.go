package setting

import "time"

const DefaultPreinstallPluginsSyncTimeout = 5 * time.Minute

// PreinstallPluginsSyncTimeout returns the maximum time allowed for synchronous
// plugin preinstallation during startup.
func PreinstallPluginsSyncTimeout(cfg *Cfg) time.Duration {
	if cfg == nil || cfg.Raw == nil {
		return DefaultPreinstallPluginsSyncTimeout
	}

	return cfg.Raw.Section("plugins").Key("preinstall_sync_timeout").MustDuration(DefaultPreinstallPluginsSyncTimeout)
}
