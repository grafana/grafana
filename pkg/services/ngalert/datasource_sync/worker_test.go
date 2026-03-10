package datasource_sync

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/alerting/definition"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	secretsfakes "github.com/grafana/grafana/pkg/services/secrets/fakes"
)

// mockDatasourceSyncStore implements store.DatasourceSyncStore.
type mockDatasourceSyncStore struct {
	mock.Mock
}

func (m *mockDatasourceSyncStore) GetAllDatasourceSyncs(ctx context.Context) ([]*ngmodels.DatasourceSync, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*ngmodels.DatasourceSync), args.Error(1)
}

func (m *mockDatasourceSyncStore) GetDatasourceSync(ctx context.Context, orgID int64) (*ngmodels.DatasourceSync, error) {
	args := m.Called(ctx, orgID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ngmodels.DatasourceSync), args.Error(1)
}

func (m *mockDatasourceSyncStore) UpsertDatasourceSync(ctx context.Context, sync *ngmodels.DatasourceSync) error {
	return m.Called(ctx, sync).Error(0)
}

func (m *mockDatasourceSyncStore) UpdateDatasourceSyncStatus(ctx context.Context, orgID int64, lastSyncAt time.Time, lastError string) error {
	return m.Called(ctx, orgID, lastSyncAt, lastError).Error(0)
}

// mockExtraConfigApplier implements ExtraConfigApplier.
type mockExtraConfigApplier struct {
	mock.Mock
}

func (m *mockExtraConfigApplier) SaveAndApplyExtraConfiguration(ctx context.Context, org int64, extraConfig apimodels.ExtraConfiguration, replace bool, dryRun bool) (definition.RenameResources, error) {
	args := m.Called(ctx, org, extraConfig, replace, dryRun)
	return args.Get(0).(definition.RenameResources), args.Error(1)
}

func TestWorker_SyncAll_SkipsDisabled(t *testing.T) {
	syncStore := &mockDatasourceSyncStore{}
	applier := &mockExtraConfigApplier{}

	syncs := []*ngmodels.DatasourceSync{
		{OrgID: 1, DatasourceUID: "ds1", Enabled: false},
	}
	syncStore.On("GetAllDatasourceSyncs", mock.Anything).Return(syncs, nil)

	w := &Worker{
		store:   syncStore,
		applier: applier,
		logger:  log.New("test"),
	}

	err := w.SyncAll(context.Background())
	require.NoError(t, err)
	applier.AssertNotCalled(t, "SaveAndApplyExtraConfiguration")
}

func TestWorker_SyncAll_FetchesAndApplies(t *testing.T) {
	fakeCfg := mimirConfigResponse{
		AlertmanagerConfig: "route:\n  receiver: default\nreceivers:\n  - name: default\n",
	}
	body, err := json.Marshal(fakeCfg)
	require.NoError(t, err)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/alertmanager/api/v1/alerts", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	}))
	defer srv.Close()

	ds := &datasources.DataSource{
		UID:      "ds1",
		OrgID:    1,
		URL:      srv.URL,
		JsonData: simplejson.NewFromAny(map[string]any{"implementation": "mimir"}),
	}

	dsSvc := &dsfakes.FakeDataSourceService{
		DataSources: []*datasources.DataSource{ds},
	}
	secretSvc := secretsfakes.NewFakeSecretsService()
	syncStore := &mockDatasourceSyncStore{}
	applier := &mockExtraConfigApplier{}

	syncs := []*ngmodels.DatasourceSync{
		{OrgID: 1, DatasourceUID: "ds1", Enabled: true},
	}
	syncStore.On("GetAllDatasourceSyncs", mock.Anything).Return(syncs, nil)
	syncStore.On("UpdateDatasourceSyncStatus", mock.Anything, int64(1), mock.Anything, "").Return(nil)
	applier.On("SaveAndApplyExtraConfiguration",
		mock.Anything,
		int64(1),
		mock.MatchedBy(func(ec apimodels.ExtraConfiguration) bool {
			return ec.Identifier == "ds1" && ec.AlertmanagerConfig == fakeCfg.AlertmanagerConfig
		}),
		true,
		false,
	).Return(definition.RenameResources{}, nil)

	w := &Worker{
		store:             syncStore,
		applier:           applier,
		datasourceService: dsSvc,
		secretService:     secretSvc,
		logger:            log.New("test"),
		httpClient:        srv.Client(),
	}

	err = w.SyncAll(context.Background())
	require.NoError(t, err)
	applier.AssertExpectations(t)
	syncStore.AssertExpectations(t)
}

