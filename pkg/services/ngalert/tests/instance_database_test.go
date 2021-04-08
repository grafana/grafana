// +build integration

package tests

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/stretchr/testify/require"
)

func TestAlertInstanceOperations(t *testing.T) {
	dbstore := setupTestEnv(t, baseIntervalSeconds)

	alertDefinition1 := createTestAlertDefinition(t, dbstore, 60)
	orgID := alertDefinition1.OrgID

	alertDefinition2 := createTestAlertDefinition(t, dbstore, 60)
	require.Equal(t, orgID, alertDefinition2.OrgID)

	alertDefinition3 := createTestAlertDefinition(t, dbstore, 60)
	require.Equal(t, orgID, alertDefinition3.OrgID)

	alertDefinition4 := createTestAlertDefinition(t, dbstore, 60)
	require.Equal(t, orgID, alertDefinition4.OrgID)

	t.Run("can save and read new alert instance", func(t *testing.T) {
		saveCmd := &models.SaveAlertInstanceCommand{
			DefinitionOrgID: alertDefinition1.OrgID,
			DefinitionUID:   alertDefinition1.UID,
			State:           models.InstanceStateFiring,
			Labels:          models.InstanceLabels{"test": "testValue"},
		}
		err := dbstore.SaveAlertInstance(saveCmd)
		require.NoError(t, err)

		getCmd := &models.GetAlertInstanceQuery{
			DefinitionOrgID: saveCmd.DefinitionOrgID,
			DefinitionUID:   saveCmd.DefinitionUID,
			Labels:          models.InstanceLabels{"test": "testValue"},
		}

		err = dbstore.GetAlertInstance(getCmd)
		require.NoError(t, err)

		require.Equal(t, saveCmd.Labels, getCmd.Result.Labels)
		require.Equal(t, alertDefinition1.OrgID, getCmd.Result.DefinitionOrgID)
		require.Equal(t, alertDefinition1.UID, getCmd.Result.DefinitionUID)
	})

	t.Run("can save and read new alert instance with no labels", func(t *testing.T) {
		saveCmd := &models.SaveAlertInstanceCommand{
			DefinitionOrgID: alertDefinition2.OrgID,
			DefinitionUID:   alertDefinition2.UID,
			State:           models.InstanceStateNormal,
			Labels:          models.InstanceLabels{},
		}
		err := dbstore.SaveAlertInstance(saveCmd)
		require.NoError(t, err)

		getCmd := &models.GetAlertInstanceQuery{
			DefinitionOrgID: saveCmd.DefinitionOrgID,
			DefinitionUID:   saveCmd.DefinitionUID,
		}

		err = dbstore.GetAlertInstance(getCmd)
		require.NoError(t, err)

		require.Equal(t, alertDefinition2.OrgID, getCmd.Result.DefinitionOrgID)
		require.Equal(t, alertDefinition2.UID, getCmd.Result.DefinitionUID)
		require.Equal(t, saveCmd.Labels, getCmd.Result.Labels)
	})

	t.Run("can save two instances with same org_id, uid and different labels", func(t *testing.T) {
		saveCmdOne := &models.SaveAlertInstanceCommand{
			DefinitionOrgID: alertDefinition3.OrgID,
			DefinitionUID:   alertDefinition3.UID,
			State:           models.InstanceStateFiring,
			Labels:          models.InstanceLabels{"test": "testValue"},
		}

		err := dbstore.SaveAlertInstance(saveCmdOne)
		require.NoError(t, err)

		saveCmdTwo := &models.SaveAlertInstanceCommand{
			DefinitionOrgID: saveCmdOne.DefinitionOrgID,
			DefinitionUID:   saveCmdOne.DefinitionUID,
			State:           models.InstanceStateFiring,
			Labels:          models.InstanceLabels{"test": "meow"},
		}
		err = dbstore.SaveAlertInstance(saveCmdTwo)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			DefinitionOrgID: saveCmdOne.DefinitionOrgID,
			DefinitionUID:   saveCmdOne.DefinitionUID,
		}

		err = dbstore.ListAlertInstances(listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 2)
	})

	t.Run("can list all added instances in org", func(t *testing.T) {
		listQuery := &models.ListAlertInstancesQuery{
			DefinitionOrgID: orgID,
		}

		err := dbstore.ListAlertInstances(listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 4)
	})

	t.Run("can list all added instances in org filtered by current state", func(t *testing.T) {
		listQuery := &models.ListAlertInstancesQuery{
			DefinitionOrgID: orgID,
			State:           models.InstanceStateNormal,
		}

		err := dbstore.ListAlertInstances(listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 1)
	})

	t.Run("update instance with same org_id, uid and different labels", func(t *testing.T) {
		saveCmdOne := &models.SaveAlertInstanceCommand{
			DefinitionOrgID: alertDefinition4.OrgID,
			DefinitionUID:   alertDefinition4.UID,
			State:           models.InstanceStateFiring,
			Labels:          models.InstanceLabels{"test": "testValue"},
		}

		err := dbstore.SaveAlertInstance(saveCmdOne)
		require.NoError(t, err)

		saveCmdTwo := &models.SaveAlertInstanceCommand{
			DefinitionOrgID: saveCmdOne.DefinitionOrgID,
			DefinitionUID:   saveCmdOne.DefinitionUID,
			State:           models.InstanceStateNormal,
			Labels:          models.InstanceLabels{"test": "testValue"},
		}
		err = dbstore.SaveAlertInstance(saveCmdTwo)
		require.NoError(t, err)

		listQuery := &models.ListAlertInstancesQuery{
			DefinitionOrgID: alertDefinition4.OrgID,
			DefinitionUID:   alertDefinition4.UID,
		}

		err = dbstore.ListAlertInstances(listQuery)
		require.NoError(t, err)

		require.Len(t, listQuery.Result, 1)

		require.Equal(t, saveCmdTwo.DefinitionOrgID, listQuery.Result[0].DefinitionOrgID)
		require.Equal(t, saveCmdTwo.DefinitionUID, listQuery.Result[0].DefinitionUID)
		require.Equal(t, saveCmdTwo.Labels, listQuery.Result[0].Labels)
		require.Equal(t, saveCmdTwo.State, listQuery.Result[0].CurrentState)
		require.NotEmpty(t, listQuery.Result[0].DefinitionTitle)
		require.Equal(t, alertDefinition4.Title, listQuery.Result[0].DefinitionTitle)
	})
}
