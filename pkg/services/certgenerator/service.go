package certgenerator

import (
	"path/filepath"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana-apiserver/pkg/certgenerator"
)

const (
	DefaultAPIServerIp = "127.0.0.1"
)

var (
	_ services.NamedService = (*certgenerator.Service)(nil)
)

type service struct {
	*services.BasicService
	cfg      *setting.Cfg
	certUtil *certgenerator.CertUtil
	Log      log.Logger
}

func ProvideService(cfg *setting.Cfg) (*certgenerator.Service, error) {
	return certgenerator.CreateService(modules.CertGenerator, filepath.Join(cfg.DataPath, "k8s"))
}
