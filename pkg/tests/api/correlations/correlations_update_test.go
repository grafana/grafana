package correlations

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestIntegrationUpdateCorrelation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ctx := NewTestEnv(t)

	adminUser := ctx.createUser(user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	editorUser := ctx.createUser(user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
		OrgID:          adminUser.User.OrgID,
	})

	createDsCommand := &datasources.AddDataSourceCommand{
		Name:     "read-only",
		Type:     "loki",
		ReadOnly: true,
		OrgID:    adminUser.User.OrgID,
	}
	dataSource := ctx.createDs(createDsCommand)
	readOnlyDS := dataSource.UID

	createDsCommand = &datasources.AddDataSourceCommand{
		Name:  "writable",
		Type:  "loki",
		OrgID: adminUser.User.OrgID,
	}
	dataSource = ctx.createDs(createDsCommand)
	writableDs := dataSource.UID
	writableDsOrgId := dataSource.OrgID

	t.Run("Unauthenticated users shouldn't be able to update correlations", func(t *testing.T) {
		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", "some-ds-uid", "some-correlation-uid"),
			body: ``,
		})
		require.Equal(t, http.StatusUnauthorized, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Unauthorized", response.Message)

		require.NoError(t, res.Body.Close())
	})

	t.Run("non org admin shouldn't be able to update correlations", func(t *testing.T) {
		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", "some-ds-uid", "some-correlation-uid"),
			body: `{}`,
			user: editorUser,
		})
		require.Equal(t, http.StatusForbidden, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Contains(t, response.Message, "Permissions needed: datasources:write")

		require.NoError(t, res.Body.Close())
	})

	t.Run("inexistent source data source should result in a 404", func(t *testing.T) {
		res := ctx.Patch(PatchParams{
			url: fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", "some-ds-uid", "some-correlation-uid"),
			body: `{
				"label": "some-label"
			}`,
			user: adminUser,
		})
		require.Equal(t, http.StatusNotFound, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Data source not found", response.Message)
		require.Equal(t, correlations.ErrSourceDataSourceDoesNotExists.Error(), response.Error)

		require.NoError(t, res.Body.Close())
	})

	t.Run("inexistent correlation should result in a 404", func(t *testing.T) {
		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", writableDs, "nonexistent-correlation-uid"),
			user: adminUser,
			body: `{
				"label": ""
			}`,
		})
		require.Equal(t, http.StatusNotFound, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation not found", response.Message)
		require.Equal(t, correlations.ErrCorrelationNotFound.Error(), response.Error)

		require.NoError(t, res.Body.Close())
	})

	t.Run("updating a correlation originating from a read-only data source should result in a 403", func(t *testing.T) {
		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", readOnlyDS, "nonexistent-correlation-uid"),
			user: adminUser,
			body: `{
				"label": "some-label"
			}`,
		})
		require.Equal(t, http.StatusForbidden, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Data source is read only", response.Message)
		require.Equal(t, correlations.ErrSourceDataSourceReadOnly.Error(), response.Error)

		require.NoError(t, res.Body.Close())
	})

	t.Run("updating a correlation without data should result in a 400", func(t *testing.T) {
		correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID: writableDs,
			TargetUID: &writableDs,
			OrgId:     writableDsOrgId,
		})

		// no params
		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{}`,
		})
		require.Equal(t, http.StatusBadRequest, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "At least one of label, description or config is required", response.Message)
		require.Equal(t, correlations.ErrUpdateCorrelationEmptyParams.Error(), response.Error)
		require.NoError(t, res.Body.Close())

		// empty body
		res = ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: ``,
		})
		require.Equal(t, http.StatusBadRequest, res.StatusCode)

		responseBody, err = io.ReadAll(res.Body)
		require.NoError(t, err)

		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "At least one of label, description or config is required", response.Message)
		require.Equal(t, correlations.ErrUpdateCorrelationEmptyParams.Error(), response.Error)
		require.NoError(t, res.Body.Close())

		// all set to null
		res = ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
						"label": null,
						"description": null,
						"config": null
					}`,
		})
		require.Equal(t, http.StatusBadRequest, res.StatusCode)

		responseBody, err = io.ReadAll(res.Body)
		require.NoError(t, err)

		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "At least one of label, description or config is required", response.Message)
		require.Equal(t, correlations.ErrUpdateCorrelationEmptyParams.Error(), response.Error)
		require.NoError(t, res.Body.Close())
	})

	t.Run("updating a correlation pointing to a read-only data source should work", func(t *testing.T) {
		correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID: writableDs,
			TargetUID: &writableDs,
			OrgId:     writableDsOrgId,
			Label:     "a label",
		})

		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
				"label": "updated label"
			}`,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response correlations.UpdateCorrelationResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation updated", response.Message)
		require.Equal(t, "updated label", response.Result.Label)
		require.NoError(t, res.Body.Close())
	})

	t.Run("should correctly update correlations", func(t *testing.T) {
		correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID:   writableDs,
			TargetUID:   &writableDs,
			OrgId:       writableDsOrgId,
			Label:       "0",
			Description: "0",
			Config: correlations.CorrelationConfig{
				Field:  "fieldName",
				Type:   "query",
				Target: map[string]interface{}{"expr": "foo"},
			},
		})

		// updating all
		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
				"label": "1",
				"description": "1",
				"config": {
					"field": "field",
					"type": "query",
					"target": { "expr": "bar" },
					"transformations": [ {"type": "logfmt"} ]
				}
			}`,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response correlations.UpdateCorrelationResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation updated", response.Message)
		require.Equal(t, "1", response.Result.Label)
		require.Equal(t, "1", response.Result.Description)
		require.Equal(t, "field", response.Result.Config.Field)
		require.Equal(t, map[string]interface{}{"expr": "bar"}, response.Result.Config.Target)
		require.Equal(t, correlations.Transformation{Type: "logfmt"}, response.Result.Config.Transformations[0])
		require.NoError(t, res.Body.Close())

		// partially updating only label
		res = ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
				"label": "2"
			}`,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err = io.ReadAll(res.Body)
		require.NoError(t, err)

		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation updated", response.Message)
		require.Equal(t, "2", response.Result.Label)
		require.Equal(t, "1", response.Result.Description)
		require.Equal(t, "field", response.Result.Config.Field)
		require.Equal(t, map[string]interface{}{"expr": "bar"}, response.Result.Config.Target)
		require.NoError(t, res.Body.Close())

		// partially updating only description
		res = ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
				"description": "2"
			}`,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err = io.ReadAll(res.Body)
		require.NoError(t, err)

		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation updated", response.Message)
		require.Equal(t, "2", response.Result.Label)
		require.Equal(t, "2", response.Result.Description)
		require.Equal(t, "field", response.Result.Config.Field)
		require.Equal(t, map[string]interface{}{"expr": "bar"}, response.Result.Config.Target)
		require.NoError(t, res.Body.Close())

		// partially updating whole config
		res = ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
				"config": {
					"field": "name",
					"type": "query",
					"target": { "expr": "baz" }
				}
			}`,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err = io.ReadAll(res.Body)
		require.NoError(t, err)

		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation updated", response.Message)
		require.Equal(t, "2", response.Result.Label)
		require.Equal(t, "2", response.Result.Description)
		require.Equal(t, "name", response.Result.Config.Field)
		require.Equal(t, map[string]interface{}{"expr": "baz"}, response.Result.Config.Target)
		require.NoError(t, res.Body.Close())

		// partially updating only config field
		res = ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
				"config": {
					"field": "newName"
				}
			}`,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err = io.ReadAll(res.Body)
		require.NoError(t, err)

		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation updated", response.Message)
		require.Equal(t, "2", response.Result.Label)
		require.Equal(t, "2", response.Result.Description)
		require.Equal(t, "newName", response.Result.Config.Field)
		require.Equal(t, map[string]interface{}{"expr": "baz"}, response.Result.Config.Target)
		require.NoError(t, res.Body.Close())

		// partially updating only config target
		res = ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
				"config": {
					"target": { "expr": "foo" }
				}
			}`,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err = io.ReadAll(res.Body)
		require.NoError(t, err)

		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation updated", response.Message)
		require.Equal(t, "2", response.Result.Label)
		require.Equal(t, "2", response.Result.Description)
		require.Equal(t, "newName", response.Result.Config.Field)
		require.Equal(t, map[string]interface{}{"expr": "foo"}, response.Result.Config.Target)
		require.NoError(t, res.Body.Close())

		// setting label, description and config field to empty strings (testing whether empty strings are handled correctly)
		res = ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
				"label": "",
				"description": "",
				"config": {
					"field": ""
				}
			}`,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err = io.ReadAll(res.Body)
		require.NoError(t, err)

		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation updated", response.Message)
		require.Equal(t, "", response.Result.Label)
		require.Equal(t, "", response.Result.Description)
		require.Equal(t, "", response.Result.Config.Field)
		require.NoError(t, res.Body.Close())
	})
}
