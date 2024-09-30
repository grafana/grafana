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
	"github.com/grafana/grafana/pkg/plugins"
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
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	secretsfakes "github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskv "github.com/grafana/grafana/pkg/services/secrets/kvstore"
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
	assert.ErrorIs(t, err, cloudmigration.ErrTokenNotFound)

	cm := cloudmigration.CloudMigrationSession{}
	err = s.ValidateToken(context.Background(), cm)
	assert.NoError(t, err)
}

func Test_GetSnapshotStatusFromGMS(t *testing.T) {
	s := setUpServiceTest(t, false).(*Service)

	gmsClientMock := &gmsClientMock{}
	s.gmsClient = gmsClientMock

	// Insert a session and snapshot into the database before we start
	createTokenResp, err := s.CreateToken(context.Background())
	assert.NoError(t, err)
	assert.NotEmpty(t, createTokenResp.Token)

	sess, err := s.store.CreateMigrationSession(context.Background(), cloudmigration.CloudMigrationSession{
		AuthToken: createTokenResp.Token,
	})
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
		UID:       uid,
		SessionID: sess.UID,
		Status:    cloudmigration.SnapshotStatusPendingProcessing,
	})
	assert.NoError(t, err)

	cleanupFunc := func() {
		gmsClientMock.getStatusCalled = 0
		err = s.store.UpdateSnapshot(context.Background(), cloudmigration.UpdateSnapshotCmd{
			UID:       uid,
			SessionID: sess.UID,
			Status:    cloudmigration.SnapshotStatusPendingProcessing,
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
					Name:   "A name",
					Type:   cloudmigration.DatasourceDataType,
					RefID:  "A",
					Status: cloudmigration.ItemStatusError,
					Error:  "fake",
				},
			},
		}

		// ensure it is persisted
		snapshot, err = s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
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
	createTokenResp, err := s.CreateToken(context.Background())
	assert.NoError(t, err)
	assert.NotEmpty(t, createTokenResp.Token)

	sess, err := s.store.CreateMigrationSession(context.Background(), cloudmigration.CloudMigrationSession{
		AuthToken: createTokenResp.Token,
	})
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
			UID:       uid,
			SessionID: sess.UID,
			Status:    status,
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
			UID:       uid,
			SessionID: sess.UID,
			Status:    status,
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

// Implementation inspired by ChatGPT, OpenAI's language model.
func Test_SortFolders(t *testing.T) {
	folders := []folder.CreateFolderCommand{
		{UID: "a", ParentUID: "", Title: "Root"},
		{UID: "b", ParentUID: "a", Title: "Child of Root"},
		{UID: "c", ParentUID: "b", Title: "Child of b"},
		{UID: "d", ParentUID: "a", Title: "Another Child of Root"},
		{UID: "e", ParentUID: "", Title: "Another Root"},
	}

	expected := []folder.CreateFolderCommand{
		{UID: "a", ParentUID: "", Title: "Root"},
		{UID: "e", ParentUID: "", Title: "Another Root"},
		{UID: "b", ParentUID: "a", Title: "Child of Root"},
		{UID: "d", ParentUID: "a", Title: "Another Child of Root"},
		{UID: "c", ParentUID: "b", Title: "Child of b"},
	}

	sortedFolders := sortFolders(folders)

	require.Equal(t, expected, sortedFolders)
}

