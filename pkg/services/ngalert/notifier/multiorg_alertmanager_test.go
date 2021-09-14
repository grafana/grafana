package notifier

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

func TestMultiOrgAlertmanager_SyncAlertmanagersForOrgs(t *testing.T) {
	t.Skipf("Skipping multiorg alertmanager tests for now")
	configStore := &FakeConfigStore{
		configs: map[int64]*models.AlertConfiguration{},
	}
	orgStore := &FakeOrgStore{
		orgs: []int64{1, 2, 3},
	}
	SyncOrgsPollInterval = 10 * time.Minute // Don't poll in unit tests.
	kvStore := newFakeKVStore(t)
	mam := NewMultiOrgAlertmanager(&setting.Cfg{}, configStore, orgStore, kvStore)
	ctx := context.Background()

	// Ensure that one Alertmanager is created per org.
	{
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 3)
	}
	// When an org is removed, it should detect it.
	{
		orgStore.orgs = []int64{1, 3}
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 2)
	}
	// if the org comes back, it should detect it.
	{
		orgStore.orgs = []int64{1, 2, 3, 4}
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 4)
	}
}

func TestMultiOrgAlertmanager_AlertmanagerFor(t *testing.T) {
	t.Skipf("Skipping multiorg alertmanager tests for now")
	configStore := &FakeConfigStore{
		configs: map[int64]*models.AlertConfiguration{},
	}
	orgStore := &FakeOrgStore{
		orgs: []int64{1, 2, 3},
	}

	SyncOrgsPollInterval = 10 * time.Minute // Don't poll in unit tests.
	kvStore := newFakeKVStore(t)
	mam := NewMultiOrgAlertmanager(&setting.Cfg{}, configStore, orgStore, kvStore)
	ctx := context.Background()

	// Ensure that one Alertmanagers is created per org.
	{
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 3)
	}

	// First, let's try to request an Alertmanager from an org that doesn't exist.
	{
		_, err := mam.AlertmanagerFor(5)
		require.EqualError(t, err, ErrNoAlertmanagerForOrg.Error())
	}

	// Now, let's try to request an Alertmanager that is not ready.
	{
		// let's delete its "running config" to make it non-ready
		mam.alertmanagers[1].config = nil
		_, err := mam.AlertmanagerFor(1)
		require.EqualError(t, err, ErrAlertmanagerNotReady.Error())
	}

	// With an Alertmanager that exists, it responds correctly.
	{
		am, err := mam.AlertmanagerFor(2)
		require.NoError(t, err)
		require.Equal(t, *am.GetStatus().VersionInfo.Version, "N/A")
		require.Equal(t, am.orgID, int64(2))
		require.NotNil(t, am.config)
	}

	// Let's now remove the previous queried organization.
	orgStore.orgs = []int64{1, 3}
	require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
	{
		_, err := mam.AlertmanagerFor(2)
		require.EqualError(t, err, ErrNoAlertmanagerForOrg.Error())
	}
}
