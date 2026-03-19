package provisioning

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// --- in-memory fake store for testing ---

type fakeAdminConfigStore struct {
	configs map[int64]*AdminConfig
	saveErr error
	getErr  error
	delErr  error
}

func newFakeAdminConfigStore() *fakeAdminConfigStore {
	return &fakeAdminConfigStore{configs: make(map[int64]*AdminConfig)}
}

func (f *fakeAdminConfigStore) GetAdminConfiguration(_ context.Context, orgID int64) (*AdminConfig, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	cfg, ok := f.configs[orgID]
	if !ok {
		return nil, nil
	}
	cp := *cfg
	return &cp, nil
}

func (f *fakeAdminConfigStore) SaveAdminConfiguration(_ context.Context, config AdminConfig) error {
	if f.saveErr != nil {
		return f.saveErr
	}
	cp := config
	f.configs[config.OrgID] = &cp
	return nil
}

func (f *fakeAdminConfigStore) DeleteAdminConfiguration(_ context.Context, orgID int64) error {
	if f.delErr != nil {
		return f.delErr
	}
	delete(f.configs, orgID)
	return nil
}

// --- helpers ---

func newAdminConfigSvc(t *testing.T) (*AlertmanagerAdminConfigService, *fakeAdminConfigStore, *fakes.FakeProvisioningStore) {
	t.Helper()
	store := newFakeAdminConfigStore()
	prov := fakes.NewFakeProvisioningStore()
	svc := NewAlertmanagerAdminConfigService(store, prov, newNopTransactionManager(), log.NewNopLogger())
	return svc, store, prov
}

// --- GetAdminConfiguration tests ---

func TestGetAdminConfiguration_ReturnsDefaultWhenNoneStored(t *testing.T) {
	svc, _, _ := newAdminConfigSvc(t)

	cfg, provenance, err := svc.GetAdminConfiguration(context.Background(), 1)

	require.NoError(t, err)
	assert.Equal(t, AlertmanagerTypeInternal, cfg.AlertmanagersChoice)
	assert.Equal(t, models.ProvenanceNone, provenance)
	assert.EqualValues(t, 1, cfg.OrgID)
}

func TestGetAdminConfiguration_ReturnsStoredConfig(t *testing.T) {
	svc, store, prov := newAdminConfigSvc(t)
	var orgID int64 = 42

	stored := AdminConfig{
		OrgID:                 orgID,
		AlertmanagersChoice:   AlertmanagerTypeExternal,
		ExternalAlertmanagers: []string{"http://mimir:9009/alertmanager"},
	}
	require.NoError(t, store.SaveAdminConfiguration(context.Background(), stored))
	require.NoError(t, prov.SetProvenance(context.Background(), &stored, orgID, models.ProvenanceFile))

	cfg, provenance, err := svc.GetAdminConfiguration(context.Background(), orgID)

	require.NoError(t, err)
	assert.Equal(t, AlertmanagerTypeExternal, cfg.AlertmanagersChoice)
	assert.Equal(t, models.ProvenanceFile, provenance)
	assert.Equal(t, stored.ExternalAlertmanagers, cfg.ExternalAlertmanagers)
}

func TestGetAdminConfiguration_PropagatesStoreError(t *testing.T) {
	svc, store, _ := newAdminConfigSvc(t)
	store.getErr = errors.New("db error")

	_, _, err := svc.GetAdminConfiguration(context.Background(), 1)

	require.ErrorContains(t, err, "db error")
}

// --- SaveAdminConfiguration tests ---

func TestSaveAdminConfiguration_ExternalOnly_RequiresURL(t *testing.T) {
	svc, _, _ := newAdminConfigSvc(t)

	err := svc.SaveAdminConfiguration(context.Background(), 1, AdminConfig{
		AlertmanagersChoice: AlertmanagerTypeExternal,
		// No ExternalAlertmanagers provided.
	}, models.ProvenanceAPI)

	require.ErrorIs(t, err, ErrValidation)
	require.ErrorContains(t, err, "at least one external Alertmanager URL")
}

