package librarypanels

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestCreateLibraryPanel(t *testing.T) {
	t.Run("should fail if library panel already exists", func(t *testing.T) {
		lps, context := setupTestEnv(t, models.ROLE_EDITOR)
		command := addLibraryPanelCommand{
			FolderID: 1,
			Title:    "Text - Library Panel",
			Model: []byte(`
	{
      "datasource": "${DS_GDEV-TESTDATA}",
      "id": 1,
      "title": "Text - Library Panel",
      "type": "text"
    }
`),
		}

		response := lps.createHandler(&context, command)
		require.Equal(t, 200, response.Status())

		response = lps.createHandler(&context, command)
		require.Equal(t, 400, response.Status())

		t.Cleanup(registry.ClearOverrides)
	})
}

func setupMigrations(cfg *setting.Cfg) LibraryPanelService {
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

	return lps
}

func setupTestEnv(t *testing.T, orgRole models.RoleType) (LibraryPanelService, models.ReqContext) {
	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"panelLibrary": true}

	service := setupMigrations(cfg)

	sqlStore := sqlstore.InitTestDB(t)
	service.SQLStore = sqlStore

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

	context := models.ReqContext{
		Context:        nil,
		SignedInUser:   &user,
		UserToken:      nil,
		IsSignedIn:     false,
		IsRenderCall:   false,
		AllowAnonymous: false,
		SkipCache:      false,
		Logger:         nil,
	}

	return service, context
}
