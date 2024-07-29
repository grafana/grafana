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
	remoteAddress string
	listen        bool
	mode          Mode
}

func ReadCfg(cfg *setting.Cfg) (*Cfg, error) {
	section := cfg.SectionWithEnvOverrides("authorization")

	mode := Mode(section.Key("mode").MustString(string(ModeInProc)))
	if !mode.IsValid() {
		return nil, fmt.Errorf("authorization: invalid mode %q", mode)
	}

	return &Cfg{
		remoteAddress: section.Key("remote_address").MustString(""),
		listen:        section.Key("listen").MustBool(false),
		mode:          mode,
	}, nil
}
