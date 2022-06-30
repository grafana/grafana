package alerting

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
)

type AlertmanagerProvisionerConfig struct {
	ContactPointPath string
	TemplatesPath    string
	PolicyPath       string
	MuteTimesPath    string
}

type AlertmanagerProvisioner interface {
	Provision(ctx context.Context, cfg AlertmanagerProvisionerConfig) error
}

func NewAlertmanagerProvisioner() AlertmanagerProvisioner {
	return &DefaultAlertmanagerProvisioner{
		Logger: log.New("provisioning-alertmanager"),
	}
}

type DefaultAlertmanagerProvisioner struct {
	Logger log.Logger
}

func (prov *DefaultAlertmanagerProvisioner) Provision(ctx context.Context, cfg AlertmanagerProvisionerConfig) error {
	prov.Logger.Info("starting to provision alertmanager")
	prov.Logger.Info("finished to provision alertmanager")
	return nil
}
