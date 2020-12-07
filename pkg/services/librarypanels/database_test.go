package librarypanels

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestAddLibraryPanel(t *testing.T) {
	t.Run("should fail if library panel already exists", func(t *testing.T) {
		lps, user := setupTestEnv(t, models.ROLE_EDITOR)
		command := addLibraryPanelCommand{
			OrgId:        1,
			FolderId:     1,
			SignedInUser: &user,
			Title:        "Text - Library Panel",
			Model: []byte(`
	{
      "datasource": "${DS_GDEV-TESTDATA}",
      "id": 1,
      "title": "Text - Library Panel",
      "type": "text"
    }
`),
		}

		noErr := lps.addLibraryPanel(&command)
		require.NoError(t, noErr)

		err := lps.addLibraryPanel(&command)
		require.Error(t, err)
	})
}

func setupTestEnv(t *testing.T, orgRole models.RoleType) (LibraryPanelService, models.SignedInUser) {
	cfg := setting.Cfg{}
	cfg.FeatureToggles = map[string]bool{"panelLibrary": true}
	sqlStore := sqlstore.InitTestDBWithCfg(t, &cfg)
	user := models.SignedInUser{
		UserId:         1,
		OrgId:          1,
		OrgName:        "",
		OrgRole:        orgRole,
		Login:          "",
		Name:           "",
		Email:          "",
		ApiKeyId:       0,
		OrgCount:       0,
		IsGrafanaAdmin: false,
		IsAnonymous:    false,
		HelpFlags1:     0,
		LastSeenAt:     time.Now(),
		Teams:          nil,
	}
	lps := LibraryPanelService{
		SQLStore: sqlStore,
		Cfg:      &cfg,
	}
	return lps, user
}
