package alerting

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
)

type AlertRuleProvisioner interface {
	Provision(ctx context.Context, path string) error
}

func NewAlertRuleProvisioner() AlertRuleProvisioner {
	return &DefaultAlertRuleProvisioner{
		Logger: log.New("provisioning-alertrules"),
	}
}

type DefaultAlertRuleProvisioner struct {
	Logger log.Logger
}

func (prov *DefaultAlertRuleProvisioner) Provision(ctx context.Context, path string) error {
	prov.Logger.Info("starting to provision the alertmanager")
	prov.Logger.Info("finished to provision the alertmanager")
	return nil
}
