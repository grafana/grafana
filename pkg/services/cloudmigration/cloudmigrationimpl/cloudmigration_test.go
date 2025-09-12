package cloudmigrationimpl

import (
	"context"
	"errors"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/cloudmigration/gmsclient"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	datafakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	libraryelementsfake "github.com/grafana/grafana/pkg/services/libraryelements/fake"
	libraryelements "github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	ngalertstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	ngalertfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	secretsfakes "github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskv "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

func Test_NoopServiceDoesNothing(t *testing.T) {
	t.Parallel()
	s := &NoopServiceImpl{}
	_, e := s.CreateToken(context.Background())
	assert.ErrorIs(t, e, cloudmigration.ErrFeatureDisabledError)
}

func Test_CreateGetAndDeleteToken(t *testing.T) {
	t.Parallel()

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
	t.Parallel()

	setupTest := func(ctx context.Context) (service *Service, snapshotUID string, sessionUID string) {
		s := setUpServiceTest(t, false).(*Service)

		gmsClientFake := &gmsClientMock{}
		s.gmsClient = gmsClientFake

		// Insert a session and snapshot into the database before we start
		createTokenResp, err := s.CreateToken(ctx)
		assert.NoError(t, err)
		assert.NotEmpty(t, createTokenResp.Token)

		sess, err := s.store.CreateMigrationSession(ctx, cloudmigration.CloudMigrationSession{
			AuthToken: createTokenResp.Token,
		})
		require.NoError(t, err)

		uid := "test uid"

		err = s.store.CreateSnapshot(ctx, cloudmigration.CloudMigrationSnapshot{
			UID:            uid,
			SessionUID:     sess.UID,
			Status:         cloudmigration.SnapshotStatusCreating,
			GMSSnapshotUID: "gms uid",
		})
		require.NoError(t, err)

		// Make sure status is coming from the db only
		snapshot, err := s.GetSnapshot(ctx, cloudmigration.GetSnapshotsQuery{
			SnapshotUID: uid,
			SessionUID:  sess.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, cloudmigration.SnapshotStatusCreating, snapshot.Status)
		assert.Never(t, func() bool { return gmsClientFake.GetSnapshotStatusCallCount() > 0 }, time.Second, 10*time.Millisecond)

		// Make the status pending processing to ensure GMS gets called and initialize a resource
		err = s.store.UpdateSnapshot(ctx, cloudmigration.UpdateSnapshotCmd{
			UID:       uid,
			SessionID: sess.UID,
			Status:    cloudmigration.SnapshotStatusPendingProcessing,
			LocalResourcesToCreate: []cloudmigration.CloudMigrationResource{
				{
					Name:   "A name",
					Type:   cloudmigration.DatasourceDataType,
					RefID:  "A",
					Status: cloudmigration.ItemStatusPending,
				},
			},
		})
		assert.NoError(t, err)

		return s, uid, sess.UID
	}

	checkStatusSync := func(ctx context.Context, s *Service, snapshotUID, sessionUID string, status cloudmigration.SnapshotStatus) func() bool {
		return func() bool {
			snapshot, err := s.GetSnapshot(ctx, cloudmigration.GetSnapshotsQuery{
				SnapshotUID: snapshotUID,
				SessionUID:  sessionUID,
			})
			if err != nil {
				return false
			}

			return snapshot.Status == status
		}
	}

	t.Run("test case: gms snapshot initialized", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		s, snapshotUID, sessionUID := setupTest(ctx)

		gmsClientFake := &gmsClientMock{
			getSnapshotResponse: &cloudmigration.GetSnapshotStatusResponse{
				State: cloudmigration.SnapshotStateInitialized,
			},
		}
		s.gmsClient = gmsClientFake

		_, err := s.GetSnapshot(ctx, cloudmigration.GetSnapshotsQuery{
			SnapshotUID: snapshotUID,
			SessionUID:  sessionUID,
		})
		require.NoError(t, err)
		require.Eventually(t, checkStatusSync(ctx, s, snapshotUID, sessionUID, cloudmigration.SnapshotStatusPendingProcessing), time.Second, 10*time.Millisecond)
		assert.True(t, gmsClientFake.GetSnapshotStatusCallCount() >= 1)
	})

	t.Run("test case: gms snapshot processing", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		s, snapshotUID, sessionUID := setupTest(ctx)

		gmsClientFake := &gmsClientMock{
			getSnapshotResponse: &cloudmigration.GetSnapshotStatusResponse{
				State: cloudmigration.SnapshotStateProcessing,
			},
		}
		s.gmsClient = gmsClientFake

		_, err := s.GetSnapshot(ctx, cloudmigration.GetSnapshotsQuery{
			SnapshotUID: snapshotUID,
			SessionUID:  sessionUID,
		})
		require.NoError(t, err)
		require.Eventually(t, checkStatusSync(ctx, s, snapshotUID, sessionUID, cloudmigration.SnapshotStatusProcessing), time.Second, 10*time.Millisecond)
		assert.True(t, gmsClientFake.GetSnapshotStatusCallCount() >= 1)
	})

	t.Run("test case: gms snapshot finished", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		s, snapshotUID, sessionUID := setupTest(ctx)

		gmsClientFake := &gmsClientMock{
			getSnapshotResponse: &cloudmigration.GetSnapshotStatusResponse{
				State: cloudmigration.SnapshotStateFinished,
			},
		}
		s.gmsClient = gmsClientFake

		_, err := s.GetSnapshot(ctx, cloudmigration.GetSnapshotsQuery{
			SnapshotUID: snapshotUID,
			SessionUID:  sessionUID,
		})
		require.NoError(t, err)
		require.Eventually(t, checkStatusSync(ctx, s, snapshotUID, sessionUID, cloudmigration.SnapshotStatusFinished), time.Second, 10*time.Millisecond)
		assert.True(t, gmsClientFake.GetSnapshotStatusCallCount() >= 1)
	})

	t.Run("test case: gms snapshot canceled", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		s, snapshotUID, sessionUID := setupTest(ctx)

		gmsClientFake := &gmsClientMock{
			getSnapshotResponse: &cloudmigration.GetSnapshotStatusResponse{
				State: cloudmigration.SnapshotStateCanceled,
			},
		}
		s.gmsClient = gmsClientFake

		_, err := s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: snapshotUID,
			SessionUID:  sessionUID,
		})
		require.NoError(t, err)
		require.Eventually(t, checkStatusSync(ctx, s, snapshotUID, sessionUID, cloudmigration.SnapshotStatusCanceled), time.Second, 10*time.Millisecond)
		require.True(t, gmsClientFake.GetSnapshotStatusCallCount() >= 1)
	})

	t.Run("test case: gms snapshot error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		s, snapshotUID, sessionUID := setupTest(ctx)

		gmsClientFake := &gmsClientMock{
			getSnapshotResponse: &cloudmigration.GetSnapshotStatusResponse{
				State: cloudmigration.SnapshotStateError,
			},
		}
		s.gmsClient = gmsClientFake

		_, err := s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: snapshotUID,
			SessionUID:  sessionUID,
		})
		require.NoError(t, err)
		require.Eventually(t, checkStatusSync(ctx, s, snapshotUID, sessionUID, cloudmigration.SnapshotStatusError), time.Second, 10*time.Millisecond)
		assert.True(t, gmsClientFake.GetSnapshotStatusCallCount() >= 1)
	})

	t.Run("test case: gms snapshot unknown", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		s, snapshotUID, sessionUID := setupTest(ctx)

		gmsClientFake := &gmsClientMock{
			getSnapshotResponse: &cloudmigration.GetSnapshotStatusResponse{
				State: cloudmigration.SnapshotStateUnknown,
			},
		}
		s.gmsClient = gmsClientFake

		snapshot, err := s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: snapshotUID,
			SessionUID:  sessionUID,
		})
		require.NoError(t, err)
		require.NotNil(t, snapshot)

		// snapshot status should remain unchanged
		require.Eventually(t, func() bool { return gmsClientFake.GetSnapshotStatusCallCount() == 1 }, time.Second, 10*time.Millisecond)

		snapshot, err = s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: snapshotUID,
			SessionUID:  sessionUID,
		})
		require.NoError(t, err)
		require.NotNil(t, snapshot)
		require.Equal(t, cloudmigration.SnapshotStatusPendingProcessing, snapshot.Status)
	})

	t.Run("GMS results applied to local snapshot", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		s, snapshotUID, sessionUID := setupTest(ctx)

		gmsClientFake := &gmsClientMock{
			getSnapshotResponse: &cloudmigration.GetSnapshotStatusResponse{
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
			},
		}
		s.gmsClient = gmsClientFake

		// ensure it is persisted
		snapshot, err := s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
			SnapshotUID: snapshotUID,
			SessionUID:  sessionUID,
		})
		require.NoError(t, err)
		require.NotNil(t, snapshot)
		require.Eventually(t, func() bool { return gmsClientFake.GetSnapshotStatusCallCount() == 1 }, time.Second, 10*time.Millisecond)

		require.EventuallyWithTf(t, func(t *assert.CollectT) {
			snapshot, err := s.GetSnapshot(context.Background(), cloudmigration.GetSnapshotsQuery{
				SnapshotUID: snapshotUID,
				SessionUID:  sessionUID,
				SnapshotResultQueryParams: cloudmigration.SnapshotResultQueryParams{
					ResultLimit: 10,
					ResultPage:  1,
					SortColumn:  cloudmigration.SortColumnID,
					SortOrder:   cloudmigration.SortOrderAsc,
				},
			})
			assert.NoError(t, err)
			assert.NotNil(t, snapshot)
			assert.Len(t, snapshot.Resources, 1)
			assert.Equal(t, "A", snapshot.Resources[0].RefID)
			assert.Equal(t, "fake", snapshot.Resources[0].Error)
		}, 5*time.Second, 100*time.Millisecond, "DB wasn't applied to local snapshot in time")
	})
}

