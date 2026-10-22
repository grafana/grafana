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
	"testing/synctest"
	"time"
	"uuid"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
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
	ngalertprovisioning "github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	ngalertstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	ngalertprovenance "github.com/grafana/grafana/pkg/services/ngalert/store/provenance"
	ngalertrules "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	ngalertfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
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

	s := setUpServiceTest(t)

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
	for _, tc := range []struct {
		state cloudmigration.SnapshotState
		want  cloudmigration.SnapshotStatus
	}{
		{state: cloudmigration.SnapshotStateInitialized, want: cloudmigration.SnapshotStatusPendingProcessing},
		{state: cloudmigration.SnapshotStateProcessing, want: cloudmigration.SnapshotStatusProcessing},
		{state: cloudmigration.SnapshotStateFinished, want: cloudmigration.SnapshotStatusFinished},
		{state: cloudmigration.SnapshotStateCanceled, want: cloudmigration.SnapshotStatusCanceled},
		{state: cloudmigration.SnapshotStateError, want: cloudmigration.SnapshotStatusError},
		{state: cloudmigration.SnapshotStateUnknown, want: cloudmigration.SnapshotStatusPendingProcessing},
	} {
		t.Run(string(tc.state), func(t *testing.T) {
			s, gms, query := setUpSnapshotStatusTest(t, cloudmigration.SnapshotStatusPendingProcessing)

			synctest.Test(t, func(t *testing.T) {
				t.Cleanup(func() { stopSnapshotStatusSync(s) })

				gms.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{State: tc.state}

				snapshot, err := s.GetSnapshot(t.Context(), query)
				require.NoError(t, err)
				require.Equal(t, cloudmigration.SnapshotStatusPendingProcessing, snapshot.Status)

				// Let the initial GMS request finish before checking the persisted local state.
				synctest.Wait()

				snapshot, err = s.GetSnapshot(t.Context(), query)
				require.NoError(t, err)
				require.Equal(t, tc.want, snapshot.Status)

				// Let the second GetSnapshot attempt a sync before checking for duplicate GMS calls.
				synctest.Wait()
				require.Equal(t, 1, gms.GetSnapshotStatusCallCount())
			})
		})
	}

	t.Run("GMS results applied to local snapshot", func(t *testing.T) {
		s, gms, query := setUpSnapshotStatusTest(t, cloudmigration.SnapshotStatusPendingProcessing)

		query.SnapshotResultQueryParams = cloudmigration.SnapshotResultQueryParams{
			ResultLimit: 10,
			ResultPage:  1,
			SortColumn:  cloudmigration.SortColumnID,
			SortOrder:   cloudmigration.SortOrderAsc,
		}

		synctest.Test(t, func(t *testing.T) {
			t.Cleanup(func() { stopSnapshotStatusSync(s) })

			resource := cloudmigration.CloudMigrationResource{
				Name:   "A name",
				Type:   cloudmigration.DatasourceDataType,
				RefID:  "A",
				Status: cloudmigration.ItemStatusPending,
			}
			require.NoError(t, s.store.UpdateSnapshot(t.Context(), cloudmigration.UpdateSnapshotCmd{
				UID:                    query.SnapshotUID,
				SessionID:              query.SessionUID,
				LocalResourcesToCreate: []cloudmigration.CloudMigrationResource{resource},
			}))
			resource.Status = cloudmigration.ItemStatusError
			resource.Error = "fake"

			gms.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{
				State:   cloudmigration.SnapshotStateFinished,
				Results: []cloudmigration.CloudMigrationResource{resource},
			}

			_, err := s.GetSnapshot(t.Context(), query)
			require.NoError(t, err)

			// Let the GMS results reach the database before checking the returned resource errors.
			synctest.Wait()

			snapshot, err := s.GetSnapshot(t.Context(), query)
			require.NoError(t, err)
			require.Equal(t, cloudmigration.SnapshotStatusFinished, snapshot.Status)
			require.Len(t, snapshot.Resources, 1)
			require.Equal(t, resource.RefID, snapshot.Resources[0].RefID)
			require.Equal(t, resource.Status, snapshot.Resources[0].Status)
			require.Equal(t, resource.Error, snapshot.Resources[0].Error)

			// Run the read's background task so an unwanted second GMS call cannot escape this check.
			synctest.Wait()
			require.Equal(t, 1, gms.GetSnapshotStatusCallCount())
		})
	})

	t.Run("polls until finished without starting another sync", func(t *testing.T) {
		s, gms, query := setUpSnapshotStatusTest(t, cloudmigration.SnapshotStatusPendingProcessing)

		synctest.Test(t, func(t *testing.T) {
			t.Cleanup(func() { stopSnapshotStatusSync(s) })

			gms.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{
				State: cloudmigration.SnapshotStateProcessing,
			}

			_, err := s.GetSnapshot(t.Context(), query)
			require.NoError(t, err)

			// Finish the initial sync so the poller is waiting on its first tick.
			synctest.Wait()
			require.Equal(t, 1, gms.GetSnapshotStatusCallCount())

			snapshot, err := s.GetSnapshot(t.Context(), query)
			require.NoError(t, err)
			require.Equal(t, cloudmigration.SnapshotStatusProcessing, snapshot.Status)

			// Let the second GetSnapshot try to start a sync while the existing poller is active.
			synctest.Wait()
			require.Equal(t, 1, gms.GetSnapshotStatusCallCount())

			gms.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{
				State: cloudmigration.SnapshotStateFinished,
			}

			// Move the fake clock just before the 10-second poll to check that no request
			// happens early. Sleep also waits for the bubble's goroutines to settle.
			synctest.Sleep(10*time.Second - time.Nanosecond)
			require.Equal(t, 1, gms.GetSnapshotStatusCallCount())

			// Cross the exact polling boundary and wait for the resulting sync to finish.
			synctest.Sleep(time.Nanosecond)

			snapshot, err = s.GetSnapshot(t.Context(), query)
			require.NoError(t, err)
			require.Equal(t, cloudmigration.SnapshotStatusFinished, snapshot.Status)

			// Let the final read attempt a sync before checking that it cannot restart polling.
			synctest.Wait()
			require.Equal(t, 2, gms.GetSnapshotStatusCallCount())

			// Advance through three more polling intervals to catch polling after completion.
			synctest.Sleep(30 * time.Second)
			require.Equal(t, 2, gms.GetSnapshotStatusCallCount())
		})
	})
}

