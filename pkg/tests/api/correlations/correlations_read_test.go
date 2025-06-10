package correlations

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestIntegrationReadCorrelation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ctx := NewTestEnv(t)

	adminUser := ctx.createUser(user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin2",
		Login:          "admin2",
	})

	otherOrgId := ctx.createOrg("New organization")
	otherOrgUser := ctx.createUser(user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin3",
		Login:          "admin3",
		OrgID:          otherOrgId,
	})

	viewerUser := ctx.createUser(user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Password:       "viewer",
		Login:          "viewer",
		OrgID:          adminUser.User.OrgID,
	})

	t.Run("Get all correlations", func(t *testing.T) {
		// Running this here before creating a correlation in order to test this path.
		t.Run("If no correlation exists it should return 200", func(t *testing.T) {
			res := ctx.Get(GetParams{
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
	})

	createDsCommand := &datasources.AddDataSourceCommand{
		Name:  "with-correlations",
		Type:  "loki",
		OrgID: 1,
	}
	dsWithCorrelations := ctx.createDs(createDsCommand)
	correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
		SourceUID: dsWithCorrelations.UID,
		TargetUID: &dsWithCorrelations.UID,
		OrgId:     dsWithCorrelations.OrgID,
		Type:      correlations.CorrelationType("query"),
		Config: correlations.CorrelationConfig{
			Field:  "foo",
			Target: map[string]any{},
			Transformations: []correlations.Transformation{
				{Type: "logfmt"},
			},
		},
	})

	createDsCommand = &datasources.AddDataSourceCommand{
		Name:  "without-correlations",
		Type:  "loki",
		OrgID: 1,
	}
	dsWithoutCorrelations := ctx.createDs(createDsCommand)

	createDsCommand = &datasources.AddDataSourceCommand{
		Name:  "with-correlations",
		UID:   dsWithCorrelations.UID, // reuse UID
		Type:  "loki",
		OrgID: otherOrgId,
	}
	ctx.createDs(createDsCommand)

	// This creates 2 records in the correlation table that should never be returned by the API.
	// Given all tests in this file work on the assumption that only a single correlation exists,
	// this covers the case where bad data exists in the database.
	nonExistingDsUID := "THIS-DOES-NOT_EXIST"
	var created int64 = 0
	err := ctx.env.SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		var innerError error
		created, innerError = sess.InsertMulti(&[]correlations.Correlation{
			{
				UID:       "uid-1",
				SourceUID: dsWithoutCorrelations.UID,
				TargetUID: &nonExistingDsUID,
			},
			{
				UID:       "uid-2",
				SourceUID: "THIS-DOES-NOT_EXIST",
				TargetUID: &dsWithoutCorrelations.UID,
			},
		})
		return innerError
	})
	require.NoError(t, err)
	require.Equal(t, int64(2), created)

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

			var response correlations.GetCorrelationsResponseBody
			err = json.Unmarshal(responseBody, &response)
			require.NoError(t, err)

			require.Len(t, response.Correlations, 1)
			require.EqualValues(t, correlation, response.Correlations[0])

			require.NoError(t, res.Body.Close())
		})

		t.Run("Should correctly return correlations for current organization", func(t *testing.T) {
			res := ctx.Get(GetParams{
				url:  "/api/datasources/correlations",
				user: otherOrgUser,
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
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", dsWithoutCorrelations.UID),
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
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations", dsWithCorrelations.UID),
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
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", dsWithoutCorrelations.UID, "some-correlation-uid"),
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
				url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", dsWithCorrelations.UID, correlation.UID),
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