func TestSaveAdminConfiguration_InvalidChoice(t *testing.T) {
	svc, _, _ := newAdminConfigSvc(t)

	err := svc.SaveAdminConfiguration(context.Background(), 1, AdminConfig{
		AlertmanagersChoice: "unknown",
	}, models.ProvenanceAPI)

	require.ErrorIs(t, err, ErrValidation)
	require.ErrorContains(t, err, "invalid alertmanagersChoice")
}

func TestSaveAdminConfiguration_ExternalOnly_Succeeds(t *testing.T) {
	svc, store, prov := newAdminConfigSvc(t)
	var orgID int64 = 5

	cfg := AdminConfig{
		AlertmanagersChoice:   AlertmanagerTypeExternal,
		ExternalAlertmanagers: []string{"http://mimir:9009/alertmanager"},
	}

	err := svc.SaveAdminConfiguration(context.Background(), orgID, cfg, models.ProvenanceFile)
	require.NoError(t, err)

	// Verify persisted.
	saved, _ := store.GetAdminConfiguration(context.Background(), orgID)
	require.NotNil(t, saved)
	assert.Equal(t, AlertmanagerTypeExternal, saved.AlertmanagersChoice)
	assert.Equal(t, cfg.ExternalAlertmanagers, saved.ExternalAlertmanagers)
	assert.EqualValues(t, orgID, saved.OrgID)

	// Verify provenance recorded.
	p, err := prov.GetProvenance(context.Background(), &AdminConfig{OrgID: orgID}, orgID)
	require.NoError(t, err)
	assert.Equal(t, models.ProvenanceFile, p)
}

func TestSaveAdminConfiguration_Both_Succeeds(t *testing.T) {
	svc, store, _ := newAdminConfigSvc(t)
	var orgID int64 = 7

	cfg := AdminConfig{
		AlertmanagersChoice:   AlertmanagerTypeBoth,
		ExternalAlertmanagers: []string{"http://external:9009"},
	}

	require.NoError(t, svc.SaveAdminConfiguration(context.Background(), orgID, cfg, models.ProvenanceAPI))

	saved, _ := store.GetAdminConfiguration(context.Background(), orgID)
	require.NotNil(t, saved)
	assert.Equal(t, AlertmanagerTypeBoth, saved.AlertmanagersChoice)
}

func TestSaveAdminConfiguration_Internal_Succeeds(t *testing.T) {
	svc, store, _ := newAdminConfigSvc(t)
	var orgID int64 = 8

	cfg := AdminConfig{
		AlertmanagersChoice: AlertmanagerTypeInternal,
	}

	require.NoError(t, svc.SaveAdminConfiguration(context.Background(), orgID, cfg, models.ProvenanceAPI))

	saved, _ := store.GetAdminConfiguration(context.Background(), orgID)
	require.NotNil(t, saved)
	assert.Equal(t, AlertmanagerTypeInternal, saved.AlertmanagersChoice)
}

func TestSaveAdminConfiguration_SetsOrgIDFromParameter(t *testing.T) {
	svc, store, _ := newAdminConfigSvc(t)
	var orgID int64 = 99

	// Pass a config with zero OrgID — service should set it from the parameter.
	cfg := AdminConfig{
		OrgID:                 0,
		AlertmanagersChoice:   AlertmanagerTypeExternal,
		ExternalAlertmanagers: []string{"http://am:9009"},
	}

	require.NoError(t, svc.SaveAdminConfiguration(context.Background(), orgID, cfg, models.ProvenanceAPI))

	saved, _ := store.GetAdminConfiguration(context.Background(), orgID)
	require.NotNil(t, saved)
	assert.EqualValues(t, orgID, saved.OrgID)
}

