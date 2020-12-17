package librarypanels

import (
	"encoding/json"
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
	t.Run("When an admin tries to create a library panel that already exists, then it should fail.", func(t *testing.T) {
		context := getTestContext()

		testScenario(t, context, func(t *testing.T, ctx *testContext) {
			command := getCreateCommand(1, "Text - Library Panel")

			response := ctx.service.createHandler(ctx.reqContext, command)
			require.Equal(t, 200, response.Status())

			response = ctx.service.createHandler(ctx.reqContext, command)
			require.Equal(t, 400, response.Status())
		})
	})
}

func TestDeleteLibraryPanel(t *testing.T) {
	t.Run("When an admin tries to delete a library panel that does not exist, then it should fail.", func(t *testing.T) {
		context := getTestContext().withParams(map[string]string{":panelId": "74"})

		testScenario(t, context, func(t *testing.T, ctx *testContext) {
			response := ctx.service.deleteHandler(ctx.reqContext)
			require.Equal(t, 404, response.Status())
		})
	})

	t.Run("When an admin tries to delete a library panel that exists, then it should succeed.", func(t *testing.T) {
		context := getTestContext().withParams(map[string]string{":panelId": "1"})

		testScenario(t, context, func(t *testing.T, ctx *testContext) {
			command := getCreateCommand(1, "Text - Library Panel")

			response := ctx.service.createHandler(ctx.reqContext, command)
			require.Equal(t, 200, response.Status())

			response = ctx.service.deleteHandler(ctx.reqContext)
			require.Equal(t, 200, response.Status())
		})
	})

	t.Run("When an admin tries to delete a library panel in another org, then it should fail.", func(t *testing.T) {
		context := getTestContext().withParams(map[string]string{":panelId": "1"})

		testScenario(t, context, func(t *testing.T, ctx *testContext) {
			command := getCreateCommand(1, "Text - Library Panel")

			response := ctx.service.createHandler(ctx.reqContext, command)
			require.Equal(t, 200, response.Status())

			ctx.withSignedInUser(2, models.ROLE_ADMIN)

			response = ctx.service.deleteHandler(ctx.reqContext)
			require.Equal(t, 404, response.Status())
		})
	})
}

func TestGetLibraryPanel(t *testing.T) {
	t.Run("When an admin tries to get a library panel that does not exist, then it should fail.", func(t *testing.T) {
		context := getTestContext().withParams(map[string]string{":panelId": "74"})

		testScenario(t, context, func(t *testing.T, ctx *testContext) {
			response := ctx.service.getHandler(ctx.reqContext)
			require.Equal(t, 404, response.Status())
		})
	})

	t.Run("When an admin tries to get a library panel that exists, then it should succeed and return correct result.", func(t *testing.T) {
		context := getTestContext().withParams(map[string]string{":panelId": "1"})

		testScenario(t, context, func(t *testing.T, ctx *testContext) {
			command := getCreateCommand(1, "Text - Library Panel")

			response := ctx.service.createHandler(ctx.reqContext, command)
			require.Equal(t, 200, response.Status())

			response = ctx.service.getHandler(ctx.reqContext)
			require.Equal(t, 200, response.Status())

			result := libraryPanelResult{}
			err := json.Unmarshal(response.Body(), &result)
			require.NoError(t, err)
			require.Equal(t, int64(1), result.Result.FolderID)
			require.Equal(t, "Text - Library Panel", result.Result.Title)
		})
	})

	t.Run("When an admin tries to get a library panel that exists in an other org, then it should fail.", func(t *testing.T) {
		context := getTestContext().withParams(map[string]string{":panelId": "1"})

		testScenario(t, context, func(t *testing.T, ctx *testContext) {
			command := getCreateCommand(1, "Text - Library Panel")

			response := ctx.service.createHandler(ctx.reqContext, command)
			require.Equal(t, 200, response.Status())

			// switch orgID
			ctx.withSignedInUser(2, models.ROLE_ADMIN)

			response = ctx.service.getHandler(ctx.reqContext)
			require.Equal(t, 404, response.Status())
		})
	})
}

