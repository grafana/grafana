package setting

import (
	"slices"
)

type ZanzanaMode string

const (
	ZanzanaModeClient   ZanzanaMode = "client"
	ZanzanaModeEmbedded ZanzanaMode = "embedded"
)

type ZanzanaSettings struct {
	// Addr is only used when mode is set to client
	Addr string
	// Mode can either be embedded or client
	Mode ZanzanaMode
	// ListenHTTP enables OpenFGA http server which allows to use fga cli
	ListenHTTP bool
	// OpenFGA http server address which allows to connect with fga cli
	HttpAddr string
	// Number of check requests running concurrently
	ConcurrentChecks int64
	// If enabled, authorization cheks will be only performed by zanzana.
	// This bypasses the performance comparison with the legacy system.
	ZanzanaOnlyEvaluation bool
}

func (cfg *Cfg) readZanzanaSettings() {
	s := ZanzanaSettings{}

	sec := cfg.Raw.Section("zanzana")
	s.Mode = ZanzanaMode(sec.Key("mode").MustString("embedded"))

	validModes := []ZanzanaMode{ZanzanaModeEmbedded, ZanzanaModeClient}

	if !slices.Contains(validModes, s.Mode) {
		cfg.Logger.Warn("Invalid zanzana mode", "expected", validModes, "got", s.Mode)
		s.Mode = "embedded"
	}

	s.Addr = sec.Key("address").MustString("")
	s.ListenHTTP = sec.Key("listen_http").MustBool(false)
	s.HttpAddr = sec.Key("http_addr").MustString("127.0.0.1:8080")
	s.ConcurrentChecks = sec.Key("concurrent_checks").MustInt64(10)
	s.ZanzanaOnlyEvaluation = sec.Key("zanzana_only_evaluation").MustBool(false)

	cfg.Zanzana = s
}
