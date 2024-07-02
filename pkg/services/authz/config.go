package authz

import (
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
)

type Mode string

func (s Mode) IsValid() bool {
	switch s {
	case ModeGRPC, ModeInProc:
		return true
	}
	return false
}

const (
	ModeGRPC   Mode = "grpc"
	ModeInProc Mode = "inproc"
)

type Cfg struct {
	env              string
	listen           bool
	mode             Mode
	remoteAddress    string
	token            string
	tokenExchangeUrl string
	tokenAudience    []string
	tokenNamespace   string
}

func ReadCfg(cfg *setting.Cfg) (*Cfg, error) {
	section := cfg.SectionWithEnvOverrides("authorization")

	mode := Mode(section.Key("mode").MustString(string(ModeInProc)))
	if !mode.IsValid() {
		return nil, fmt.Errorf("authorization: invalid mode %q", mode)
	}

	return &Cfg{
		env:              cfg.Env,
		listen:           section.Key("listen").MustBool(false),
		mode:             mode,
		remoteAddress:    section.Key("remote_address").MustString(""),
		token:            section.Key("token").MustString(""),
		tokenExchangeUrl: section.Key("token_exchange_url").MustString(""),
		tokenAudience:    []string{"authZService"},
		tokenNamespace:   "stack-" + cfg.StackID,
	}, nil
}
