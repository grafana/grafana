package cloudmigrationimpl

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/cloudmigration/gmsclient"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	datafakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
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
	t.Parallel()
	s := &NoopServiceImpl{}
	_, e := s.CreateToken(context.Background())
	assert.ErrorIs(t, e, cloudmigration.ErrFeatureDisabledError)
}

func Test_CreateGetAndDeleteToken(t *testing.T) {
	s := setUpServiceTest(t, false)

	createResp, err := s.CreateToken(context.Background())
	assert.NoError(t, err)
	assert.NotEmpty(t, createResp.Token)

	token, err := s.GetToken(context.Background())
	assert.NoError(t, err)
	assert.NotEmpty(t, token.Name)

	err = s.DeleteToken(context.Background(), token.ID)
	assert.NoError(t, err)

	_, err = s.GetToken(context.Background())
	assert.ErrorIs(t, cloudmigration.ErrTokenNotFound, err)

	cm := cloudmigration.CloudMigrationSession{}
	err = s.ValidateToken(context.Background(), cm)
	assert.NoError(t, err)
}

func Test_CreateGetRunMigrationsAndRuns(t *testing.T) {
	s := setUpServiceTest(t, true)

	createTokenResp, err := s.CreateToken(context.Background())
	assert.NoError(t, err)
	assert.NotEmpty(t, createTokenResp.Token)

	cmd := cloudmigration.CloudMigrationSessionRequest{
		AuthToken: createTokenResp.Token,
	}

	createResp, err := s.CreateSession(context.Background(), cmd)
	require.NoError(t, err)
	require.NotEmpty(t, createResp.UID)
	require.NotEmpty(t, createResp.Slug)

	getMigResp, err := s.GetSession(context.Background(), createResp.UID)
	require.NoError(t, err)
	require.NotNil(t, getMigResp)
	require.Equal(t, createResp.UID, getMigResp.UID)
	require.Equal(t, createResp.Slug, getMigResp.Slug)

	listResp, err := s.GetSessionList(context.Background())
	require.NoError(t, err)
	require.NotNil(t, listResp)
	require.Equal(t, 1, len(listResp.Sessions))
	require.Equal(t, createResp.UID, listResp.Sessions[0].UID)
	require.Equal(t, createResp.Slug, listResp.Sessions[0].Slug)

	runResp, err := s.RunMigration(ctxWithSignedInUser(), createResp.UID)
	require.NoError(t, err)
	require.NotNil(t, runResp)
	resultItemsByType := make(map[string]int)
	for _, item := range runResp.Items {
		resultItemsByType[string(item.Type)] = resultItemsByType[string(item.Type)] + 1
	}
	require.Equal(t, 1, resultItemsByType["DASHBOARD"])
	require.Equal(t, 2, resultItemsByType["DATASOURCE"])
	require.Equal(t, 2, len(resultItemsByType))

	runStatusResp, err := s.GetMigrationStatus(context.Background(), runResp.RunUID)
	require.NoError(t, err)
	require.Equal(t, runResp.RunUID, runStatusResp.UID)

	listRunResp, err := s.GetMigrationRunList(context.Background(), createResp.UID)
	require.NoError(t, err)
	require.Equal(t, 1, len(listRunResp.Runs))
	require.Equal(t, runResp.RunUID, listRunResp.Runs[0].RunUID)

	delMigResp, err := s.DeleteSession(context.Background(), createResp.UID)
	require.NoError(t, err)
	require.NotNil(t, createResp.UID, delMigResp.UID)
}

