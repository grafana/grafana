package librarypanels

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
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
	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"panelLibrary": true}

	lps := LibraryPanelService{
		SQLStore: nil,
		Cfg:      cfg,
	}

	overrideServiceFunc := func(d registry.Descriptor) (*registry.Descriptor, bool) {
		descriptor := registry.Descriptor{
			Name:         "LibraryPanelService",
			Instance:     &lps,
			InitPriority: 0,
		}

		return &descriptor, true
	}

	registry.RegisterOverride(overrideServiceFunc)

	sqlStore := sqlstore.InitTestDB(t)
	lps.SQLStore = sqlStore

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

	return lps, user
}