func Test_OnlyQueriesStatusFromGMSWhenRequired(t *testing.T) {
	t.Parallel()

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

	uid := uuid.NewString()
	err = s.store.CreateSnapshot(context.Background(), cloudmigration.CloudMigrationSnapshot{
		UID:            uid,
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
		assert.Never(t, func() bool { return gmsClientMock.GetSnapshotStatusCallCount() > 0 }, time.Second, 10*time.Millisecond)
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
		require.Eventually(t, func() bool { return gmsClientMock.GetSnapshotStatusCallCount() == i+1 }, time.Second, 10*time.Millisecond)
	}
	assert.Never(t, func() bool { return gmsClientMock.GetSnapshotStatusCallCount() > 2 }, time.Second, 10*time.Millisecond)
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

func TestDeleteSession(t *testing.T) {
	t.Parallel()

	s := setUpServiceTest(t, false).(*Service)
	user := &user.SignedInUser{UserUID: "user123"}

	t.Run("when deleting a session that does not exist in the database, it returns an error", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		session, err := s.DeleteSession(ctx, 2, user, "invalid-session-uid")
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
			OrgID:     3,
		}

		createResp, err := s.CreateSession(ctx, user, cmd)
		require.NoError(t, err)
		require.NotEmpty(t, createResp.UID)
		require.NotEmpty(t, createResp.Slug)

		deletedSession, err := s.DeleteSession(ctx, cmd.OrgID, user, createResp.UID)
		require.NoError(t, err)
		require.NotNil(t, deletedSession)
		require.Equal(t, deletedSession.UID, createResp.UID)

		notFoundSession, err := s.GetSession(ctx, cmd.OrgID, deletedSession.UID)
		require.ErrorIs(t, err, cloudmigration.ErrMigrationNotFound)
		require.Nil(t, notFoundSession)
	})
}

