package ssosettingsimpl

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
)

// TestMergeSSOSettingsMTAuthoritative pins the source label on the MT-authoritative
// read path: MT-served settings are the base and the DB only fills gaps, but when
// DB overrides exist the merged result must report the DB source, not the MT
// fallback's System source.
func TestMergeSSOSettingsMTAuthoritative(t *testing.T) {
	s := &Service{logger: log.NewNopLogger()}

	t.Run("reports the DB source and lets the DB fill only gaps", func(t *testing.T) {
		db := &models.SSOSettings{
			Provider: "generic_oauth",
			Source:   models.DB,
			Settings: map[string]any{"client_id": "db-id", "auth_url": "https://idp/auth", "extra": "dbval"},
		}
		mtServed := &models.SSOSettings{
			Provider: "generic_oauth",
			Source:   models.System,
			Settings: map[string]any{"client_id": "mt-id", "auth_url": "", "name": "OAuth"},
		}

		merged := s.mergeSSOSettingsMTAuthoritative(db, mtServed)

		assert.Equal(t, models.SettingsSource(models.DB), merged.Source, "overrides present -> DB source, not System")
		assert.Equal(t, "mt-id", merged.Settings["client_id"])           // MT wins over DB
		assert.Equal(t, "https://idp/auth", merged.Settings["auth_url"]) // MT empty -> DB fills the gap
		assert.Equal(t, "OAuth", merged.Settings["name"])                // MT-only key kept
		assert.Equal(t, "dbval", merged.Settings["extra"])               // MT missing -> DB fills the gap
	})

	t.Run("returns the MT-served settings unchanged when there are no DB overrides", func(t *testing.T) {
		mtServed := &models.SSOSettings{Provider: "generic_oauth", Source: models.System}
		merged := s.mergeSSOSettingsMTAuthoritative(nil, mtServed)
		assert.Same(t, mtServed, merged)
		assert.Equal(t, models.SettingsSource(models.System), merged.Source)
	})
}
