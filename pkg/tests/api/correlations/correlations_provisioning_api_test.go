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
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationCreateOrUpdateCorrelation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := NewTestEnv(t)

	adminUser := ctx.createUser(user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin2",
		Login:          "admin2",
	})

	createDsCommand := &datasources.AddDataSourceCommand{
		Name:  "loki",
		Type:  "loki",
		OrgID: adminUser.User.OrgID,
	}
	dataSource := ctx.createDs(createDsCommand)

	ctx.createCorrelation(correlations.CreateCorrelationCommand{
		SourceUID: dataSource.UID,
		TargetUID: &dataSource.UID,
		OrgId:     dataSource.OrgID,
		Label:     "existing",
		Type:      correlations.CorrelationType("query"),
		Config: correlations.CorrelationConfig{
			Field:  "foo",
			Target: map[string]any{},
			Transformations: []correlations.Transformation{
				{Type: "logfmt"},
			},
		},
		Provisioned: false,
	})

	// v1 correlation where type is in config
	v1Correlation := ctx.createCorrelation(correlations.CreateCorrelationCommand{
		SourceUID: dataSource.UID,
		TargetUID: &dataSource.UID,
		OrgId:     dataSource.OrgID,
		Label:     "v1 correlation",
		Config: correlations.CorrelationConfig{
			Type:   correlations.CorrelationType("query"),
			Field:  "foo",
			Target: map[string]any{},
			Transformations: []correlations.Transformation{
				{Type: "logfmt"},
			},
		},
		Provisioned: true,
	})

	t.Run("Correctly marks existing correlations as provisioned", func(t *testing.T) {
		// should be added
		ctx.createCorrelation(correlations.CreateCorrelationCommand{
			SourceUID: dataSource.UID,
			OrgId:     dataSource.OrgID,
			TargetUID: &dataSource.UID,
			Label:     "different",
			Config: correlations.CorrelationConfig{
				Field:  "foo",
				Target: map[string]any{},
				Transformations: []correlations.Transformation{
					{Type: "logfmt"},
				},
			},
			Provisioned: true,
			Type:        correlations.CorrelationType("query"),
		})

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

		require.Len(t, response.Correlations, 3)

		unordered := make(map[string]correlations.Correlation)
		for _, v := range response.Correlations {
			unordered[v.Label] = v
		}

		// other existing correlations are not changed
		require.EqualValues(t, false, unordered["existing"].Provisioned)
		// new correlation is added
		require.EqualValues(t, true, unordered["different"].Provisioned)

		require.NoError(t, res.Body.Close())
	})

	t.Run("If Config.Type is query, provision without error but have value outside of config", func(t *testing.T) {
		res := ctx.Get(GetParams{
			url:  fmt.Sprintf("/api/datasources/uid/%s/correlations/%s", dataSource.UID, v1Correlation.UID),
			user: adminUser,
		})
		require.Equal(t, http.StatusOK, res.StatusCode)
		responseBody, err := io.ReadAll(res.Body)
		require.NoError(t, err)

		var response correlations.Correlation
		err = json.Unmarshal(responseBody, &response)
		require.NoError(t, err)

		require.EqualValues(t, response.Config.Type, "")
		require.EqualValues(t, v1Correlation.Config.Type, response.Type)

		require.NoError(t, res.Body.Close())
	})

	t.Run("If Config.type is not query, throw an error", func(t *testing.T) {
		_, err := ctx.createCorrelationPassError(correlations.CreateCorrelationCommand{
			SourceUID: dataSource.UID,
			TargetUID: &dataSource.UID,
			OrgId:     dataSource.OrgID,
			Label:     "bad v1 correlation",
			Config: correlations.CorrelationConfig{
				Type:   correlations.CorrelationType("external"),
				Field:  "foo",
				Target: map[string]any{},
				Transformations: []correlations.Transformation{
					{Type: "logfmt"},
				},
			},
			Provisioned: true,
		})

		require.Error(t, err)
		require.ErrorIs(t, err, correlations.ErrConfigTypeDeprecated)
	})
}