func TestReportEvent(t *testing.T) {
	t.Parallel()

	t.Run("when the session is nil, it does not report the event", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		gmsMock := &gmsClientMock{}

		s := setUpServiceTest(t, false).(*Service)
		s.gmsClient = gmsMock

		require.NotPanics(t, func() {
			s.report(ctx, nil, gmsclient.EventConnect, time.Minute, nil, "user123")
		})

		require.Zero(t, gmsMock.reportEventCalled)
	})

	t.Run("when the session is not nil, it reports the event", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		gmsMock := &gmsClientMock{}

		s := setUpServiceTest(t, false).(*Service)
		s.gmsClient = gmsMock

		require.NotPanics(t, func() {
			s.report(ctx, &cloudmigration.CloudMigrationSession{}, gmsclient.EventConnect, time.Minute, nil, "user123")
		})

		require.Equal(t, 1, gmsMock.reportEventCalled)
	})
}

func TestGetFolderNamesForFolderUIDs(t *testing.T) {
	t.Parallel()

	s := setUpServiceTest(t, false).(*Service)
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	user := &user.SignedInUser{OrgID: 1}

	testcases := []struct {
		folders             []*folder.Folder
		folderUIDs          []string
		expectedFolderNames []string
	}{
		{
			folders: []*folder.Folder{
				{UID: "folderUID-A", Title: "Folder A", OrgID: 1},
				{UID: "folderUID-B", Title: "Folder B", OrgID: 1},
			},
			folderUIDs:          []string{"folderUID-A", "folderUID-B"},
			expectedFolderNames: []string{"Folder A", "Folder B"},
		},
		{
			folders: []*folder.Folder{
				{UID: "folderUID-A", Title: "Folder A", OrgID: 1},
			},
			folderUIDs:          []string{"folderUID-A"},
			expectedFolderNames: []string{"Folder A"},
		},
		{
			folders:             []*folder.Folder{},
			folderUIDs:          []string{"folderUID-A"},
			expectedFolderNames: []string{""},
		},
		{
			folders: []*folder.Folder{
				{UID: "folderUID-A", Title: "Folder A", OrgID: 1},
			},
			folderUIDs:          []string{"folderUID-A", "folderUID-B"},
			expectedFolderNames: []string{"Folder A", ""},
		},
		{
			folders:             []*folder.Folder{},
			folderUIDs:          []string{""},
			expectedFolderNames: []string{""},
		},
		{
			folders:             []*folder.Folder{},
			folderUIDs:          []string{},
			expectedFolderNames: []string{},
		},
	}

	for _, tc := range testcases {
		s.folderService = &foldertest.FakeService{ExpectedFolders: tc.folders}

		folderUIDsToFolders, err := s.getFolderNamesForFolderUIDs(ctx, user, tc.folderUIDs)
		require.NoError(t, err)

		resFolderNames := slices.Collect(maps.Values(folderUIDsToFolders))
		require.Len(t, resFolderNames, len(tc.expectedFolderNames))

		require.ElementsMatch(t, resFolderNames, tc.expectedFolderNames)
	}
}