func Test_OnlyQueriesStatusFromGMSWhenRequired(t *testing.T) {
	s, gms, query := setUpSnapshotStatusTest(t, cloudmigration.SnapshotStatusCreating)

	gms.getSnapshotResponse = &cloudmigration.GetSnapshotStatusResponse{
		State: cloudmigration.SnapshotStateFinished,
	}

	synctest.Test(t, func(t *testing.T) {
		t.Cleanup(func() { stopSnapshotStatusSync(s) })

		for _, tc := range []struct {
			status    cloudmigration.SnapshotStatus
			wantCalls int
		}{
			{status: cloudmigration.SnapshotStatusCreating, wantCalls: 0},
			{status: cloudmigration.SnapshotStatusPendingUpload, wantCalls: 0},
			{status: cloudmigration.SnapshotStatusUploading, wantCalls: 0},
			{status: cloudmigration.SnapshotStatusFinished, wantCalls: 0},
			{status: cloudmigration.SnapshotStatusCanceled, wantCalls: 0},
			{status: cloudmigration.SnapshotStatusError, wantCalls: 0},
			{status: cloudmigration.SnapshotStatusPendingProcessing, wantCalls: 1},
			{status: cloudmigration.SnapshotStatusProcessing, wantCalls: 1},
		} {
			callsBefore := gms.GetSnapshotStatusCallCount()
			if tc.wantCalls > 0 {
				// Each sync must finish and release the service-wide guard before the next snapshot starts, without cancellation between snapshots.
				query.SnapshotUID = uuid.NewV4().String()
				require.NoError(t, s.store.CreateSnapshot(t.Context(), cloudmigration.CloudMigrationSnapshot{
					UID:            query.SnapshotUID,
					SessionUID:     query.SessionUID,
					Status:         tc.status,
					GMSSnapshotUID: "gms uid 2",
				}))
			} else {
				require.NoError(t, s.store.UpdateSnapshot(t.Context(), cloudmigration.UpdateSnapshotCmd{
					UID:       query.SnapshotUID,
					SessionID: query.SessionUID,
					Status:    tc.status,
				}))
			}

			snapshot, err := s.GetSnapshot(t.Context(), query)
			require.NoError(t, err)
			require.Equal(t, tc.status, snapshot.Status)

			// Let the background sync persist GMS results or skip polling for this local status.
			synctest.Wait()

			wantStatus := tc.status
			if tc.wantCalls > 0 {
				wantStatus = cloudmigration.SnapshotStatusFinished
			}

			snapshot, err = s.GetSnapshot(t.Context(), query)
			require.NoError(t, err)
			require.Equal(t, wantStatus, snapshot.Status)

			// Include the second read's background task when checking for unwanted GMS calls.
			synctest.Wait()
			require.Equal(t, callsBefore+tc.wantCalls, gms.GetSnapshotStatusCallCount())

			// Across three polling intervals, local states must never query GMS,
			// and snapshots that finished syncing must not query it again.
			synctest.Sleep(30 * time.Second)
			require.Equal(t, callsBefore+tc.wantCalls, gms.GetSnapshotStatusCallCount())
		}
	})
}

func setUpSnapshotStatusTest(t *testing.T, status cloudmigration.SnapshotStatus) (*Service, *gmsClientMock, cloudmigration.GetSnapshotsQuery) {
	t.Helper()

	// Set up serially and outside synctest: migrations and tracing use shared state.
	s := setUpServiceTest(t).(*Service)
	gms := &gmsClientMock{}
	s.gmsClient = gms

	token, err := s.CreateToken(t.Context())
	require.NoError(t, err)

	session, err := s.store.CreateMigrationSession(t.Context(), cloudmigration.CloudMigrationSession{
		AuthToken: token.Token,
	})
	require.NoError(t, err)

	query := cloudmigration.GetSnapshotsQuery{
		OrgID:       session.OrgID,
		SessionUID:  session.UID,
		SnapshotUID: uuid.NewV4().String(),
	}
	require.NoError(t, s.store.CreateSnapshot(t.Context(), cloudmigration.CloudMigrationSnapshot{
		UID:            query.SnapshotUID,
		SessionUID:     query.SessionUID,
		Status:         status,
		GMSSnapshotUID: "gms uid",
	}))

	return s, gms, query
}