func Test_NonCoreDataSourcesHaveWarning(t *testing.T) {
	s := setUpServiceTest(t, false).(*Service)

	// Insert a processing snapshot into the database before we start so we query GMS
	createTokenResp, err := s.CreateToken(context.Background())
	assert.NoError(t, err)
	assert.NotEmpty(t, createTokenResp.Token)

	sess, err := s.store.CreateMigrationSession(context.Background(), cloudmigration.CloudMigrationSession{
		AuthToken: createTokenResp.Token,
	})
	require.NoError(t, err)
	snapshotUid, err := s.store.CreateSnapshot(context.Background(), cloudmigration.CloudMigrationSnapshot{
		UID:            uuid.NewString(),
		SessionUID:     sess.UID,
		Status:         cloudmigration.SnapshotStatusProcessing,
		GMSSnapshotUID: "gms uid",
	})
	require.NoError(t, err)

	// GMS should return: a core ds, a non-core ds, a non-core ds with an error, and a ds that has been uninstalled
	gmsClientMock := &gmsClientMock{
		getSnapshotResponse: &cloudmigration.GetSnapshotStatusResponse{
			State: cloudmigration.SnapshotStateFinished,
			Results: []cloudmigration.CloudMigrationResource{
				{
					Name:        "1 name",
					Type:        cloudmigration.DatasourceDataType,
					RefID:       "1", // this will be core
					Status:      cloudmigration.ItemStatusOK,
					SnapshotUID: snapshotUid,
				},
				{
					Name:        "2 name",
					Type:        cloudmigration.DatasourceDataType,
					RefID:       "2", // this will be non-core
					Status:      cloudmigration.ItemStatusOK,
					SnapshotUID: snapshotUid,
				},
				{
					Name:        "3 name",
					Type:        cloudmigration.DatasourceDataType,
					RefID:       "3", // this will be non-core with an error
					Status:      cloudmigration.ItemStatusError,
					Error:       "please don't overwrite me",
					SnapshotUID: snapshotUid,
				},
				{
					Name:        "4 name",
					Type:        cloudmigration.DatasourceDataType,
					RefID:       "4", // this will be deleted
					Status:      cloudmigration.ItemStatusOK,
					SnapshotUID: snapshotUid,
				},
			},
		},
	}
	s.gmsClient = gmsClientMock

	// Update the internal plugin store and ds store with seed data matching the descriptions above
	s.pluginStore = pluginstore.NewFakePluginStore([]pluginstore.Plugin{
		{
			JSONData: plugins.JSONData{
				ID: "1",
			},
			Class: plugins.ClassCore,
		},
		{
			JSONData: plugins.JSONData{
				ID: "2",
			},
			Class: plugins.ClassExternal,
		},
		{
			JSONData: plugins.JSONData{
				ID: "3",
			},
			Class: plugins.ClassExternal,
		},
	}...)

	s.dsService = &datafakes.FakeDataSourceService{
		DataSources: []*datasources.DataSource{
			{UID: "1", Type: "1"},
			{UID: "2", Type: "2"},
			{UID: "3", Type: "3"},
			{UID: "4", Type: "4"},
		},
	}

	// Retrieve the snapshot with results
	snapshot, err := s.GetSnapshot(ctxWithSignedInUser(), cloudmigration.GetSnapshotsQuery{
		SnapshotUID: snapshotUid,
		SessionUID:  sess.UID,
		ResultPage:  1,
		ResultLimit: 10,
	})
	assert.NoError(t, err)
	assert.Len(t, snapshot.Resources, 4)

	findRef := func(id string) *cloudmigration.CloudMigrationResource {
		for _, r := range snapshot.Resources {
			if r.RefID == id {
				return &r
			}
		}
		return nil
	}

	shouldBeUnaltered := findRef("1")
	assert.Equal(t, cloudmigration.ItemStatusOK, shouldBeUnaltered.Status)
	assert.Empty(t, shouldBeUnaltered.Error)

	shouldBeAltered := findRef("2")
	assert.Equal(t, cloudmigration.ItemStatusWarning, shouldBeAltered.Status)
	assert.Equal(t, shouldBeAltered.Error, "Only core data sources are supported. Please ensure the plugin is installed on the cloud stack.")

	shouldHaveOriginalError := findRef("3")
	assert.Equal(t, cloudmigration.ItemStatusError, shouldHaveOriginalError.Status)
	assert.Equal(t, shouldHaveOriginalError.Error, "please don't overwrite me")

	uninstalledAltered := findRef("4")
	assert.Equal(t, cloudmigration.ItemStatusWarning, uninstalledAltered.Status)
	assert.Equal(t, uninstalledAltered.Error, "Only core data sources are supported. Please ensure the plugin is installed on the cloud stack.")
}

func TestDeleteSession(t *testing.T) {
	s := setUpServiceTest(t, false).(*Service)

	t.Run("when deleting a session that does not exist in the database, it returns an error", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		session, err := s.DeleteSession(ctx, "invalid-session-uid")
		require.Nil(t, session)
		require.Error(t, err)
	})

	t.Run("when deleting an existing session, it returns the deleted session and no error", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		createTokenResp, err := s.CreateToken(ctx)
		require.NoError(t, err)
		require.NotEmpty(t, createTokenResp.Token)

		cmd := cloudmigration.CloudMigrationSessionRequest{
			AuthToken: createTokenResp.Token,
		}

		createResp, err := s.CreateSession(ctx, cmd)
		require.NoError(t, err)
		require.NotEmpty(t, createResp.UID)
		require.NotEmpty(t, createResp.Slug)

		deletedSession, err := s.DeleteSession(ctx, createResp.UID)
		require.NoError(t, err)
		require.NotNil(t, deletedSession)
		require.Equal(t, deletedSession.UID, createResp.UID)

		notFoundSession, err := s.GetSession(ctx, deletedSession.UID)
		require.ErrorIs(t, err, cloudmigration.ErrMigrationNotFound)
		require.Nil(t, notFoundSession)
	})
}

func TestReportEvent(t *testing.T) {
	t.Run("when the session is nil, it does not report the event", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		gmsMock := &gmsClientMock{}

		s := setUpServiceTest(t, false).(*Service)
		s.gmsClient = gmsMock

		require.NotPanics(t, func() {
			s.report(ctx, nil, gmsclient.EventConnect, time.Minute, nil)
		})

		require.Zero(t, gmsMock.reportEventCalled)
	})

	t.Run("when the session is not nil, it reports the event", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		gmsMock := &gmsClientMock{}

		s := setUpServiceTest(t, false).(*Service)
		s.gmsClient = gmsMock

		require.NotPanics(t, func() {
			s.report(ctx, &cloudmigration.CloudMigrationSession{}, gmsclient.EventConnect, time.Minute, nil)
		})

		require.Equal(t, 1, gmsMock.reportEventCalled)
	})
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
		secretskv.NewFakeSQLSecretsKVStore(t),
		secretsService,
		rr,
		prometheus.DefaultRegisterer,
		tracer,
		dashboardService,
		mockFolder,
		&pluginstore.FakePluginStore{},
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
