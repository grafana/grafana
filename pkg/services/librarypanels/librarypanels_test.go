package librarypanels

import (
	"testing"
	"time"

	"gopkg.in/macaron.v1"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestCreateLibraryPanel(t *testing.T) {
	libraryPanelScenario(t, "When an admin tries to create a library panel", "then it should fail if library panel already exists", func(t *testing.T) {
		lps, context := setupTestEnv(t, models.ROLE_ADMIN, map[string]string{})
		command := getCreateCommand(1, "Text - Library Panel")

		response := lps.createHandler(&context, command)
		require.Equal(t, 200, response.Status())

		response = lps.createHandler(&context, command)
		require.Equal(t, 400, response.Status())
	})
}

func TestDeleteLibraryPanel(t *testing.T) {
	libraryPanelScenario(t, "When an admin tries to delete a library panel that does not exist", "then it should fail", func(t *testing.T) {
		lps, context := setupTestEnv(t, models.ROLE_ADMIN, map[string]string{":panelId": "74"})

		response := lps.deleteHandler(&context)
		require.Equal(t, 404, response.Status())
	})

	libraryPanelScenario(t, "When an admin tries to delete a library panel that exists", "then it should succeed", func(t *testing.T) {
		lps, context := setupTestEnv(t, models.ROLE_ADMIN, map[string]string{":panelId": "1"})
		command := getCreateCommand(1, "Text - Library Panel")

		response := lps.createHandler(&context, command)
		require.Equal(t, 200, response.Status())

		response = lps.deleteHandler(&context)
		require.Equal(t, 200, response.Status())
	})

	libraryPanelScenario(t, "When an admin tries to delete a library panel in another org", "then it should fail", func(t *testing.T) {
		params := map[string]string{":panelId": "1"}
		lps, context := setupTestEnv(t, models.ROLE_ADMIN, params)
		command := getCreateCommand(1, "Text - Library Panel")

		response := lps.createHandler(&context, command)
		require.Equal(t, 200, response.Status())

		user := getTestUser(models.ROLE_ADMIN, 2)
		context = getTestContext(user, params)

		response = lps.deleteHandler(&context)
		require.Equal(t, 404, response.Status())
	})
}

func libraryPanelScenario(t *testing.T, when string, then string, fn func(t *testing.T)) {
	t.Run(when, func(t *testing.T) {
		t.Run(then, func(t *testing.T) {
			fn(t)
			t.Cleanup(registry.ClearOverrides)
		})
	})
}

func setupTestEnv(t *testing.T, orgRole models.RoleType, params macaron.Params) (LibraryPanelService, models.ReqContext) {
	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"panelLibrary": true} // Everything in this service is behind the feature toggle "panelLibrary"

	// Because the LibraryPanelService is behind a feature toggle we need to override the service in the registry
	// with a Cfg that contains the feature toggle so that Migrations are run properly
	service := overrideLibraryPanelServiceInRegistry(cfg)

	sqlStore := sqlstore.InitTestDB(t)
	// We need to assign SQLStore after the override and migrations are done
	service.SQLStore = sqlStore

	user := getTestUser(orgRole, 1)
	context := getTestContext(user, params)

	return service, context
}

func overrideLibraryPanelServiceInRegistry(cfg *setting.Cfg) LibraryPanelService {
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

func getTestUser(orgRole models.RoleType, orgID int64) models.SignedInUser {
	user := models.SignedInUser{
		UserId:     1,
		OrgId:      orgID,
		OrgRole:    orgRole,
		LastSeenAt: time.Now(),
	}

	return user
}

func getTestContext(user models.SignedInUser, params macaron.Params) models.ReqContext {
	macronContext := macaron.Context{}
	macronContext.ReplaceAllParams(params)

	context := models.ReqContext{
		Context:      &macronContext,
		SignedInUser: &user,
	}

	return context
}

func getCreateCommand(folderID int64, title string) addLibraryPanelCommand {
	command := addLibraryPanelCommand{
		FolderID: folderID,
		Title:    title,
		Model: []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Text - Library Panel",
			  "type": "text"
			}
		`),
	}

	return command
}