func stopSnapshotStatusSync(s *Service) {
	// Synchronize with the poller before reading its shared cancellation function.
	synctest.Wait()

	// GetSnapshot detaches polling from the request context.
	if s.cancelFunc != nil {
		s.cancelFunc()

		// Stop polling and release the sync guard before the database is closed by cleanup.
		synctest.Wait()
	}
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

	s := setUpServiceTest(t).(*Service)
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

		s := setUpServiceTest(t).(*Service)
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

		s := setUpServiceTest(t).(*Service)
		s.gmsClient = gmsMock

		require.NotPanics(t, func() {
			s.report(ctx, &cloudmigration.CloudMigrationSession{}, gmsclient.EventConnect, time.Minute, nil, "user123")
		})

		require.Equal(t, 1, gmsMock.reportEventCalled)
	})
}

func TestGetFolderNamesForFolderUIDs(t *testing.T) {
	t.Parallel()

	s := setUpServiceTest(t).(*Service)
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

	s := setUpServiceTest(t).(*Service)

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

	s := setUpServiceTest(t).(*Service)

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

	s := setUpServiceTest(t).(*Service)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	user := &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				pluginaccesscontrol.ActionInstall: {pluginaccesscontrol.ScopeProvider.GetResourceAllScope()},
				pluginaccesscontrol.ActionWrite:   {pluginaccesscontrol.ScopeProvider.GetResourceAllScope()},
			},
		},
	}

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
	pluginsIDs := make([]string, 0) //nolint:prealloc
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

func setUpServiceTest(t *testing.T, cfgOverrides ...configOverrides) cloudmigration.Service {
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

	cfg.CloudMigration.Enabled = true
	cfg.CloudMigration.IsDeveloperMode = true // ensure local implementations are used
	cfg.CloudMigration.SnapshotFolder = filepath.Join(os.TempDir(), uuid.NewV4().String())

	dashboardService := dashboards.NewFakeDashboardService(t)

	dsService := &datafakes.FakeDataSourceService{
		DataSources: []*datasources.DataSource{
			{Name: "mmm", Type: "mysql"},
			{Name: "ZZZ", Type: "infinity"},
		},
	}

	featureToggles := featuremgmt.WithFeatures()

	sqlStore := sqlstore.NewTestStore(t,
		sqlstore.WithCfg(cfg),
		sqlstore.WithFeatureFlags(),
	)

	kvStore := kvstore.ProvideService(sqlStore)

	bus := bus.ProvideBus(tracer)

	accessControl := acimpl.ProvideAccessControl(featureToggles)
	fakeAccessControlService := actest.FakeService{}
	alertMetrics := metrics.NewNGAlert(prometheus.NewRegistry())

	cfg.UnifiedAlerting.DefaultRuleEvaluationInterval = time.Minute
	cfg.UnifiedAlerting.BaseInterval = time.Minute
	cfg.UnifiedAlerting.InitializationTimeout = 30 * time.Second
	alertingStore, err := ngalertstore.ProvideDBStore(sqlStore)
	require.NoError(t, err)
	provenanceStore := ngalertprovenance.ProvideProvenanceStore(featureToggles, sqlStore)
	ruleStore, err := ngalertrules.ProvideRuleStore(cfg, featureToggles, sqlStore, mockFolder, accessControl, provenanceStore)
	require.NoError(t, err)

	ng, err := ngalert.ProvideService(
		cfg, featureToggles, nil, nil, rr, sqlStore, kvStore, nil, nil, ngalertprovisioning.NoopRuleMutationValidator{}, quotatest.New(false, nil),
		secretsService, nil, alertMetrics, mockFolder, accessControl, dashboardService, nil, bus, fakeAccessControlService,
		annotationstest.NewFakeAnnotationsRepo(), &pluginstore.FakePluginStore{}, tracer, alertingStore, ruleStore, provenanceStore,
		httpclient.NewProvider(), nil, ngalertfakes.NewFakeReceiverPermissionsService(), ngalertfakes.NewFakeRoutePermissionsService(), ngalertfakes.NewFakeFolderPermissionsService(), usertest.NewUserServiceFake(), orgtest.NewOrgServiceFake(),
		nil, // clientGenerator
		nil, // cfgProvider
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
						"addresses": "<example@example.com>"
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
		accessControl,
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

func (m *gmsClientMock) StartSnapshot(_ context.Context, _ cloudmigration.CloudMigrationSession, _ cloudmigration.EncryptionAlgo) (*cloudmigration.StartSnapshotResponse, error) {
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