func TestGetParentNames(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	s := setUpServiceTest(t, false).(*Service)

	user := &user.SignedInUser{OrgID: 1}

	testcases := []struct {
		name                string
		fakeFolders         []*folder.Folder
		folderHierarchy     map[cloudmigration.MigrateDataType]map[string]string
		expectedParentNames map[cloudmigration.MigrateDataType]map[string]string
	}{
		{
			name: "multiple data types",
			fakeFolders: []*folder.Folder{
				{UID: "folderUID-A", Title: "Folder A", OrgID: 1},
				{UID: "folderUID-B", Title: "Folder B", OrgID: 1},
				{UID: "folderUID-C", Title: "Folder C", OrgID: 1},
			},
			folderHierarchy: map[cloudmigration.MigrateDataType]map[string]string{
				cloudmigration.DashboardDataType:      {"dashboard-1": "folderUID-A", "dashboard-2": "folderUID-B", "dashboard-3": ""},
				cloudmigration.LibraryElementDataType: {"libElement-1": "folderUID-A", "libElement-2": "folderUID-C"},
				cloudmigration.AlertRuleType:          {"alertRule-1": "folderUID-B"},
			},
			expectedParentNames: map[cloudmigration.MigrateDataType]map[string]string{
				cloudmigration.DashboardDataType:      {"dashboard-1": "Folder A", "dashboard-2": "Folder B", "dashboard-3": ""},
				cloudmigration.LibraryElementDataType: {"libElement-1": "Folder A", "libElement-2": "Folder C"},
				cloudmigration.AlertRuleType:          {"alertRule-1": "Folder B"},
			},
		},
		{
			name: "empty folder hierarchy",
			fakeFolders: []*folder.Folder{
				{UID: "folderUID-A", Title: "Folder A", OrgID: 1},
			},
			folderHierarchy:     map[cloudmigration.MigrateDataType]map[string]string{},
			expectedParentNames: map[cloudmigration.MigrateDataType]map[string]string{},
		},
		{
			name: "all root folders (no parents)",
			fakeFolders: []*folder.Folder{
				{UID: "folderUID-A", Title: "Folder A", OrgID: 1},
			},
			folderHierarchy: map[cloudmigration.MigrateDataType]map[string]string{
				cloudmigration.DashboardDataType:      {"dashboard-1": "", "dashboard-2": ""},
				cloudmigration.LibraryElementDataType: {"libElement-1": ""},
			},
			expectedParentNames: map[cloudmigration.MigrateDataType]map[string]string{
				cloudmigration.DashboardDataType:      {"dashboard-1": "", "dashboard-2": ""},
				cloudmigration.LibraryElementDataType: {"libElement-1": ""},
			},
		},
		{
			name: "non-existent folder UIDs",
			fakeFolders: []*folder.Folder{
				{UID: "folderUID-A", Title: "Folder A", OrgID: 1},
			},
			folderHierarchy: map[cloudmigration.MigrateDataType]map[string]string{
				cloudmigration.DashboardDataType: {"dashboard-1": "folderUID-A", "dashboard-2": "non-existent-uid"},
			},
			expectedParentNames: map[cloudmigration.MigrateDataType]map[string]string{
				cloudmigration.DashboardDataType: {"dashboard-1": "Folder A", "dashboard-2": ""},
			},
		},
	}

	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			s.folderService = &foldertest.FakeService{ExpectedFolders: tc.fakeFolders}

			dataUIDsToParentNamesByType, err := s.getParentNames(ctx, user, tc.folderHierarchy)
			require.NoError(t, err)

			for dataType, expectedParentNames := range tc.expectedParentNames {
				actualParentNames := dataUIDsToParentNamesByType[dataType]

				require.Equal(t, len(expectedParentNames), len(actualParentNames))

				for uid, expectedName := range expectedParentNames {
					actualName, exists := actualParentNames[uid]
					require.True(t, exists)
					require.Equal(t, expectedName, actualName)
				}
			}
		})
	}
}