func TestSaveAdminConfiguration_RejectsProvenanceChange(t *testing.T) {
	svc, _, _ := newAdminConfigSvc(t)
	var orgID int64 = 10

	// First write with ProvenanceFile.
	require.NoError(t, svc.SaveAdminConfiguration(context.Background(), orgID, AdminConfig{
		AlertmanagersChoice:   AlertmanagerTypeExternal,
		ExternalAlertmanagers: []string{"http://am:9009"},
	}, models.ProvenanceFile))

	// Second write with ProvenanceAPI — should be rejected.
	err := svc.SaveAdminConfiguration(context.Background(), orgID, AdminConfig{
		AlertmanagersChoice:   AlertmanagerTypeExternal,
		ExternalAlertmanagers: []string{"http://am:9009"},
	}, models.ProvenanceAPI)

	require.Error(t, err)
	require.ErrorContains(t, err, "cannot change admin config provenance")
}

func TestSaveAdminConfiguration_AllowsSameProvenance(t *testing.T) {
	svc, _, _ := newAdminConfigSvc(t)
	var orgID int64 = 11

	cfg := AdminConfig{
		AlertmanagersChoice:   AlertmanagerTypeExternal,
		ExternalAlertmanagers: []string{"http://am:9009"},
	}

	require.NoError(t, svc.SaveAdminConfiguration(context.Background(), orgID, cfg, models.ProvenanceFile))
	// Same provenance update: should succeed.
	require.NoError(t, svc.SaveAdminConfiguration(context.Background(), orgID, cfg, models.ProvenanceFile))
}

func TestSaveAdminConfiguration_PropagatesStoreError(t *testing.T) {
	svc, store, _ := newAdminConfigSvc(t)
	store.saveErr = errors.New("write failure")

	err := svc.SaveAdminConfiguration(context.Background(), 1, AdminConfig{
		AlertmanagersChoice:   AlertmanagerTypeExternal,
		ExternalAlertmanagers: []string{"http://am:9009"},
	}, models.ProvenanceAPI)

	require.ErrorContains(t, err, "write failure")
}

// --- DeleteAdminConfiguration tests ---

func TestDeleteAdminConfiguration_Succeeds(t *testing.T) {
	svc, store, _ := newAdminConfigSvc(t)
	var orgID int64 = 20

	require.NoError(t, svc.SaveAdminConfiguration(context.Background(), orgID, AdminConfig{
		AlertmanagersChoice:   AlertmanagerTypeExternal,
		ExternalAlertmanagers: []string{"http://am:9009"},
	}, models.ProvenanceFile))

	require.NoError(t, svc.DeleteAdminConfiguration(context.Background(), orgID, models.ProvenanceFile))

	saved, err := store.GetAdminConfiguration(context.Background(), orgID)
	require.NoError(t, err)
	assert.Nil(t, saved)
}

func TestDeleteAdminConfiguration_AllowsDeleteWhenNoneStored(t *testing.T) {
	svc, _, _ := newAdminConfigSvc(t)

	// No config stored — delete should be a no-op without error.
	require.NoError(t, svc.DeleteAdminConfiguration(context.Background(), 99, models.ProvenanceFile))
}

func TestDeleteAdminConfiguration_RejectsWrongProvenance(t *testing.T) {
	svc, _, _ := newAdminConfigSvc(t)
	var orgID int64 = 21

	require.NoError(t, svc.SaveAdminConfiguration(context.Background(), orgID, AdminConfig{
		AlertmanagersChoice:   AlertmanagerTypeExternal,
		ExternalAlertmanagers: []string{"http://am:9009"},
	}, models.ProvenanceFile))

	err := svc.DeleteAdminConfiguration(context.Background(), orgID, models.ProvenanceAPI)

	require.Error(t, err)
	require.ErrorContains(t, err, "cannot delete admin config")
}

