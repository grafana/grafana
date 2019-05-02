package Reload

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
)

var (
	ErrConcurrentReloadNotAllowed = errors.New("Another reload instance is already in progress.")
)

type ReloadService struct {
	log             log.Logger
	Bus             bus.Bus `inject:""`
	pluginReloading bool
	ldapReloading   bool
}

func init() {
	registry.RegisterService(&ReloadService{})
}

func (r *ReloadService) Init() error {
	r.log = log.New("Reload")
	r.Bus.AddHandler(r.ReloadLdapConf)

	return nil
}

func (r ReloadService) Run() error {
	return nil
}

func (r *ReloadService) ReloadLdapConf(cmd *m.ReloadLdapCfgCmd) error {
	r.log.Info("Reloading ldap config...")

	if r.ldapReloading {
		r.log.Warn("Cannot reload ldap config as another reload is already in progress.")
		return ErrConcurrentReloadNotAllowed
	}

	r.ldapReloading = true

	//if err := login.LoadLdapConfig(false); err != nil {
	//	r.ldapReloading = false
	//	r.log.Warn("Cannot reload Ldap config due to %s", err.Error())
	//	return err
	//}

	r.ldapReloading = false
	r.log.Info("Ldap config reloaded.")

	return nil
}