func Test_GetSnapshotStatusFromGMS(t *testing.T) {
	s := setUpServiceTest(t, false).(*Service)

	gmsClientMock := &gmsClientMock{}
	s.gmsClient = gmsClientMock

	// Insert a session and snapshot into the database before we start
	sess, err := s.store.CreateMigrationSession(context.Background(), cloudmigration.CloudMigrationSession{})
	require.NoError(t, err)
	uid, err := s.store.CreateSnapshot(context.Background(), cloudmigration.CloudMigrationSnapshot{
		UID:            "test uid",
		SessionUID:     sess.UID,
		Status:         cloudmigration.SnapshotStatusCreating,
		GMSSnapshotUID: "gms uid",
	})
	require.NoError(t, err)
	assert.Equal(t, "test uid", uid)

	// Make sure status is coming from the db only
	snapshot, err := s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
		SnapshotUID: uid,
		SessionUID:  sess.UID,
	})
	assert.NoError(t, err)
	assert.Equal(t, cloudmigration.SnapshotStatusCreating, snapshot.Status)
	assert.Equal(t, 0, gmsClientMock.getStatusCalled)

	// Make the status pending processing and ensure GMS gets called
	err = s.store.UpdateSnapshot(context.Background(), cloudmigration.UpdateSnapshotCmd{
		UID:    uid,
		Status: cloudmigration.SnapshotStatusPendingProcessing,
	})
	assert.NoError(t, err)

	cleanupFunc := func() {
		gmsClientMock.getStatusCalled = 0
		err = s.store.UpdateSnapshot(context.Background(), cloudmigration.UpdateSnapshotCmd{
			UID:    uid,
			Status: cloudmigration.SnapshotStatusPendingProcessing,
		})
		assert.NoError(t, err)
	}

	t.Run("test case: gms snapshot initialized", func(t *testing.T) {
		gmsClientMock.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{
			State: cloudmigration.SnapshotStateInitialized,
		}
		snapshot, err = s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, cloudmigration.SnapshotStatusPendingProcessing, snapshot.Status)
		assert.Equal(t, 1, gmsClientMock.getStatusCalled)

		t.Cleanup(cleanupFunc)
	})

	t.Run("test case: gms snapshot processing", func(t *testing.T) {
		gmsClientMock.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{
			State: cloudmigration.SnapshotStateProcessing,
		}
		snapshot, err = s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, cloudmigration.SnapshotStatusProcessing, snapshot.Status)
		assert.Equal(t, 1, gmsClientMock.getStatusCalled)

		t.Cleanup(cleanupFunc)
	})

	t.Run("test case: gms snapshot finished", func(t *testing.T) {
		gmsClientMock.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{
			State: cloudmigration.SnapshotStateFinished,
		}
		snapshot, err = s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, cloudmigration.SnapshotStatusFinished, snapshot.Status)
		assert.Equal(t, 1, gmsClientMock.getStatusCalled)

		t.Cleanup(cleanupFunc)
	})

	t.Run("test case: gms snapshot canceled", func(t *testing.T) {
		gmsClientMock.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{
			State: cloudmigration.SnapshotStateCanceled,
		}
		snapshot, err = s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, cloudmigration.SnapshotStatusCanceled, snapshot.Status)
		assert.Equal(t, 1, gmsClientMock.getStatusCalled)

		t.Cleanup(cleanupFunc)
	})

	t.Run("test case: gms snapshot error", func(t *testing.T) {
		gmsClientMock.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{
			State: cloudmigration.SnapshotStateError,
		}
		snapshot, err = s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, cloudmigration.SnapshotStatusError, snapshot.Status)
		assert.Equal(t, 1, gmsClientMock.getStatusCalled)

		t.Cleanup(cleanupFunc)
	})

	t.Run("test case: gms snapshot unknown", func(t *testing.T) {
		gmsClientMock.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{
			State: cloudmigration.SnapshotStateUnknown,
		}
		snapshot, err = s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
		})
		assert.NoError(t, err)
		// snapshot status should remain unchanged
		assert.Equal(t, cloudmigration.SnapshotStatusPendingProcessing, snapshot.Status)
		assert.Equal(t, 1, gmsClientMock.getStatusCalled)

		t.Cleanup(cleanupFunc)
	})

	t.Run("GMS results applied to local snapshot", func(t *testing.T) {
		gmsClientMock.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{
			State: cloudmigration.SnapshotStateFinished,
			Results: []cloudmigration.CloudMigrationResource{
				{
					Type:   cloudmigration.DatasourceDataType,
					RefID:  "A",
					Status: cloudmigration.ItemStatusError,
					Error:  "fake",
				},
			},
		}

		snapshot, err = s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, cloudmigration.SnapshotStatusFinished, snapshot.Status)
		assert.Equal(t, 1, gmsClientMock.getStatusCalled)
		assert.Len(t, snapshot.Resources, 1)
		assert.Equal(t, gmsClientMock.getSnapshotResponse.Results[0], snapshot.Resources[0])

		// ensure it is persisted
		snapshot, err = s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
			ResultPage:  1,
			ResultLimit: 100,
		})
		assert.NoError(t, err)
		assert.Equal(t, cloudmigration.SnapshotStatusFinished, snapshot.Status)
		assert.Equal(t, 1, gmsClientMock.getStatusCalled) // shouldn't have queried GMS again now that it is finished
		assert.Len(t, snapshot.Resources, 1)
		assert.Equal(t, "A", snapshot.Resources[0].RefID)
		assert.Equal(t, "fake", snapshot.Resources[0].Error)

		t.Cleanup(cleanupFunc)
	})
}

