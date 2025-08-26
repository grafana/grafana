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
		Login:          "admin2",
	})

	editorUser := ctx.createUser(user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
		OrgID:          adminUser.User.OrgID,
	})

	createDsCommand := &datasources.AddDataSourceCommand{
		Name:  "writable",
		Type:  "loki",
		OrgID: adminUser.User.OrgID,
	}
	dataSource := ctx.createDs(createDsCommand)
	writableDs := dataSource.UID
	writableDsOrgId := dataSource.OrgID

	t.Run("Unauthenticated users shouldn't be able to update correlations", func(t *testing.T) {
		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", "some-ds-uid", "some-correlation-uid"),
			body: ``,
		})
		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Unauthorized", response.Message)
		require.Equal(t, http.StatusUnauthorized, res.StatusCode)

		require.NoError(t, res.Body.Close())
	})

	t.Run("non org admin shouldn't be able to update correlations", func(t *testing.T) {
		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", "some-ds-uid", "some-correlation-uid"),
			body: `{}`,
			user: editorUser,
		})
		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Contains(t, response.Message, "Permissions needed: datasources:write")
		require.Equal(t, http.StatusForbidden, res.StatusCode)

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
		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Data source not found", response.Message)
		require.Equal(t, http.StatusNotFound, res.StatusCode)

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
		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation not found", response.Message)
		require.Equal(t, http.StatusNotFound, res.StatusCode)

		require.NoError(t, res.Body.Close())
	})

	t.Run("updating a read-only correlation should result in a 403", func(t *testing.T) {
		correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID:   writableDs,
			TargetUID:   &writableDs,
			OrgId:       writableDsOrgId,
			Provisioned: true,
			Type:        correlations.CorrelationType("query"),
		})

		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
				"label": "some-label"
			}`,
		})
		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation can only be edited via provisioning", response.Message)
		require.Equal(t, http.StatusForbidden, res.StatusCode)

		require.NoError(t, res.Body.Close())
	})

	t.Run("updating a correlation without data should result in a 400", func(t *testing.T) {
		correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID: writableDs,
			TargetUID: &writableDs,
			OrgId:     writableDsOrgId,
			Type:      correlations.CorrelationType("query"),
		})

		// no params
		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{}`,
		})
		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "At least one of label, description or config is required", response.Message)
		require.Equal(t, http.StatusBadRequest, res.StatusCode)

		require.NoError(t, res.Body.Close())

		// empty body
		res = ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: ``,
		})
		responseBody, err = io.ReadAll(res.Body)
		require.NoError(t, err)

		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "At least one of label, description or config is required", response.Message)
		require.Equal(t, http.StatusBadRequest, res.StatusCode)

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
		responseBody, err = io.ReadAll(res.Body)
		require.NoError(t, err)

		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "At least one of label, description or config is required", response.Message)
		require.Equal(t, http.StatusBadRequest, res.StatusCode)

		require.NoError(t, res.Body.Close())
	})

	t.Run("updating a correlation pointing to a read-only data source should work", func(t *testing.T) {
		t.Skip("flaky test")
		correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID: writableDs,
			TargetUID: &writableDs,
			OrgId:     writableDsOrgId,
			Label:     "a label",
			Type:      correlations.CorrelationType("query"),
		})

		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
				"label": "updated label"
			}`,
		})
		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response correlations.UpdateCorrelationResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation updated", response.Message)
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Equal(t, "updated label", response.Result.Label)
		require.NoError(t, res.Body.Close())
	})

	t.Run("should correctly update correlations", func(t *testing.T) {
		t.Skip("flaky test: See failure at https://drone.grafana.net/grafana/grafana/222544/1/9")
		correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID:   writableDs,
			TargetUID:   &writableDs,
			OrgId:       writableDsOrgId,
			Label:       "0",
			Description: "0",
			Type:        correlations.CorrelationType("query"),
			Config: correlations.CorrelationConfig{
				Field:  "fieldName",
				Target: map[string]any{"expr": "foo"},
			},
		})

		// updating all
		res := ctx.Patch(PatchParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
			body: `{
				"label": "1",
				"description": "1",
				"type": "query",
				"config": {
					"field": "field",
					"target": { "expr": "bar" },
					"transformations": [ {"type": "logfmt"} ]
				}
			}`,
		})

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response correlations.UpdateCorrelationResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation updated", response.Message)
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Equal(t, "1", response.Result.Label)
		require.Equal(t, "1", response.Result.Description)
		require.Equal(t, "field", response.Result.Config.Field)
		require.Equal(t, map[string]any{"expr": "bar"}, response.Result.Config.Target)
		require.Equal(t, correlations.Transformation{Type: "logfmt"}, response.Result.Config.Transformations[0])
		require.NoError(t, res.Body.Close())
	})
}
