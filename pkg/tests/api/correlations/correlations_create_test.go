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

func TestIntegrationCreateCorrelation(t *testing.T) {
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

	t.Run("Unauthenticated users shouldn't be able to create correlations", func(t *testing.T) {
		res := ctx.Post(PostParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", "some-ds-uid"),
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

	t.Run("non org admin shouldn't be able to create correlations", func(t *testing.T) {
		res := ctx.Post(PostParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", "some-ds-uid"),
			body: ``,
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

	t.Run("missing source data source in body should result in a 400", func(t *testing.T) {
		res := ctx.Post(PostParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", "nonexistent-ds-uid"),
			body: `{}`,
			user: adminUser,
		})
		require.Equal(t, http.StatusBadRequest, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "bad request data", response.Message)

		require.NoError(t, res.Body.Close())
	})

	t.Run("inexistent source data source should result in a 404", func(t *testing.T) {
		res := ctx.Post(PostParams{
			url: fmt.Sprintf("/api/datasources/uid/%s/correlations", "nonexistent-ds-uid"),
			body: fmt.Sprintf(`{
					"targetUID": "%s",
					"config": {
						"type": "query",
						"field": "message",
						"target": {}
					}
				}`, writableDs),
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

	t.Run("inexistent target data source should result in a 404 if config.type=query", func(t *testing.T) {
		res := ctx.Post(PostParams{
			url: fmt.Sprintf("/api/datasources/uid/%s/correlations", writableDs),
			body: `{
					"targetUID": "nonexistent-uid-uid",
					"config": {
						"type": "query",
						"field": "message",
						"target": {}
					}
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
		require.Equal(t, correlations.ErrTargetDataSourceDoesNotExists.Error(), response.Error)

		require.NoError(t, res.Body.Close())
	})

	t.Run("creating a correlation originating from a read-only data source should result in a 403", func(t *testing.T) {
		res := ctx.Post(PostParams{
			url: fmt.Sprintf("/api/datasources/uid/%s/correlations", readOnlyDS),
			body: fmt.Sprintf(`{
					"targetUID": "%s",
					"config": {
						"type": "query",
						"field": "message",
						"target": {}
					}
				}`, readOnlyDS),
			user: adminUser,
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

	t.Run("creating a correlation pointing to a read-only data source should work", func(t *testing.T) {
		res := ctx.Post(PostParams{
			url: fmt.Sprintf("/api/datasources/uid/%s/correlations", writableDs),
			body: fmt.Sprintf(`{
					"targetUID": "%s",
					"config": {
						"type": "query",
						"field": "message",
						"target": {}
					}
				}`, readOnlyDS),
			user: adminUser,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response correlations.CreateCorrelationResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation created", response.Message)
		require.Equal(t, writableDs, response.Result.SourceUID)
		require.Equal(t, readOnlyDS, *response.Result.TargetUID)
		require.Equal(t, "", response.Result.Description)
		require.Equal(t, "", response.Result.Label)

		require.NoError(t, res.Body.Close())
	})

	t.Run("Should correctly create a correlation with a correct config", func(t *testing.T) {
		description := "a description"
		label := "a label"
		fieldName := "fieldName"
		configType := correlations.ConfigTypeQuery
		transformation := correlations.Transformation{Type: "logfmt"}
		transformation2 := correlations.Transformation{Type: "regex", Expression: "testExpression", MapValue: "testVar"}
		res := ctx.Post(PostParams{
			url: fmt.Sprintf("/api/datasources/uid/%s/correlations", writableDs),
			body: fmt.Sprintf(`{
					"targetUID": "%s",
					"description": "%s",
					"label": "%s",
					"config": {
						"type": "%s",
						"field": "%s",
						"target": { "expr": "foo" },
						"transformations": [
							{"type": "logfmt"},
							{"type": "regex", "expression": "testExpression", "mapValue": "testVar"}
						]
					}
				}`, writableDs, description, label, configType, fieldName),
			user: adminUser,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response correlations.CreateCorrelationResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation created", response.Message)
		require.Equal(t, writableDs, response.Result.SourceUID)
		require.Equal(t, writableDs, *response.Result.TargetUID)
		require.Equal(t, description, response.Result.Description)
		require.Equal(t, label, response.Result.Label)
		require.Equal(t, configType, response.Result.Config.Type)
		require.Equal(t, fieldName, response.Result.Config.Field)
		require.Equal(t, map[string]interface{}{"expr": "foo"}, response.Result.Config.Target)
		require.Equal(t, transformation, response.Result.Config.Transformations[0])
		require.Equal(t, transformation2, response.Result.Config.Transformations[1])

		require.NoError(t, res.Body.Close())
	})

	t.Run("Should not create a correlation with incorrect config", func(t *testing.T) {
		description := "a description"
		label := "a label"
		res := ctx.Post(PostParams{
			url: fmt.Sprintf("/api/datasources/uid/%s/correlations", writableDs),
			body: fmt.Sprintf(`{
					"targetUID": "%s",
					"description": "%s",
					"label": "%s",
					"config": {
						"field": 2
					}
				}`, writableDs, description, label),
			user: adminUser,
		})
		require.Equal(t, http.StatusBadRequest, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Contains(t, response.Message, "bad request data")

		require.NoError(t, res.Body.Close())
	})

	t.Run("Should not create a correlation without a config", func(t *testing.T) {
		description := "a description"
		label := "a label"
		res := ctx.Post(PostParams{
			url: fmt.Sprintf("/api/datasources/uid/%s/correlations", writableDs),
			body: fmt.Sprintf(`{
					"targetUID": "%s",
					"description": "%s",
					"label": "%s"
				}`, writableDs, description, label),
			user: adminUser,
		})
		require.Equal(t, http.StatusBadRequest, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Contains(t, response.Message, "bad request data")

		require.NoError(t, res.Body.Close())
	})

	t.Run("Should not create a correlation with an invalid config type", func(t *testing.T) {
		description := "a description"
		label := "a label"
		configType := "nonexistent-config-type"
		res := ctx.Post(PostParams{
			url: fmt.Sprintf("/api/datasources/uid/%s/correlations", writableDs),
			body: fmt.Sprintf(`{
					"targetUID": "%s",
					"description": "%s",
					"label": "%s",
					"config": {
						"type": "%s"
					}
				}`, writableDs, description, label, configType),
			user: adminUser,
		})
		require.Equal(t, http.StatusBadRequest, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Contains(t, response.Message, "bad request data")
		require.Contains(t, response.Error, correlations.ErrInvalidConfigType.Error())
		require.Contains(t, response.Error, configType)

		require.NoError(t, res.Body.Close())
	})
}