func Test_OnlyQueriesStatusFromGMSWhenRequired(t *testing.T) {
	s := setUpServiceTest(t, false).(*Service)

	gmsClientMock := &gmsClientMock{
		getSnapshotResponse: &cloudmigration.GetSnapshotStatusResponse{
			State: cloudmigration.SnapshotStateFinished,
		},
	}
	s.gmsClient = gmsClientMock

	// Insert a snapshot into the database before we start
	sess, err := s.store.CreateMigrationSession(context.Background(), cloudmigration.CloudMigrationSession{})
	require.NoError(t, err)
	uid, err := s.store.CreateSnapshot(context.Background(), cloudmigration.CloudMigrationSnapshot{
		UID:            uuid.NewString(),
		SessionUID:     sess.UID,
		Status:         cloudmigration.SnapshotStatusCreating,
		GMSSnapshotUID: "gms uid",
	})
	require.NoError(t, err)

	// make sure GMS is not called when snapshot is creating, pending upload, uploading, finished, canceled, or errored
	for _, status := range []cloudmigration.SnapshotStatus{
		cloudmigration.SnapshotStatusCreating,
		cloudmigration.SnapshotStatusPendingUpload,
		cloudmigration.SnapshotStatusUploading,
		cloudmigration.SnapshotStatusFinished,
		cloudmigration.SnapshotStatusCanceled,
		cloudmigration.SnapshotStatusError,
	} {
		err = s.store.UpdateSnapshot(context.Background(), cloudmigration.UpdateSnapshotCmd{
			UID:    uid,
			Status: status,
		})
		assert.NoError(t, err)
		_, err := s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, 0, gmsClientMock.getStatusCalled)
	}

	// make sure GMS is called when snapshot is pending processing or processing
	for i, status := range []cloudmigration.SnapshotStatus{
		cloudmigration.SnapshotStatusPendingProcessing,
		cloudmigration.SnapshotStatusProcessing,
	} {
		err = s.store.UpdateSnapshot(context.Background(), cloudmigration.UpdateSnapshotCmd{
			UID:    uid,
			Status: status,
		})
		assert.NoError(t, err)
		_, err := s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, i+1, gmsClientMock.getStatusCalled)
	}
}

func Test_DeletedDashboardsNotMigrated(t *testing.T) {
	s := setUpServiceTest(t, false).(*Service)
	// modify what the mock returns for just this test case
	dashMock := s.dashboardService.(*dashboards.FakeDashboardService)
	dashMock.On("GetAllDashboards", mock.Anything).Return(
		[]*dashboards.Dashboard{
			{
				UID:  "1",
				Data: simplejson.New(),
			},
			{
				UID:     "2",
				Data:    simplejson.New(),
				Deleted: time.Now(),
			},
		},
		nil,
	)

	data, err := s.getMigrationDataJSON(context.TODO(), &user.SignedInUser{OrgID: 1})
	assert.NoError(t, err)
	dashCount := 0
	for _, it := range data.Items {
		if it.Type == cloudmigration.DashboardDataType {
			dashCount++
		}
	}
	assert.Equal(t, 1, dashCount)
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
		ExpectedFolder: &folder.Folder{UID: "folderUID", Title: "Folder"},
	}

	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection("cloud_migration")
	require.NoError(t, err)
	_, err = section.NewKey("domain", "localhost:1234")
	require.NoError(t, err)

	cfg.CloudMigration.IsDeveloperMode = true // ensure local implementations are used
	cfg.CloudMigration.SnapshotFolder = filepath.Join(os.TempDir(), uuid.NewString())

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

	dsService := &datafakes.FakeDataSourceService{
		DataSources: []*datasources.DataSource{
			{Name: "mmm", Type: "mysql"},
			{Name: "ZZZ", Type: "infinity"},
		},
	}

	s, err := ProvideService(
		cfg,
		featuremgmt.WithFeatures(
			featuremgmt.FlagOnPremToCloudMigrations,
			featuremgmt.FlagDashboardRestore),
		sqlStore,
		dsService,
		secretsService,
		rr,
		prometheus.DefaultRegisterer,
		tracer,
		dashboardService,
		mockFolder,
		kvstore.ProvideService(sqlStore),
	)
	require.NoError(t, err)

	return s
}

type gmsClientMock struct {
	validateKeyCalled     int
	startSnapshotCalled   int
	getStatusCalled       int
	createUploadUrlCalled int
	reportEventCalled     int

	getSnapshotResponse *cloudmigration.GetSnapshotStatusResponse
}

func (m *gmsClientMock) ValidateKey(_ context.Context, _ cloudmigration.CloudMigrationSession) error {
	m.validateKeyCalled++
	return nil
}

func (m *gmsClientMock) MigrateData(_ context.Context, _ cloudmigration.CloudMigrationSession, _ cloudmigration.MigrateDataRequest) (*cloudmigration.MigrateDataResponse, error) {
	panic("not implemented") // TODO: Implement
}

func (m *gmsClientMock) StartSnapshot(_ context.Context, _ cloudmigration.CloudMigrationSession) (*cloudmigration.StartSnapshotResponse, error) {
	m.startSnapshotCalled++
	return nil, nil
}

func (m *gmsClientMock) GetSnapshotStatus(_ context.Context, _ cloudmigration.CloudMigrationSession, _ cloudmigration.CloudMigrationSnapshot, _ int) (*cloudmigration.GetSnapshotStatusResponse, error) {
	m.getStatusCalled++
	return m.getSnapshotResponse, nil
}

func (m *gmsClientMock) CreatePresignedUploadUrl(ctx context.Context, session cloudmigration.CloudMigrationSession, snapshot cloudmigration.CloudMigrationSnapshot) (string, error) {
	m.createUploadUrlCalled++
	return "http://localhost:3000", nil
}

func (m *gmsClientMock) ReportEvent(context.Context, cloudmigration.CloudMigrationSession, gmsclient.EventRequestDTO) {
	m.reportEventCalled++
}
