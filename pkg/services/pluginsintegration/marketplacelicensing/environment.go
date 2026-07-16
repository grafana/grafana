package marketplacelicensing

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
)

type Environment interface {
	AppURL() string
	Prepare(context.Context, string) (string, error)
}

type OSSEnvironment struct {
	appURL string
}

func ProvideEnvironment(cfg *setting.Cfg) Environment {
	return &OSSEnvironment{appURL: cfg.AppURL}
}

func (e *OSSEnvironment) AppURL() string {
	return e.appURL
}

func (e *OSSEnvironment) Prepare(context.Context, string) (string, error) {
	return "", nil
}