func TestGetLibraryElementsCommands(t *testing.T) {
	t.Parallel()

	s := setUpServiceTest(t, false).(*Service)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	libraryElementService, ok := s.libraryElementsService.(*libraryelementsfake.LibraryElementService)
	require.True(t, ok)
	require.NotNil(t, libraryElementService)

	folderUID := "folder-uid"
	createLibraryElementCmd := libraryelements.CreateLibraryElementCommand{
		FolderUID: &folderUID,
		Name:      "library-element-1",
		Model:     []byte{},
		Kind:      int64(libraryelements.PanelElement),
		UID:       "library-element-uid-1",
	}

	user := &user.SignedInUser{OrgID: 1}

	_, err := libraryElementService.CreateElement(ctx, user, createLibraryElementCmd)
	require.NoError(t, err)

	cmds, err := s.getLibraryElementsCommands(ctx, user)
	require.NoError(t, err)
	require.Len(t, cmds, 1)
	require.Equal(t, createLibraryElementCmd.UID, cmds[0].UID)
}

// NOTE: this should be on the plugin object
func TestIsPublicSignatureType(t *testing.T) {
	testcases := []struct {
		signature      plugins.SignatureType
		expectedPublic bool
	}{
		{
			signature:      plugins.SignatureTypeCommunity,
			expectedPublic: true,
		},
		{
			signature:      plugins.SignatureTypeCommercial,
			expectedPublic: true,
		},
		{
			signature:      plugins.SignatureTypeGrafana,
			expectedPublic: true,
		},
		{
			signature:      plugins.SignatureTypePrivate,
			expectedPublic: false,
		},
		{
			signature:      plugins.SignatureTypePrivateGlob,
			expectedPublic: false,
		},
	}

	for _, testcase := range testcases {
		resPublic := IsPublicSignatureType(testcase.signature)
		require.Equal(t, resPublic, testcase.expectedPublic)
	}
}

