package sso

import (
	"context"
	"fmt"
	"time"

	"github.com/open-feature/go-sdk/openfeature"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/login/social"
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
}

// SSOSettingsBackfill copies the stored SSO overrides into MT-Settings so the
// store is populated before reads become MT-authoritative (dual-writer mode 4).
type SSOSettingsBackfill struct {
	reader storedLister
	writer settingsvc.Writer
	lock   *serverlock.ServerLockService
	cfg    *setting.Cfg
	log    log.Logger
}

func ProvideSSOSettingsBackfill(reader *ssosettingsimpl.Service, lock *serverlock.ServerLockService, cfg *setting.Cfg) (*SSOSettingsBackfill, error) {
	client, err := NewSettingsClient(cfg)
	if err != nil {
		return nil, err
	}
	writer, ok := client.(settingsvc.Writer)
	if !ok {
		return nil, fmt.Errorf("settings client does not implement the writer interface")
	}
	return &SSOSettingsBackfill{
		reader: reader,
		writer: writer,
		lock:   lock,
		cfg:    cfg,
		log:    log.New("ssosettings.backfill"),
	}, nil
}

// IsDisabled implements registry.CanBeDisabled.
func (s *SSOSettingsBackfill) IsDisabled() bool {
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
	stored, err := s.reader.ListStored(ctx)
	if err != nil {
		return err
	}

	providers, keys := 0, 0
	for _, provider := range stored {
		// LDAP nests its config under servers[]; MT-Settings has no representation for it yet.
		if provider.Provider == social.LDAPProviderName {
			continue
		}
		section := sectionFor(provider.Provider)
		for key, val := range provider.Settings {
			if err := s.writer.Upsert(ctx, &settingsvc.Setting{Section: section, Key: key, Value: valueToString(val)}); err != nil {
				return err
			}
			keys++
		}
		providers++
	}

	s.log.Info("Backfilled SSO settings into MT-Settings", "providers", providers, "keys", keys)
	return nil
}
