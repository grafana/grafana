package sso

import (
	"context"
	"fmt"

	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/configprovider"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/setting"
)

type iniLister interface {
	ListAsIni(ctx context.Context, selector metav1.LabelSelector) (*ini.File, error)
}

type tenantConfigProvider struct {
	settings iniLister
}

var _ configprovider.ConfigProvider = (*tenantConfigProvider)(nil)

// NewTenantConfigProvider returns a ConfigProvider that resolves a tenant's settings
// from the settings service using the namespace in ctx. Get returns a partial Cfg
// with only the login fields set.
func NewTenantConfigProvider(svc settingsvc.Service) configprovider.ConfigProvider {
	return &tenantConfigProvider{settings: svc}
}

func (t *tenantConfigProvider) Get(ctx context.Context) (*setting.Cfg, error) {
	iniFile, err := t.GetSections(ctx, "auth", "auth.ldap", "users")
	if err != nil {
		return nil, err
	}

	cfg := setting.NewCfg()
	if err = cfg.ApplyLoginSettings(iniFile); err != nil {
		return nil, fmt.Errorf("apply login settings: %w", err)
	}

	return cfg, nil
}

func (t *tenantConfigProvider) GetSections(ctx context.Context, sections ...string) (*ini.File, error) {
	if len(sections) == 0 {
		return ini.Empty(), nil
	}

	iniFile, err := t.settings.ListAsIni(ctx, metav1.LabelSelector{
		MatchExpressions: []metav1.LabelSelectorRequirement{
			{
				Key:      "section",
				Operator: metav1.LabelSelectorOpIn,
				Values:   sections,
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("list tenant settings %v: %w", sections, err)
	}
	if iniFile == nil {
		return ini.Empty(), nil
	}

	return iniFile, nil
}