func TestGetPlugins(t *testing.T) {
	t.Parallel()

	s := setUpServiceTest(t, false).(*Service)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	user := &user.SignedInUser{OrgID: 1}

	s.pluginStore = pluginstore.NewFakePluginStore([]pluginstore.Plugin{
		{
			JSONData: plugins.JSONData{
				ID:   "plugin-core",
				Type: plugins.TypeDataSource,
			},
			Class:         plugins.ClassCore,
			Signature:     plugins.SignatureStatusValid,
			SignatureType: plugins.SignatureTypeGrafana,
		},
		{
			JSONData: plugins.JSONData{
				ID:          "plugin-external-valid-grafana",
				Type:        plugins.TypeDataSource,
				AutoEnabled: false,
			},
			Class:         plugins.ClassExternal,
			Signature:     plugins.SignatureStatusValid,
			SignatureType: plugins.SignatureTypeGrafana,
		},
		{
			JSONData: plugins.JSONData{
				ID:   "plugin-external-valid-commercial",
				Type: plugins.TypePanel,
			},
			Class:         plugins.ClassExternal,
			Signature:     plugins.SignatureStatusValid,
			SignatureType: plugins.SignatureTypeCommercial,
		},
		{
			JSONData: plugins.JSONData{
				ID:   "plugin-external-valid-community",
				Type: plugins.TypePanel,
			},
			Class:         plugins.ClassExternal,
			Signature:     plugins.SignatureStatusValid,
			SignatureType: plugins.SignatureTypeCommunity,
		},
		{
			JSONData: plugins.JSONData{
				ID:   "plugin-external-invalid",
				Type: plugins.TypePanel,
			},
			Class:         plugins.ClassExternal,
			Signature:     plugins.SignatureStatusInvalid,
			SignatureType: plugins.SignatureTypeGrafana,
		},
		{
			JSONData: plugins.JSONData{
				ID:   "plugin-external-unsigned",
				Type: plugins.TypePanel,
			},
			Class:         plugins.ClassExternal,
			Signature:     plugins.SignatureStatusUnsigned,
			SignatureType: plugins.SignatureTypeGrafana,
		},
		{
			JSONData: plugins.JSONData{
				ID:   "plugin-external-valid-private",
				Type: plugins.TypeApp,
			},
			Class:         plugins.ClassExternal,
			Signature:     plugins.SignatureStatusUnsigned,
			SignatureType: plugins.SignatureTypePrivate,
		},
	}...)

	s.pluginSettingsService = &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
		"plugin-external-valid-grafana": {ID: 0, OrgID: user.OrgID, PluginID: "plugin-external-valid-grafana", PluginVersion: "1.0.0", Enabled: true},
	}}

	plugins, err := s.getPlugins(ctx, user)
	require.NoError(t, err)
	require.NotNil(t, plugins)
	require.Len(t, plugins, 3)

	expectedPluginIDs := []string{"plugin-external-valid-grafana", "plugin-external-valid-commercial", "plugin-external-valid-community"}
	pluginsIDs := make([]string, 0)
	for _, plugin := range plugins {
		// Special case of using the settings from the settings store
		if plugin.ID == "plugin-external-valid-grafana" {
			require.True(t, plugin.SettingCmd.Enabled)
		}

		pluginsIDs = append(pluginsIDs, plugin.ID)
	}
	require.ElementsMatch(t, pluginsIDs, expectedPluginIDs)
}

type configOverrides func(c *setting.Cfg)

