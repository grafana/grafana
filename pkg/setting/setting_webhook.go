package setting

import (
	"time"
)

const (
	DefaultWebhooksTimeout = 30 * time.Second
)

type WebhooksSettings struct {
	Timeout time.Duration
}

func (cfg *Cfg) readWebhooksSettings() {
	sec := cfg.Raw.Section("webhooks")
	cfg.Webhooks.Timeout = sec.Key("timeout").MustDuration(DefaultWebhooksTimeout)
}
