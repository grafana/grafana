package ssosettingsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ssosettings/models"
)

func (s *SSOSettingsService) getUsageStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	settings, err := s.store.List(ctx)
	if err != nil {
		return nil, err
	}

	configuredInDbCounter := 0
	for _, setting := range settings {
		if setting.Source == models.DB {
			configuredInDbCounter++
			m["stats.sso."+setting.Provider+".config.database.count"] = 1
		} else {
			m["stats.sso."+setting.Provider+".config.database.count"] = 0
		}
	}

	m["stats.sso.configured_in_db.count"] = configuredInDbCounter

	return m, nil
}
