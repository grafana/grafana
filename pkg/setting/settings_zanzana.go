package setting

import (
	"slices"
)

type ZanzanaMode string

const (
	ZanzanaModeClient   = "client"
	ZanzanaModeEmbedded = "embedded"
)

type ZanzanaSettings struct {
	// Addr is only used when mode is set to client
	Addr string
	// Mode can either be embedded or client
	Mode ZanzanaMode
}

func (c *Cfg) readZanzanaSettings() {
	s := ZanzanaSettings{}

	sec := c.Raw.Section("zanzana")
	s.Mode = ZanzanaMode(sec.Key("mode").MustString("embedded"))

	validModes := []ZanzanaMode{ZanzanaModeEmbedded, ZanzanaModeClient}

	if slices.Contains(validModes, s.Mode) {
		c.Logger.Warn("Invalid zanzana mode", "expected", validModes, "got", s.Mode)
		s.Mode = "embedded"
	}

	c.Zanzana = s
}
