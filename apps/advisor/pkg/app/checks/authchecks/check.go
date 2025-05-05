package authchecks

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ssosettings"
)

const (
	CheckID = "ssosetting"
)

var _ checks.Check = (*check)(nil)

type check struct {
	ssoSettingsService ssosettings.Service
	log                log.Logger
}

func New(ssoSettingsService ssosettings.Service) checks.Check {
	return &check{
		ssoSettingsService: ssoSettingsService,
		log:                log.New("advisor.ssosettingcheck"),
	}
}

func (c *check) ID() string {
	return CheckID
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{
		&listFormatValidation{},
	}
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	ssoSettings, err := c.ssoSettingsService.ListWithRedactedSecrets(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list SSO settings: %w", err)
	}
	res := make([]any, len(ssoSettings))
	for i, ds := range ssoSettings {
		res[i] = ds
	}
	return res, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	ssoSetting, err := c.ssoSettingsService.GetForProviderWithRedactedSecrets(ctx, id)
	if err != nil {
		return nil, err
	}
	return ssoSetting, nil
}
