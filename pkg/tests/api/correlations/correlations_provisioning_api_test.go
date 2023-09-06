package correlations

import (
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestIntegrationCreateOrUpdateCorrelation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ctx := NewTestEnv(t)

	adminUser := ctx.createUser(user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	createDsCommand := &datasources.AddDataSourceCommand{
		Name:  "loki",
		Type:  "loki",
		OrgID: adminUser.User.OrgID,
	}
	dataSource := ctx.createDs(createDsCommand)

	needsMigration := ctx.createCorrelation(correlations.CreateCorrelationCommand{
		SourceUID: dataSource.UID,
		TargetUID: &dataSource.UID,
		OrgId:     dataSource.OrgID,
		Label:     "needs migration",
		Config: correlations.CorrelationConfig{
			Type:   correlations.ConfigTypeQuery,
			Field:  "foo",
			Target: map[string]any{},
			Transformations: []correlations.Transformation{
				{Type: "logfmt"},
			},
		},
		Provisioned: false,
	})

	t.Run("Correctly marks existing correlations as provisioned", func(t *testing.T) {
		// should be updated
		ctx.createOrUpdateCorrelation(correlations.CreateCorrelationCommand{
			SourceUID:   needsMigration.SourceUID,
			OrgId:       needsMigration.OrgID,
			TargetUID:   needsMigration.TargetUID,
			Label:       needsMigration.Label,
			Description: needsMigration.Description,
			Config:      needsMigration.Config,
			Provisioned: true,
		})

		// should be added
		ctx.createOrUpdateCorrelation(correlations.CreateCorrelationCommand{
			SourceUID:   needsMigration.SourceUID,
			OrgId:       needsMigration.OrgID,
			TargetUID:   needsMigration.TargetUID,
			Label:       "different",
			Description: needsMigration.Description,
			Config:      needsMigration.Config,
			Provisioned: true,
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

		require.Len(t, response.Correlations, 2)
		require.EqualValues(t, "needs migration", response.Correlations[0].Label)
		require.EqualValues(t, true, response.Correlations[0].Provisioned)
		require.EqualValues(t, "different", response.Correlations[1].Label)
		require.EqualValues(t, true, response.Correlations[1].Provisioned)

		require.NoError(t, res.Body.Close())
	})

}
