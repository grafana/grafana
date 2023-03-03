package querylibrary_tests

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	apikeygenprefix "github.com/grafana/grafana/pkg/components/apikeygenprefixed"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	saAPI "github.com/grafana/grafana/pkg/services/serviceaccounts/api"
	saTests "github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func createServiceAccountAdminToken(t *testing.T, name string, env *server.TestEnv) (string, *user.SignedInUser) {
	t.Helper()

	account := saTests.SetupUserServiceAccount(t, env.SQLStore, saTests.TestUser{
		Name:             name,
		Role:             string(org.RoleAdmin),
		Login:            name,
		IsServiceAccount: true,
	})

	keyGen, err := apikeygenprefix.New(saAPI.ServiceID)
	require.NoError(t, err)

	_ = saTests.SetupApiKey(t, env.SQLStore, saTests.TestApiKey{
		Name:             name,
		Role:             org.RoleAdmin,
		OrgId:            account.OrgID,
		Key:              keyGen.HashedKey,
		ServiceAccountID: &account.ID,
	})

	return keyGen.ClientSecret, &user.SignedInUser{
		UserID:           account.ID,
		Email:            account.Email,
		Name:             account.Name,
		Login:            account.Login,
		OrgID:            account.OrgID,
		IsServiceAccount: true,
	}
}

type testContext struct {
	authToken string
	client    *queryLibraryAPIClient
	user      *user.SignedInUser
}

func createTestContext(t *testing.T) testContext {
	t.Helper()

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{featuremgmt.FlagPanelTitleSearch, featuremgmt.FlagQueryLibrary},
		QueryRetries:         3,
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	authToken, serviceAccountUser := createServiceAccountAdminToken(t, "query-library", env)

	client := newQueryLibraryAPIClient(authToken, fmt.Sprintf("http://%s/api", grafanaListedAddr), serviceAccountUser, env.SQLStore)

	return testContext{
		authToken: authToken,
		client:    client,
		user:      serviceAccountUser,
	}
}
