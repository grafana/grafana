package ssosettingsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ssosettings/models"
)

func (s *Service) getUsageStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	settings, err := s.store.List(ctx)
	if err != nil {
		return nil, err
	}

	configuredInDbCounter := 0
	for _, setting := range settings {
		enabledValue := 0
		if setting.Source == models.DB {
			configuredInDbCounter++
			enabledValue = 1
		}
		m["stats.sso."+setting.Provider+".config.database.count"] = enabledValue
	}

	m["stats.sso.configured_in_db.count"] = configuredInDbCounter

	return m, nil
}
