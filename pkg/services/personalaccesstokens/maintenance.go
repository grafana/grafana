package personalaccesstokens

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/secretscan"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	secretScanDefaultURL      = "https://secret-scanning.grafana.net"
	secretScanDefaultInterval = 5 * time.Minute
	cleanupInterval           = 6 * time.Hour
	// retention keeps revoked/expired rows around for audit before they are purged.
	retention = 90 * 24 * time.Hour
)

// Maintenance is a background service that purges stale tokens and revokes
// tokens reported as leaked by the secret scanning service.
type Maintenance struct {
	store        patstore.Store
	cfg          *setting.Cfg
	authInfo     login.AuthInfoService
	client       secretscan.CheckerClient
	scanEnabled  bool
	scanInterval time.Duration
	revoke       bool
	log          log.Logger
	now          func() time.Time
}

func ProvideMaintenance(store patstore.Store, cfg *setting.Cfg, authInfo login.AuthInfoService) (*Maintenance, error) {
	sec := cfg.SectionWithEnvOverrides("secretscan")
	m := &Maintenance{
		store:        store,
		cfg:          cfg,
		authInfo:     authInfo,
		scanEnabled:  sec.Key("enabled").MustBool(false),
		scanInterval: sec.Key("interval").MustDuration(secretScanDefaultInterval),
		revoke:       sec.Key("revoke").MustBool(true),
		log:          log.New("personalaccesstokens.maintenance"),
		now:          time.Now,
	}
	if m.scanInterval < time.Minute {
		m.scanInterval = secretScanDefaultInterval
	}
	if m.scanEnabled {
		client, err := secretscan.NewCheckerClient(sec.Key("base_url").MustString(secretScanDefaultURL), cfg.BuildVersion, cfg.Env == setting.Dev)
		if err != nil {
			return nil, fmt.Errorf("failed to create secretscan client: %w", err)
		}
		m.client = client
	}
	return m, nil
}

func (m *Maintenance) Run(ctx context.Context) error {
	cleanup := time.NewTicker(cleanupInterval)
	defer cleanup.Stop()

	var scanC <-chan time.Time
	if m.scanEnabled {
		t := time.NewTicker(m.scanInterval)
		defer t.Stop()
		scanC = t.C
	}

	var revalidateC <-chan time.Time
	if interval := m.cfg.PersonalAccessTokens.IdPRevalidateInterval; interval > 0 && m.authInfo != nil {
		t := time.NewTicker(interval)
		defer t.Stop()
		revalidateC = t.C
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-revalidateC:
			if !m.cfg.PersonalAccessTokens.Enabled {
				continue
			}
			if err := m.RevalidateIdP(ctx); err != nil {
				m.log.Warn("Failed to revalidate personal access token owners", "error", err)
			}
		case <-cleanup.C:
			if err := m.Cleanup(ctx); err != nil {
				m.log.Warn("Failed to clean up personal access tokens", "error", err)
			}
		case <-scanC:
			if !m.cfg.PersonalAccessTokens.Enabled {
				continue
			}
			if err := m.CheckLeaked(ctx); err != nil {
				m.log.Warn("Failed to check personal access tokens for leaks", "error", err)
			}
		}
	}
}

// Cleanup hard-deletes tokens that have been revoked or expired for longer than the retention period.
func (m *Maintenance) Cleanup(ctx context.Context) error {
	n, err := m.store.DeleteInactiveBefore(ctx, m.now().Add(-retention))
	if err != nil {
		return err
	}
	if n > 0 {
		m.log.Info("Deleted inactive personal access tokens", "count", n)
	}
	return nil
}

// CheckLeaked asks the secret scanning service about the hashes of all active tokens
// and revokes the reported ones. Only hashes leave the instance, never secrets.
func (m *Maintenance) CheckLeaked(ctx context.Context) error {
	if m.client == nil {
		return nil
	}
	tokens, err := m.store.ListActive(ctx)
	if err != nil {
		return fmt.Errorf("failed to list active tokens: %w", err)
	}
	if len(tokens) == 0 {
		return nil
	}
	byHash := make(map[string]*patstore.Token, len(tokens))
	hashes := make([]string, 0, len(tokens))
	for _, t := range tokens {
		byHash[t.TokenHash] = t
		hashes = append(hashes, t.TokenHash)
	}

	leaked, err := m.client.CheckTokens(ctx, hashes)
	if err != nil {
		return fmt.Errorf("failed to check tokens: %w", err)
	}
	for _, l := range leaked {
		t, ok := byHash[l.Hash]
		if !ok {
			continue
		}
		if m.revoke {
			if err := m.store.RevokeByID(ctx, t.ID, patstore.ReasonSecretLeak); err != nil {
				m.log.Error("Failed to revoke leaked personal access token; revoke manually", "error", err, "uid", t.UID, "user_id", t.UserID, "org_id", t.OrgID)
				continue
			}
		}
		m.log.Warn("Found leaked personal access token", "audit", true, "action", "secret_leak", "uid", t.UID,
			"user_id", t.UserID, "org_id", t.OrgID, "reported_at", l.ReportedAt, "revoked", m.revoke)
	}
	return nil
}
