package sso

import (
	"context"
	"fmt"
	"maps"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/endpoints/request"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/login/social"
	grafanarequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	ssomodels "github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingsimpl"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	backfillLockName    = "sso settings mt-settings backfill"
	backfillLockMaxWait = 5 * time.Minute
)

type storedLister interface {
	ListStored(ctx context.Context) ([]*ssomodels.SSOSettings, error)
	GetDefaults(provider string) map[string]any
}

// SSOSettingsBackfill copies the stored SSO overrides into MT-Settings so the
// store is populated before reads become MT-authoritative (dual-writer mode 4).
type SSOSettingsBackfill struct {
	reader    storedLister
	writer    settingsvc.Writer
	lock      *serverlock.ServerLockService
	cfg       *setting.Cfg
	namespace string
	log       log.Logger
}

func ProvideSSOSettingsBackfill(reader *ssosettingsimpl.Service, lock *serverlock.ServerLockService, cfg *setting.Cfg) (*SSOSettingsBackfill, error) {
	b := &SSOSettingsBackfill{
		reader: reader,
		lock:   lock,
		cfg:    cfg,
		// Instance-global; the background context carries no namespace of its own.
		namespace: grafanarequest.GetNamespaceMapper(cfg)(1),
		log:       log.New("ssosettings.backfill"),
	}

	// No settings service (default/on-prem): stay disabled, don't fail startup.
	client, err := NewSettingsClient(cfg)
	if err != nil {
		b.log.Debug("MT-Settings client unavailable, SSO settings backfill disabled", "error", err)
		return b, nil
	}
	writer, ok := client.(settingsvc.Writer)
	if !ok {
		return nil, fmt.Errorf("settings client does not implement the writer interface")
	}
	b.writer = writer
	return b, nil
}

// IsDisabled implements registry.CanBeDisabled.
func (s *SSOSettingsBackfill) IsDisabled() bool {
	if s.writer == nil {
		return true
	}
	enabled, _ := openfeature.NewDefaultClient().BooleanValue(context.Background(),
		featuremgmt.FlagGrafanaSsoSettingsToMTSettings, false, openfeature.EvaluationContext{})
	if !enabled {
		return true
	}
	// At mode 4+ MT-Settings is authoritative and the DB is no longer the source, so there is nothing to backfill.
	mode := grafanarest.Mode0
	if resCfg, ok := s.cfg.UnifiedStorage[resource.GroupResource().String()]; ok {
		mode = resCfg.DualWriterMode
	}
	return mode >= grafanarest.Mode4
}

// Run implements registry.BackgroundService. It runs one backfill pass and returns.
func (s *SSOSettingsBackfill) Run(ctx context.Context) error {
	// Only one replica should backfill; errors are logged, not returned, so a failure never blocks startup.
	if err := s.lock.LockExecuteAndRelease(ctx, backfillLockName, backfillLockMaxWait, func(ctx context.Context) {
		if err := s.backfill(ctx); err != nil {
			s.log.Error("Failed to backfill SSO settings into MT-Settings", "error", err)
		}
	}); err != nil {
		s.log.Debug("Skipping backfill, lock held by another instance", "error", err)
	}
	return nil
}

func (s *SSOSettingsBackfill) backfill(ctx context.Context) error {
	// The MT-Settings writer resolves the tenant from the context namespace.
	ctx = request.WithNamespace(ctx, s.namespace)

	stored, err := s.reader.ListStored(ctx)
	if err != nil {
		return err
	}

	backfilledProviders := make([]string, 0, len(stored))
	keys := 0
	for _, provider := range stored {
		// LDAP nests its config under servers[]; MT-Settings has no representation for it yet.
		if provider.Provider == social.LDAPProviderName {
			continue
		}
		settings := provider.Settings
		if defaults := s.reader.GetDefaults(provider.Provider); defaults != nil {
			settings = withDefaults(settings, defaults)
		}
		section := sectionFor(provider.Provider)
		for key, val := range settings {
			if err := s.writer.Upsert(ctx, &settingsvc.Setting{Section: section, Key: key, Value: valueToString(val)}); err != nil {
				return err
			}
			keys++
		}
		backfilledProviders = append(backfilledProviders, provider.Provider)
	}

	s.log.Info("Backfilled SSO settings into MT-Settings", "providers", backfilledProviders, "keys", keys)
	return nil
}

// withDefaults returns a copy of settings with defaults filled in for any key
// that is absent or set to an empty string.
func withDefaults(settings map[string]any, defaults map[string]any) map[string]any {
	if len(defaults) == 0 {
		return settings
	}
	result := make(map[string]any, len(settings)+len(defaults))
	maps.Copy(result, settings)
	for key, def := range defaults {
		v, ok := result[key]
		if !ok {
			result[key] = def
			continue
		}
		if str, isStr := v.(string); isStr && str == "" {
			result[key] = def
		}
	}
	return result
}
