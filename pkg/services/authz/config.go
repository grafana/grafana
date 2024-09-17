package authz

import (
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
)

type Mode string

func (s Mode) IsValid() bool {
	switch s {
	case ModeGRPC, ModeInProc, ModeCloud:
		return true
	}
	return false
}

const (
	ModeGRPC   Mode = "grpc"
	ModeInProc Mode = "inproc"
	ModeCloud  Mode = "cloud"
)

type Cfg struct {
	remoteAddress string
	listen        bool
	mode          Mode

	token            string
	tokenExchangeURL string
	tokenNamespace   string
}

func ReadCfg(cfg *setting.Cfg) (*Cfg, error) {
	section := cfg.SectionWithEnvOverrides("authorization")

	mode := Mode(section.Key("mode").MustString(string(ModeInProc)))
	if !mode.IsValid() {
		return nil, fmt.Errorf("authorization: invalid mode %q", mode)
	}

	token := section.Key("token").MustString("")
	tokenExchangeURL := section.Key("token_exchange_url").MustString("")
	tokenNamespace := section.Key("token_namespace").MustString("stack-" + cfg.StackID)

	if mode == ModeCloud && token == "" && tokenExchangeURL == "" {
		return nil, fmt.Errorf("authorization:  missing token or tokenExchangeUrl")
	}

	return &Cfg{
		remoteAddress:    section.Key("remote_address").MustString(""),
		listen:           section.Key("listen").MustBool(false),
		mode:             mode,
		token:            token,
		tokenExchangeURL: tokenExchangeURL,
		tokenNamespace:   tokenNamespace,
	}, nil
}
