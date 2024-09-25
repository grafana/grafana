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

func TestIntegrationDeleteCorrelation(t *testing.T) {
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
	writableDsId := dataSource.ID
	writableDsOrgId := dataSource.OrgID

	t.Run("Unauthenticated users shouldn't be able to delete correlations", func(t *testing.T) {
		res := ctx.Delete(DeleteParams{
			url: fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", "some-ds-uid", "some-correlation-uid"),
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

	t.Run("non org admin shouldn't be able to delete correlations", func(t *testing.T) {
		res := ctx.Delete(DeleteParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", "some-ds-uid", "some-correlation-uid"),
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
		res := ctx.Delete(DeleteParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", "nonexistent-ds-uid", "some-correlation-uid"),
			user: adminUser,
		})

		require.Equal(t, http.StatusNotFound, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Data source not found", response.Message)

		require.NoError(t, res.Body.Close())
	})

	t.Run("inexistent correlation should result in a 404", func(t *testing.T) {
		res := ctx.Delete(DeleteParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", writableDs, "nonexistent-correlation-uid"),
			user: adminUser,
		})
		require.Equal(t, http.StatusNotFound, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation not found", response.Message)

		require.NoError(t, res.Body.Close())
	})

	t.Run("deleting a read-only correlation should result in a 403", func(t *testing.T) {
		correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID:   writableDs,
			TargetUID:   &writableDs,
			OrgId:       writableDsOrgId,
			Provisioned: true,
			Type:        correlations.CorrelationType("query"),
		})

		res := ctx.Delete(DeleteParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
		})
		require.Equal(t, http.StatusForbidden, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response errorResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation can only be edited via provisioning", response.Message)

		require.NoError(t, res.Body.Close())
	})

	t.Run("deleting a correlation pointing to a read-only data source should work", func(t *testing.T) {
		correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID: writableDs,
			TargetUID: &writableDs,
			OrgId:     writableDsOrgId,
			Type:      correlations.CorrelationType("query"),
		})

		res := ctx.Delete(DeleteParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response correlations.CreateCorrelationResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation deleted", response.Message)
		require.NoError(t, res.Body.Close())

		// trying to delete the same correlation a second time should result in a 404
		res = ctx.Delete(DeleteParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
		})
		require.NoError(t, res.Body.Close())
		require.Equal(t, http.StatusNotFound, res.StatusCode)
	})

	t.Run("should correctly delete a correlation", func(t *testing.T) {
		correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID: writableDs,
			TargetUID: &readOnlyDS,
			OrgId:     writableDsOrgId,
			Type:      correlations.CorrelationType("query"),
		})

		res := ctx.Delete(DeleteParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response correlations.CreateCorrelationResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Equal(t, "Correlation deleted", response.Message)
		require.NoError(t, res.Body.Close())

		// trying to delete the same correlation a second time should result in a 404
		res = ctx.Delete(DeleteParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", correlation.SourceUID, correlation.UID),
			user: adminUser,
		})
		require.NoError(t, res.Body.Close())
		require.Equal(t, http.StatusNotFound, res.StatusCode)
	})

	t.Run("deleting data source removes related correlations", func(t *testing.T) {
		ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID:   writableDs,
			TargetUID:   &readOnlyDS,
			OrgId:       writableDsOrgId,
			Provisioned: false,
			Type:        correlations.CorrelationType("query"),
		})

		ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID:   writableDs,
			TargetUID:   &readOnlyDS,
			OrgId:       writableDsOrgId,
			Provisioned: true,
			Type:        correlations.CorrelationType("query"),
		})

		res := ctx.Delete(DeleteParams{
			url:  fmt.Sprintf("/api/datasources/%d", writableDsId),
			user: adminUser,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())

		res = ctx.Get(GetParams{
			url:  "/api/datasources/correlations",
			user: adminUser,
			page: "0",
		})
		require.Equal(t, http.StatusOK, res.StatusCode)

		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response correlations.GetCorrelationsResponseBody
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.Len(t, response.Correlations, 0)

		require.NoError(t, res.Body.Close())
	})
}