func TestDeleteAdminConfiguration_PropagatesStoreError(t *testing.T) {
	svc, store, _ := newAdminConfigSvc(t)
	var orgID int64 = 22

	require.NoError(t, svc.SaveAdminConfiguration(context.Background(), orgID, AdminConfig{
		AlertmanagersChoice:   AlertmanagerTypeExternal,
		ExternalAlertmanagers: []string{"http://am:9009"},
	}, models.ProvenanceAPI))

	store.delErr = errors.New("delete failure")

	err := svc.DeleteAdminConfiguration(context.Background(), orgID, models.ProvenanceAPI)

	require.ErrorContains(t, err, "delete failure")
}

// --- validateAdminConfig unit tests ---

func TestValidateAdminConfig(t *testing.T) {
	tests := []struct {
		name    string
		cfg     AdminConfig
		wantErr bool
		errMsg  string
	}{
		{
			name:    "internal only — valid",
			cfg:     AdminConfig{AlertmanagersChoice: AlertmanagerTypeInternal},
			wantErr: false,
		},
		{
			name: "external with URLs — valid",
			cfg: AdminConfig{
				AlertmanagersChoice:   AlertmanagerTypeExternal,
				ExternalAlertmanagers: []string{"http://am:9009"},
			},
			wantErr: false,
		},
		{
			name:    "external without URLs — invalid",
			cfg:     AdminConfig{AlertmanagersChoice: AlertmanagerTypeExternal},
			wantErr: true,
			errMsg:  "at least one external Alertmanager URL",
		},
		{
			name: "both with URLs — valid",
			cfg: AdminConfig{
				AlertmanagersChoice:   AlertmanagerTypeBoth,
				ExternalAlertmanagers: []string{"http://am:9009"},
			},
			wantErr: false,
		},
		{
			name:    "both without URLs — valid (internal is sufficient)",
			cfg:     AdminConfig{AlertmanagersChoice: AlertmanagerTypeBoth},
			wantErr: false,
		},
		{
			name:    "unknown choice — invalid",
			cfg:     AdminConfig{AlertmanagersChoice: "nowhere"},
			wantErr: true,
			errMsg:  "invalid alertmanagersChoice",
		},
		{
			name:    "empty choice — invalid",
			cfg:     AdminConfig{AlertmanagersChoice: ""},
			wantErr: true,
			errMsg:  "invalid alertmanagersChoice",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateAdminConfig(tc.cfg)
			if tc.wantErr {
				require.Error(t, err)
				require.ErrorContains(t, err, tc.errMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

// --- Provisionable interface tests ---

func TestAdminConfig_ImplementsProvisionable(t *testing.T) {
	cfg := &AdminConfig{OrgID: 1}
	assert.Equal(t, "alertmanager-admin-config", cfg.ResourceType())
	assert.Equal(t, "admin-config", cfg.ResourceID())
}

// --- Round-trip integration: save and retrieve ---

func TestAdminConfig_FileProvisioningRoundTrip(t *testing.T) {
	// Simulates what a file provisioner would do:
	// 1. Load YAML into AdminConfig.
	// 2. Call SaveAdminConfiguration with ProvenanceFile.
	// 3. Grafana reads it back for routing.
	svc, _, _ := newAdminConfigSvc(t)
	var orgID int64 = 100

	fileConfig := AdminConfig{
		AlertmanagersChoice:   AlertmanagerTypeExternal,
		ExternalAlertmanagers: []string{"http://mimir.example.com:9009/alertmanager"},
	}

	require.NoError(t, svc.SaveAdminConfiguration(context.Background(), orgID, fileConfig, models.ProvenanceFile))

	result, provenance, err := svc.GetAdminConfiguration(context.Background(), orgID)

	require.NoError(t, err)
	assert.Equal(t, AlertmanagerTypeExternal, result.AlertmanagersChoice)
	assert.Equal(t, fileConfig.ExternalAlertmanagers, result.ExternalAlertmanagers)
	assert.Equal(t, models.ProvenanceFile, provenance)
	assert.EqualValues(t, orgID, result.OrgID)
}

