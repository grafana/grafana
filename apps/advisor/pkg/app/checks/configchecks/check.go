package configchecks

import (
	"context"
	"strings"

	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/setting"
)

var _ checks.Check = (*check)(nil)

type check struct {
	cfg             *setting.Cfg
	isCloudInstance bool
}

func New(cfg *setting.Cfg) checks.Check {
	return &check{
		cfg:             cfg,
		isCloudInstance: cfg.StackID != "",
	}
}

func (c *check) ID() string {
	return "config"
}

func (c *check) Name() string {
	return "config setting"
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	res := make([]any, 0)

	// Always check the security section
	res = append(res, "security.secret_key")

	if !c.isCloudInstance {
		// Add all configured secrets manager encryption providers with secret_key
		kmsProviders := c.cfg.SecretsManagement.ConfiguredKMSProviders
		for providerName := range kmsProviders {
			if strings.Contains(providerName, "secret_key") {
				res = append(res, "secrets_manager.encryption."+providerName)
			}
		}
	}

	return res, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	return id, nil
}

func (c *check) Init(ctx context.Context) error {
	return nil
}

func (c *check) Steps() []checks.Step {
	resSteps := make([]checks.Step, 0)
	resSteps = append(resSteps, &securityConfigStep{
		securitySection: c.cfg.SectionWithEnvOverrides("security"),
	})

	if !c.isCloudInstance {
		secretsManagerProviders := make(map[string]map[string]string)
		for providerName, config := range c.cfg.SecretsManagement.ConfiguredKMSProviders {
			if strings.Contains(providerName, "secret_key") {
				secretsManagerProviders[providerName] = config
			}
		}
		resSteps = append(resSteps, &secretsManagerConfigStep{
			secretsManagerProviders: secretsManagerProviders,
		})
	}

	return resSteps
}
