package entity_server_tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/satokengen"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	saAPI "github.com/grafana/grafana/pkg/services/serviceaccounts/api"
	saTests "github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db/dbimpl"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func createServiceAccountAdminToken(t *testing.T, env *server.TestEnv) (string, *user.SignedInUser) {
	t.Helper()

	account := saTests.SetupUserServiceAccount(t, env.SQLStore, env.SQLStore.Cfg, saTests.TestUser{
		Name:             "grpc-server-sa",
		Role:             string(org.RoleAdmin),
		Login:            "grpc-server-sa",
		IsServiceAccount: true,
	})

	keyGen, err := satokengen.New(saAPI.ServiceID)
	require.NoError(t, err)

	_ = saTests.SetupApiKey(t, env.SQLStore, env.SQLStore.Cfg, saTests.TestApiKey{
		Name:             "grpc-server-test",
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
		IsServiceAccount: account.IsServiceAccount,
	}
}

type testContext struct {
	authToken string
	client    entity.EntityStoreClient
	user      *user.SignedInUser
	ctx       context.Context
}

func createTestContext(t *testing.T) testContext {
	t.Helper()

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrpcServer,
			featuremgmt.FlagUnifiedStorage,
		},
		AppModeProduction: false,         // required for migrations to run
		GRPCServerAddress: "127.0.0.1:0", // :0 for choosing the port automatically
	})

	_, env := testinfra.StartGrafanaEnv(t, dir, path)

	authToken, serviceAccountUser := createServiceAccountAdminToken(t, env)

	eDB, err := dbimpl.ProvideEntityDB(env.SQLStore, env.SQLStore.Cfg, env.FeatureToggles)
	require.NoError(t, err)

	err = eDB.Init()
	require.NoError(t, err)

	store, err := sqlstash.ProvideSQLEntityServer(eDB)
	require.NoError(t, err)

	client := entity.NewEntityStoreClientLocal(store)

	return testContext{
		authToken: authToken,
		client:    client,
		user:      serviceAccountUser,
		ctx:       appcontext.WithUser(context.Background(), serviceAccountUser),
	}
}
