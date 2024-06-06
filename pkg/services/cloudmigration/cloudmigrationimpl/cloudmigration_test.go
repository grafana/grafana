package cloudmigrationimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	datafakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	secretsfakes "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func Test_NoopServiceDoesNothing(t *testing.T) {
	s := &NoopServiceImpl{}
	_, e := s.CreateToken(context.Background())
	assert.ErrorIs(t, e, cloudmigration.ErrFeatureDisabledError)
}

func Test_1(t *testing.T) {
	s := setUpServiceTest(t, false)

	createResp, err := s.CreateToken(context.Background())
	assert.NoError(t, err)
	assert.NotEmpty(t, createResp.Token)

	token, err := s.GetToken(context.Background())
	assert.NoError(t, err)
	assert.NotNil(t, token)

	err = s.DeleteToken(context.Background(), token.ID)
	assert.NoError(t, err)

	cm := cloudmigration.CloudMigration{}
	err = s.ValidateToken(context.Background(), cm)
	assert.NoError(t, err)

	_, err = s.GetToken(context.Background())
	assert.ErrorIs(t, cloudmigration.ErrTokenNotFound, err)
}

func Test_2(t *testing.T) {
	s := setUpServiceTest(t, true)

	createTokenResp, err := s.CreateToken(context.Background())
	assert.NoError(t, err)
	assert.NotEmpty(t, createTokenResp.Token)

	cmd := cloudmigration.CloudMigrationRequest{
		AuthToken: createTokenResp.Token,
	}

	createResp, err := s.CreateMigration(context.Background(), cmd)
	require.NoError(t, err)
	require.NotEmpty(t, createResp.UID)
	require.NotEmpty(t, createResp.Stack)

	getMigResp, err := s.GetMigration(context.Background(), createResp.UID)
	require.NoError(t, err)
	require.NotNil(t, getMigResp)
	require.Equal(t, createResp.UID, getMigResp.UID)
	require.Equal(t, createResp.Stack, getMigResp.Stack)

	listResp, err := s.GetMigrationList(context.Background())
	require.NoError(t, err)
	require.NotNil(t, listResp)

	runResp, err := s.RunMigration(ctxWithSignedInUser(), createResp.UID)
	require.NoError(t, err)
	require.NotNil(t, runResp)

	runStatusResp, err := s.GetMigrationStatus(context.Background(), runResp.RunUID)
	require.NoError(t, err)
	require.NotNil(t, runStatusResp)

	listRunResp, err := s.GetMigrationRunList(context.Background(), createResp.UID)
	require.NoError(t, err)
	require.NotNil(t, listRunResp)

	delMigResp, err := s.DeleteMigration(context.Background(), createResp.UID)
	require.NoError(t, err)
	require.NotNil(t, delMigResp)
}

func ctxWithSignedInUser() context.Context {
	c := &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{OrgID: 1},
	}
	k := ctxkey.Key{}
	ctx := context.WithValue(context.Background(), k, c)
	return ctx
}

func setUpServiceTest(t *testing.T, withDashboardMock bool) cloudmigration.Service {
	sqlStore := db.InitTestDB(t)
	secretsService := secretsfakes.NewFakeSecretsService()
	rr := routing.NewRouteRegister()
	spanRecorder := tracetest.NewSpanRecorder()
	tracer := tracing.InitializeTracerForTest(tracing.WithSpanProcessor(spanRecorder))
	mockFolder := &foldertest.FakeService{
		//	ExpectedFolder: &folder.Folder{UID: "folderUID", Title: "Folder"},
	}

	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection("cloud_migration")
	require.NoError(t, err)
	_, err = section.NewKey("domain", "localhost:1234")
	require.NoError(t, err)
	// dont know if this is the best, but dont want to refactor at the moment
	cfg.CloudMigration.IsDeveloperMode = true

	dashboardService := dashboards.NewFakeDashboardService(t)
	if withDashboardMock {
		dashboardService.On("GetAllDashboards", mock.Anything).Return(
			[]*dashboards.Dashboard{
				{
					UID:  "1",
					Data: simplejson.New(),
				},
			},
			nil,
		)
	}

	// TODO add datasources
	dsService := &datafakes.FakeDataSourceService{}
	s, err := ProvideService(
		cfg,
		featuremgmt.WithFeatures(featuremgmt.FlagOnPremToCloudMigrations),
		sqlStore,
		dsService,
		secretsService,
		rr,
		prometheus.DefaultRegisterer,
		tracer,
		dashboardService,
		mockFolder,
	)
	require.NoError(t, err)

	return s
}
