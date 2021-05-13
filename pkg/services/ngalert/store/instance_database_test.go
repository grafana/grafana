// +build integration

package store_test

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"

	"github.com/stretchr/testify/require"
)

const baseIntervalSeconds = 10

func mockTimeNow() {
	var timeSeed int64
	store.TimeNow = func() time.Time {
		fakeNow := time.Unix(timeSeed, 0).UTC()
		timeSeed++
		return fakeNow
	}
}

func TestAlertInstanceOperations(t *testing.T) {
	dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)
	t.Cleanup(registry.ClearOverrides)

	alertRule1 := tests.CreateTestAlertRule(t, dbstore, 60)
	orgID := alertRule1.OrgID

	alertRule2 := tests.CreateTestAlertRule(t, dbstore, 60)
	require.Equal(t, orgID, alertRule2.OrgID)

	alertRule3 := tests.CreateTestAlertRule(t, dbstore, 60)
	require.Equal(t, orgID, alertRule3.OrgID)

	alertRule4 := tests.CreateTestAlertRule(t, dbstore, 60)
	require.Equal(t, orgID, alertRule4.OrgID)

	t.Run("can save and read new alert instance", func(t *testing.T) {
		saveCmd := &models.SaveAlertInstanceCommand{
			RuleOrgID: alertRule1.OrgID,
			RuleUID:   alertRule1.UID,
			State:     models.InstanceStateFiring,
			Labels:    models.InstanceLabels{"test": "testValue"},
		}
		err := dbstore.SaveAlertInstance(saveCmd)
		require.NoError(t, err)

		getCmd := &models.GetAlertInstanceQuery{
			RuleOrgID: saveCmd.RuleOrgID,
			RuleUID:   saveCmd.RuleUID,
			Labels:    models.InstanceLabels{"test": "testValue"},
		}

		err = dbstore.GetAlertInstance(getCmd)
		require.NoError(t, err)

		require.Equal(t, saveCmd.Labels, getCmd.Result.Labels)
		require.Equal(t, alertRule1.OrgID, getCmd.Result.RuleOrgID)
		require.Equal(t, alertRule1.UID, getCmd.Result.RuleUID)
	})

	t.Run("can save and read new alert instance with no labels", func(t *testing.T) {
		saveCmd := &models.SaveAlertInstanceCommand{
			RuleOrgID: alertRule2.OrgID,
			RuleUID:   alertRule2.UID,
			State:     models.InstanceStateNormal,
			Labels:    models.InstanceLabels{},
		}
		err := dbstore.SaveAlertInstance(saveCmd)
		require.NoError(t, err)

		getCmd := &models.GetAlertInstanceQuery{
			RuleOrgID: saveCmd.RuleOrgID,
			RuleUID:   saveCmd.RuleUID,
		}

		err = dbstore.GetAlertInstance(getCmd)
		require.NoError(t, err)

		require.Equal(t, alertRule2.OrgID, getCmd.Result.RuleOrgID)
		require.Equal(t, alertRule2.UID, getCmd.Result.RuleUID)
		require.Equal(t, saveCmd.Labels, getCmd.Result.Labels)
	})

	t.Run("can save two instances with same org_id, uid and different labels", func(t *testing.T) {
		saveCmdOne := &models.SaveAlertInstanceCommand{
			RuleOrgID: alertRule3.OrgID,
			RuleUID:   alertRule3.UID,
			State:     models.InstanceStateFiring,
			Labels:    models.InstanceLabels{"test": "testValue"},
		}

		err := dbstore.SaveAlertInstance(saveCmdOne)
		require.NoError(t, err)

		saveCmdTwo := &models.SaveAlertInstanceCommand{
			RuleOrgID: saveCmdOne.RuleOrgID,
			RuleUID:   saveCmdOne.RuleUID,
			State:     models.InstanceStateFiring,
			Labels:    models.InstanceLabels{"test": "meow"},
		}
		err = dbstore.SaveAlertInstance(saveCmdTwo)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: saveCmdOne.RuleOrgID,
			RuleUID:   saveCmdOne.RuleUID,
		}

		err = dbstore.ListAlertInstances(listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 2)
	})

	t.Run("can list all added instances in org", func(t *testing.T) {
		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
		}

		err := dbstore.ListAlertInstances(listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 4)
	})

	t.Run("can list all added instances in org filtered by current state", func(t *testing.T) {
		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: orgID,
			State:     models.InstanceStateNormal,
		}

		err := dbstore.ListAlertInstances(listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 1)
	})

	t.Run("update instance with same org_id, uid and different labels", func(t *testing.T) {
		saveCmdOne := &models.SaveAlertInstanceCommand{
			RuleOrgID: alertRule4.OrgID,
			RuleUID:   alertRule4.UID,
			State:     models.InstanceStateFiring,
			Labels:    models.InstanceLabels{"test": "testValue"},
		}

		err := dbstore.SaveAlertInstance(saveCmdOne)
		require.NoError(t, err)

		saveCmdTwo := &models.SaveAlertInstanceCommand{
			RuleOrgID: saveCmdOne.RuleOrgID,
			RuleUID:   saveCmdOne.RuleUID,
			State:     models.InstanceStateNormal,
			Labels:    models.InstanceLabels{"test": "testValue"},
		}
		err = dbstore.SaveAlertInstance(saveCmdTwo)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			RuleOrgID: alertRule4.OrgID,
			RuleUID:   alertRule4.UID,
		}

		err = dbstore.ListAlertInstances(listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 1)

		require.Equal(t, saveCmdTwo.RuleOrgID, listQuery.Result[0].RuleOrgID)
		require.Equal(t, saveCmdTwo.RuleUID, listQuery.Result[0].RuleUID)
		require.Equal(t, saveCmdTwo.Labels, listQuery.Result[0].Labels)
		require.Equal(t, saveCmdTwo.State, listQuery.Result[0].CurrentState)
	})
}
