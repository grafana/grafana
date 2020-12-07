package librarypanels

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/registry"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestAddLibraryPanel(t *testing.T) {
	t.Run("should fail if library panel already exists", func(t *testing.T) {
		repository, user := setupTestEnv(t, true, models.ROLE_EDITOR)
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

		noErr := repository.addLibraryPanel(&command)
		require.NoError(t, noErr)

		err := repository.addLibraryPanel(&command)
		require.EqualError(t, err, errLibraryPanelAlreadyAdded.Error())
	})
}

func TestAddLibraryPanelWhenFeatureToggleIsOff(t *testing.T) {
	t.Run("should return nil", func(t *testing.T) {
		repository, user := setupTestEnv(t, false, models.ROLE_EDITOR)

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

		err := repository.addLibraryPanel(&command)
		require.NoError(t, err)
		require.Nil(t, command.Result)
	})
}

// setupMigration overrides LibraryPanelService so that the AddMigration is run before tests
// this is necessary because our migration is controlled by a feature toggle
func setupMigration(cfg *setting.Cfg) {
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
}

func setupTestEnv(t *testing.T, featureToggle bool, orgRole models.RoleType) (*SQLLibraryPanelRepository, models.SignedInUser) {
	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"panelLibrary": featureToggle}

	setupMigration(cfg)

	sqlStore := sqlstore.InitTestDB(t)
	repository := &SQLLibraryPanelRepository{
		cfg:      cfg,
		sqlStore: sqlStore,
	}

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

	return repository, user
}