func TestWorker_SyncAll_RecordsErrorOnDatasourceNotFound(t *testing.T) {
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: nil}
	secretSvc := secretsfakes.NewFakeSecretsService()
	syncStore := &mockDatasourceSyncStore{}
	applier := &mockExtraConfigApplier{}

	syncs := []*ngmodels.DatasourceSync{
		{OrgID: 1, DatasourceUID: "ds1", Enabled: true},
	}
	syncStore.On("GetAllDatasourceSyncs", mock.Anything).Return(syncs, nil)
	syncStore.On("UpdateDatasourceSyncStatus", mock.Anything, int64(1), mock.Anything,
		mock.MatchedBy(func(s string) bool { return s != "" }),
	).Return(nil)

	w := &Worker{
		store:             syncStore,
		applier:           applier,
		datasourceService: dsSvc,
		secretService:     secretSvc,
		logger:            log.New("test"),
		httpClient:        &http.Client{},
	}

	err := w.SyncAll(context.Background())
	require.NoError(t, err) // SyncAll itself succeeds; per-sync errors are recorded
	applier.AssertNotCalled(t, "SaveAndApplyExtraConfiguration")
	syncStore.AssertExpectations(t)
}

func TestWorker_SyncAll_RecordsErrorOnApplyFailure(t *testing.T) {
	fakeCfg := mimirConfigResponse{
		AlertmanagerConfig: "route:\n  receiver: default\n",
	}
	body, _ := json.Marshal(fakeCfg)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	}))
	defer srv.Close()

	ds := &datasources.DataSource{
		UID:      "ds1",
		OrgID:    1,
		URL:      srv.URL,
		JsonData: simplejson.NewFromAny(map[string]any{"implementation": "mimir"}),
	}
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}
	secretSvc := secretsfakes.NewFakeSecretsService()
	syncStore := &mockDatasourceSyncStore{}
	applier := &mockExtraConfigApplier{}

	syncs := []*ngmodels.DatasourceSync{
		{OrgID: 1, DatasourceUID: "ds1", Enabled: true},
	}
	syncStore.On("GetAllDatasourceSyncs", mock.Anything).Return(syncs, nil)
	syncStore.On("UpdateDatasourceSyncStatus", mock.Anything, int64(1), mock.Anything,
		mock.MatchedBy(func(s string) bool { return s != "" }),
	).Return(nil)
	applier.On("SaveAndApplyExtraConfiguration", mock.Anything, mock.Anything, mock.Anything, true, false).
		Return(definition.RenameResources{}, errors.New("apply failed"))

	w := &Worker{
		store:             syncStore,
		applier:           applier,
		datasourceService: dsSvc,
		secretService:     secretSvc,
		logger:            log.New("test"),
		httpClient:        srv.Client(),
	}

	err := w.SyncAll(context.Background())
	require.NoError(t, err)
	syncStore.AssertExpectations(t)
}

func TestWorker_Run_FeatureFlagDisabled(t *testing.T) {
	ft := featuremgmt.WithFeatures()
	syncStore := &mockDatasourceSyncStore{}
	w := &Worker{
		store:          syncStore,
		featureManager: ft,
		logger:         log.New("test"),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	err := w.Run(ctx)
	require.NoError(t, err)
	syncStore.AssertNotCalled(t, "GetAllDatasourceSyncs")
}

func TestWorker_BuildConfigURL(t *testing.T) {
	w := &Worker{}

	tests := []struct {
		name     string
		dsURL    string
		impl     string
		expected string
	}{
		{
			name:     "mimir without alertmanager suffix",
			dsURL:    "https://mimir.example.com",
			impl:     "mimir",
			expected: "https://mimir.example.com/alertmanager/api/v1/alerts",
		},
		{
			name:     "mimir with existing alertmanager suffix",
			dsURL:    "https://mimir.example.com/alertmanager",
			impl:     "mimir",
			expected: "https://mimir.example.com/alertmanager/api/v1/alerts",
		},
		{
			name:     "plain alertmanager no impl set",
			dsURL:    "https://am.example.com",
			impl:     "",
			expected: "https://am.example.com/api/v1/alerts",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			jsonData := simplejson.New()
			if tc.impl != "" {
				jsonData.Set("implementation", tc.impl)
			}
			ds := &datasources.DataSource{
				URL:      tc.dsURL,
				JsonData: jsonData,
			}
			got, err := w.buildConfigURL(ds)
			require.NoError(t, err)
			assert.Equal(t, tc.expected, got)
		})
	}
}