func TestGetAllLibraryPanels(t *testing.T) {
	t.Run("When an admin tries to get all library panels and none exists, then it should succeed and return correct result.", func(t *testing.T) {
		context := getTestContext()

		testScenario(t, context, func(t *testing.T, ctx *testContext) {
			response := ctx.service.getAllHandler(ctx.reqContext)
			require.Equal(t, 200, response.Status())

			result := libraryPanelsResult{}
			err := json.Unmarshal(response.Body(), &result)
			require.NoError(t, err)
			require.NotNil(t, result.Result)
			require.Equal(t, 0, len(result.Result))
		})
	})

	t.Run("When an admin tries to get all library panels and two exists, then it should succeed and return correct result.", func(t *testing.T) {
		context := getTestContext()

		testScenario(t, context, func(t *testing.T, ctx *testContext) {
			command := getCreateCommand(1, "Text - Library Panel")

			response := ctx.service.createHandler(ctx.reqContext, command)
			require.Equal(t, 200, response.Status())

			command = getCreateCommand(1, "Text - Library Panel2")

			response = ctx.service.createHandler(ctx.reqContext, command)
			require.Equal(t, 200, response.Status())

			response = ctx.service.getAllHandler(ctx.reqContext)
			require.Equal(t, 200, response.Status())

			result := libraryPanelsResult{}
			err := json.Unmarshal(response.Body(), &result)
			require.NoError(t, err)
			require.Equal(t, 2, len(result.Result))
			require.Equal(t, int64(1), result.Result[0].FolderID)
			require.Equal(t, int64(1), result.Result[1].FolderID)
			require.Equal(t, "Text - Library Panel", result.Result[0].Title)
			require.Equal(t, "Text - Library Panel2", result.Result[1].Title)
		})
	})

	t.Run("When an admin tries to get all library panels in a different org, then it should succeed and return correct result.", func(t *testing.T) {
		context := getTestContext()

		testScenario(t, context, func(t *testing.T, ctx *testContext) {
			command := getCreateCommand(1, "Text - Library Panel")

			response := ctx.service.createHandler(ctx.reqContext, command)
			require.Equal(t, 200, response.Status())

			response = ctx.service.getAllHandler(ctx.reqContext)
			require.Equal(t, 200, response.Status())

			result := libraryPanelsResult{}
			err := json.Unmarshal(response.Body(), &result)
			require.NoError(t, err)
			require.Equal(t, 1, len(result.Result))
			require.Equal(t, int64(1), result.Result[0].FolderID)
			require.Equal(t, "Text - Library Panel", result.Result[0].Title)

			// switch orgID
			ctx.withSignedInUser(2, models.ROLE_ADMIN)

			response = ctx.service.getAllHandler(ctx.reqContext)
			require.Equal(t, 200, response.Status())

			result = libraryPanelsResult{}
			err = json.Unmarshal(response.Body(), &result)
			require.NoError(t, err)
			require.NotNil(t, result.Result)
			require.Equal(t, 0, len(result.Result))
		})
	})
}

type libraryPanel struct {
	ID       int64  `json:"ID"`
	OrgID    int64  `json:"OrgID"`
	FolderID int64  `json:"FolderID"`
	Title    string `json:"Title"`
}

type libraryPanelResult struct {
	Result libraryPanel `json:"result"`
}

type libraryPanelsResult struct {
	Result []libraryPanel `json:"result"`
}

type testContext struct {
	service    *LibraryPanelService
	reqContext *models.ReqContext
	user       models.SignedInUser
	params     macaron.Params
}

func getTestContext() *testContext {
	context := testContext{
		params: map[string]string{},
		user:   getSignedInUser(1, models.ROLE_ADMIN),
	}

	return &context
}

func (t *testContext) withSignedInUser(orgID int64, orgRole models.RoleType) *testContext {
	t.user = getSignedInUser(orgID, orgRole)

	return t
}

func (t *testContext) withParams(params macaron.Params) *testContext {
	t.params = params

	return t
}

func testScenario(t *testing.T, context *testContext, testFunc func(t *testing.T, ctx *testContext)) {
	setupTestEnv(t, context)
	testFunc(t, context)
	t.Cleanup(registry.ClearOverrides)
}

func setupTestEnv(t *testing.T, context *testContext) {
	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"panelLibrary": true} // Everything in this service is behind the feature toggle "panelLibrary"

	// Because the LibraryPanelService is behind a feature toggle we need to override the service in the registry
	// with a Cfg that contains the feature toggle so that Migrations are run properly
	service := overrideLibraryPanelServiceInRegistry(cfg)
	context.service = &service

	sqlStore := sqlstore.InitTestDB(t)
	// We need to assign SQLStore after the override and migrations are done
	context.service.SQLStore = sqlStore

	context.reqContext = getReqContext(context)
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

func getSignedInUser(orgID int64, orgRole models.RoleType) models.SignedInUser {
	user := models.SignedInUser{
		UserId:     1,
		OrgId:      orgID,
		OrgRole:    orgRole,
		LastSeenAt: time.Now(),
	}

	return user
}

func getReqContext(ctx *testContext) *models.ReqContext {
	macronContext := macaron.Context{}
	macronContext.ReplaceAllParams(ctx.params)

	context := models.ReqContext{
		Context:      &macronContext,
		SignedInUser: &ctx.user,
	}

	return &context
}

func getCreateCommand(folderID int64, title string) createLibraryPanelCommand {
	command := createLibraryPanelCommand{
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