func setUpServiceTest(t *testing.T, withDashboardMock bool, cfgOverrides ...configOverrides) cloudmigration.Service {
	secretsService := secretsfakes.NewFakeSecretsService()
	rr := routing.NewRouteRegister()
	tracer := tracing.InitializeTracerForTest()

	fakeFolder := &folder.Folder{UID: "folderUID", Title: "Folder", Fullpath: "Folder"}
	mockFolder := foldertest.NewFakeService()
	mockFolder.AddFolder(fakeFolder)

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

	featureToggles := featuremgmt.WithFeatures(
		featuremgmt.FlagOnPremToCloudMigrations,
	)

	sqlStore := sqlstore.NewTestStore(t,
		sqlstore.WithCfg(cfg),
		sqlstore.WithFeatureFlags(
			featuremgmt.FlagOnPremToCloudMigrations,
		),
	)

	kvStore := kvstore.ProvideService(sqlStore)

	bus := bus.ProvideBus(tracer)

	accessControl := acimpl.ProvideAccessControl(featureToggles)
	fakeAccessControlService := actest.FakeService{}
	alertMetrics := metrics.NewNGAlert(prometheus.NewRegistry())

	cfg.UnifiedAlerting.DefaultRuleEvaluationInterval = time.Minute
	cfg.UnifiedAlerting.BaseInterval = time.Minute
	cfg.UnifiedAlerting.InitializationTimeout = 30 * time.Second
	ruleStore, err := ngalertstore.ProvideDBStore(cfg, featureToggles, sqlStore, mockFolder, dashboardService, accessControl, bus)
	require.NoError(t, err)

	ng, err := ngalert.ProvideService(
		cfg, featureToggles, nil, nil, rr, sqlStore, kvStore, nil, nil, quotatest.New(false, nil),
		secretsService, nil, alertMetrics, mockFolder, accessControl, dashboardService, nil, bus, fakeAccessControlService,
		annotationstest.NewFakeAnnotationsRepo(), &pluginstore.FakePluginStore{}, tracer, ruleStore,
		httpclient.NewProvider(), nil, ngalertfakes.NewFakeReceiverPermissionsService(), usertest.NewUserServiceFake(),
	)
	require.NoError(t, err)

	validConfig := `{
		"alertmanager_config": {
			"route": {
				"receiver": "grafana-default-email"
			},
			"receivers": [{
				"name": "grafana-default-email",
				"grafana_managed_receiver_configs": [{
					"uid": "",
					"name": "email receiver",
					"type": "email",
					"settings": {
						"addresses": "<example@email.com>"
					}
				}]
			}]
		}
	}`
	require.NoError(t, ng.Api.AlertingStore.SaveAlertmanagerConfiguration(context.Background(), &models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: validConfig,
		OrgID:                     1,
		LastApplied:               time.Now().Unix(),
	}))

	// Insert test data for dashboard test, should be removed later when we move GetAllDashboardsByOrgId() to the dashboard service
	_, err = sqlStore.GetSqlxSession().Exec(context.Background(), `
		INSERT INTO
			dashboard (id, org_id, data, deleted, slug, title, created, version, updated )
		VALUES
			(1, 1, '{}', null, 'asdf', 'ghjk', '2024-03-27 15:30:43.000' , '1','2024-03-27 15:30:43.000' ),
			(2, 1, '{}', '2024-03-27 15:30:43.000','qwert', 'yuio', '2024-03-27 15:30:43.000' , '2','2024-03-27 15:30:43.000'),
			(3, 2, '{}', null, 'asdf', 'ghjk', '2024-03-27 15:30:43.000' , '1','2024-03-27 15:30:43.000' ),
			(4, 2, '{}', '2024-03-27 15:30:43.000','qwert', 'yuio', '2024-03-27 15:30:43.000' , '2','2024-03-27 15:30:43.000');
		`,
	)
	if err != nil {
		require.NoError(t, err)
	}

	for _, cfgOverride := range cfgOverrides {
		cfgOverride(cfg)
	}

	s, err := ProvideService(
		cfg,
		httpclient.NewProvider(),
		featureToggles,
		sqlStore,
		dsService,
		secretskv.NewFakeSQLSecretsKVStore(t, sqlStore),
		secretsService,
		rr,
		prometheus.DefaultRegisterer,
		tracer,
		dashboardService,
		mockFolder,
		&pluginstore.FakePluginStore{},
		&pluginsettings.FakePluginSettings{},
		actest.FakeAccessControl{ExpectedEvaluate: true},
		fakeAccessControlService,
		kvstore.ProvideService(sqlStore),
		&libraryelementsfake.LibraryElementService{},
		ng,
	)
	require.NoError(t, err)

	return s
}

type gmsClientMock struct {
	mu sync.RWMutex

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
	m.mu.Lock()
	m.getStatusCalled++
	m.mu.Unlock()
	if m.getSnapshotResponse == nil {
		return nil, errors.New("no response set")
	}

	return m.getSnapshotResponse, nil
}

func (m *gmsClientMock) CreatePresignedUploadUrl(ctx context.Context, session cloudmigration.CloudMigrationSession, snapshot cloudmigration.CloudMigrationSnapshot) (string, error) {
	m.createUploadUrlCalled++
	return "http://localhost:3000", nil
}

func (m *gmsClientMock) ReportEvent(context.Context, cloudmigration.CloudMigrationSession, gmsclient.EventRequestDTO) {
	m.reportEventCalled++
}

func (m *gmsClientMock) GetSnapshotStatusCallCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.getStatusCalled
}
