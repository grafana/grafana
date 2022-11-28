package correlations

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestIntegrationReadCorrelation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ctx := NewTestEnv(t)

	adminUser := User{
		username: "admin",
		password: "admin",
	}
	viewerUser := User{
		username: "viewer",
		password: "viewer",
	}

	ctx.createUser(user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Password:       viewerUser.password,
		Login:          viewerUser.username,
	})
	ctx.createUser(user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       adminUser.password,
		Login:          adminUser.username,
	})

	t.Run("Get all correlations", func(t *testing.T) {
		// Running this here before creating a correlation in order to test this path.
		t.Run("If no correlation exists it should return 200", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  "/api/datasources/correlations",
				user: adminUser,
			})
			require.Equal(t, http.StatusOK, res.StatusCode)

			responseBody, err := io.ReadAll(res.Body)
			require.NoError(t, err)

			var response []correlations.Correlation
			err = json.Unmarshal(responseBody, &response)
			require.NoError(t, err)

			require.Len(t, response, 0)

			require.NoError(t, res.Body.Close())
		})
	})

	createDsCommand := &datasources.AddDataSourceCommand{
		Name:  "with-correlations",
		Type:  "loki",
		OrgId: 1,
	}
	ctx.createDs(createDsCommand)
	dsWithCorrelations := createDsCommand.Result
	correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
		SourceUID: dsWithCorrelations.Uid,
		TargetUID: dsWithCorrelations.Uid,
		OrgId:     dsWithCorrelations.OrgId,
	})

	createDsCommand = &datasources.AddDataSourceCommand{
		Name:  "without-correlations",
		Type:  "loki",
		OrgId: 1,
	}
	ctx.createDs(createDsCommand)
	dsWithoutCorrelations := createDsCommand.Result

	// This creates 2 records in the correlation table that should never be returned by the API.
	// Given all tests in this file work on the assumption that only a single correlation exists,
	// this covers the case where bad data exists in the database.
	err := ctx.env.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		created, err := sess.InsertMulti(&[]correlations.Correlation{
			{
				UID:       "uid-1",
				SourceUID: dsWithoutCorrelations.Uid,
				TargetUID: "THIS-DOES-NOT_EXIST",
			},
			{
				UID:       "uid-2",
				SourceUID: "THIS-DOES-NOT_EXIST",
				TargetUID: dsWithoutCorrelations.Uid,
			},
		})
		require.Equal(t, int64(2), created)
		return err
	})
	require.NoError(t, err)

	t.Run("Get all correlations", func(t *testing.T) {
		t.Run("Unauthenticated users shouldn't be able to read correlations", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url: "/api/datasources/correlations",
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

		t.Run("Authenticated users shouldn't get unauthorized or forbidden errors", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  "/api/datasources/correlations",
				user: viewerUser,
			})
			require.NotEqual(t, http.StatusUnauthorized, res.StatusCode)
			require.NotEqual(t, http.StatusForbidden, res.StatusCode)

			require.NoError(t, res.Body.Close())
		})

		t.Run("Should correctly return correlations", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  "/api/datasources/correlations",
				user: adminUser,
			})
			require.Equal(t, http.StatusOK, res.StatusCode)

			responseBody, err := io.ReadAll(res.Body)
			require.NoError(t, err)

			var response []correlations.Correlation
			err = json.Unmarshal(responseBody, &response)
			require.NoError(t, err)

			require.Len(t, response, 1)
			require.EqualValues(t, correlation, response[0])

			require.NoError(t, res.Body.Close())
		})
	})

	t.Run("Get all correlations for a given data source", func(t *testing.T) {
		t.Run("Unauthenticated users shouldn't be able to read correlations", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url: fmt.Sprintf("/api/datasources/uid/%s/correlations", "some-uid"),
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

		t.Run("Authenticated users shouldn't get unauthorized or forbidden errors", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", "some-uid"),
				user: viewerUser,
			})
			require.NotEqual(t, http.StatusUnauthorized, res.StatusCode)
			require.NotEqual(t, http.StatusForbidden, res.StatusCode)

			require.NoError(t, res.Body.Close())
		})

		t.Run("if datasource does not exist it should return 404", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", "some-uid"),
				user: adminUser,
			})
			require.Equal(t, http.StatusNotFound, res.StatusCode)

			responseBody, err := io.ReadAll(res.Body)
			require.NoError(t, err)

			var response errorResponseBody
			err = json.Unmarshal(responseBody, &response)
			require.NoError(t, err)

			require.Equal(t, "Source data source not found", response.Message)

			require.NoError(t, res.Body.Close())
		})

		t.Run("If no correlation exists it should return 200", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", dsWithoutCorrelations.Uid),
				user: adminUser,
			})
			require.Equal(t, http.StatusOK, res.StatusCode)

			responseBody, err := io.ReadAll(res.Body)
			require.NoError(t, err)

			var response []correlations.Correlation
			err = json.Unmarshal(responseBody, &response)
			require.NoError(t, err)

			require.Len(t, response, 0)

			require.NoError(t, res.Body.Close())
		})

		t.Run("Should correctly return correlations", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", dsWithCorrelations.Uid),
				user: adminUser,
			})
			require.Equal(t, http.StatusOK, res.StatusCode)

			responseBody, err := io.ReadAll(res.Body)
			require.NoError(t, err)

			var response []correlations.Correlation
			err = json.Unmarshal(responseBody, &response)
			require.NoError(t, err)

			require.Len(t, response, 1)
			require.EqualValues(t, correlation, response[0])

			require.NoError(t, res.Body.Close())
		})
	})

	t.Run("Get a single correlation", func(t *testing.T) {
		t.Run("Unauthenticated users shouldn't be able to read correlations", func(t *testing.T) {
			res := ctx.Get(GetParams{
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

		t.Run("Authenticated users shouldn't get unauthorized or forbidden errors", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", "some-ds-uid", "some-correlation-uid"),
				user: viewerUser,
			})
			require.NotEqual(t, http.StatusUnauthorized, res.StatusCode)
			require.NotEqual(t, http.StatusForbidden, res.StatusCode)

			require.NoError(t, res.Body.Close())
		})

		t.Run("if datasource does not exist it should return 404", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", "some-ds-uid", "some-correlation-uid"),
				user: adminUser,
			})
			require.Equal(t, http.StatusNotFound, res.StatusCode)

			responseBody, err := io.ReadAll(res.Body)
			require.NoError(t, err)

			var response errorResponseBody
			err = json.Unmarshal(responseBody, &response)
			require.NoError(t, err)

			require.Equal(t, "Source data source not found", response.Message)

			require.NoError(t, res.Body.Close())
		})

		t.Run("If no correlation exists it should return 404", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", dsWithoutCorrelations.Uid, "some-correlation-uid"),
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

		t.Run("Should correctly return correlation", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", dsWithCorrelations.Uid, correlation.UID),
				user: adminUser,
			})
			require.Equal(t, http.StatusOK, res.StatusCode)

			responseBody, err := io.ReadAll(res.Body)
			require.NoError(t, err)

			var response correlations.Correlation
			err = json.Unmarshal(responseBody, &response)
			require.NoError(t, err)

			require.EqualValues(t, correlation, response)

			require.NoError(t, res.Body.Close())
		})
	})
}
