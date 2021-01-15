// +build integration

package ngalert

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAlertInstanceOperations(t *testing.T) {
	ng := setupTestEnv(t)

	alertDefinition1 := createTestAlertDefinition(t, ng, 60)
	orgID := alertDefinition1.OrgID

	alertDefinition2 := createTestAlertDefinition(t, ng, 60)
	require.Equal(t, orgID, alertDefinition2.OrgID)

	alertDefinition3 := createTestAlertDefinition(t, ng, 60)
	require.Equal(t, orgID, alertDefinition3.OrgID)

	alertDefinition4 := createTestAlertDefinition(t, ng, 60)
	require.Equal(t, orgID, alertDefinition4.OrgID)

	t.Run("can save and read new alert instance", func(t *testing.T) {
		saveCmd := &saveAlertInstanceCommand{
			DefinitionOrgID: alertDefinition1.OrgID,
			DefinitionUID:   alertDefinition1.UID,
			State:           InstanceStateFiring,
			Labels:          InstanceLabels{"test": "testValue"},
		}
		err := ng.saveAlertInstance(saveCmd)
		require.NoError(t, err)

		getCmd := &getAlertInstanceQuery{
			DefinitionOrgID: saveCmd.DefinitionOrgID,
			DefinitionUID:   saveCmd.DefinitionUID,
			Labels:          InstanceLabels{"test": "testValue"},
		}

		err = ng.getAlertInstance(getCmd)
		require.NoError(t, err)

		require.Equal(t, saveCmd.Labels, getCmd.Result.Labels)
		require.Equal(t, alertDefinition1.OrgID, getCmd.Result.DefinitionOrgID)
		require.Equal(t, alertDefinition1.UID, getCmd.Result.DefinitionUID)
	})

	t.Run("can save and read new alert instance with no labels", func(t *testing.T) {
		saveCmd := &saveAlertInstanceCommand{
			DefinitionOrgID: alertDefinition2.OrgID,
			DefinitionUID:   alertDefinition2.UID,
			State:           InstanceStateNormal,
		}
		err := ng.saveAlertInstance(saveCmd)
		require.NoError(t, err)

		getCmd := &getAlertInstanceQuery{
			DefinitionOrgID: saveCmd.DefinitionOrgID,
			DefinitionUID:   saveCmd.DefinitionUID,
		}

		err = ng.getAlertInstance(getCmd)
		require.NoError(t, err)

		require.Equal(t, alertDefinition2.OrgID, getCmd.Result.DefinitionOrgID)
		require.Equal(t, alertDefinition2.UID, getCmd.Result.DefinitionUID)
		require.Equal(t, saveCmd.Labels, getCmd.Result.Labels)
	})

	t.Run("can save two instances with same org_id, uid and different labels", func(t *testing.T) {
		saveCmdOne := &saveAlertInstanceCommand{
			DefinitionOrgID: alertDefinition3.OrgID,
			DefinitionUID:   alertDefinition3.UID,
			State:           InstanceStateFiring,
			Labels:          InstanceLabels{"test": "testValue"},
		}

		err := ng.saveAlertInstance(saveCmdOne)
		require.NoError(t, err)

		saveCmdTwo := &saveAlertInstanceCommand{
			DefinitionOrgID: saveCmdOne.DefinitionOrgID,
			DefinitionUID:   saveCmdOne.DefinitionUID,
			State:           InstanceStateFiring,
			Labels:          InstanceLabels{"test": "meow"},
		}
		err = ng.saveAlertInstance(saveCmdTwo)
		require.NoError(t, err)

		listCommand := &listAlertInstancesQuery{
			DefinitionOrgID: saveCmdOne.DefinitionOrgID,
			DefinitionUID:   saveCmdOne.DefinitionUID,
		}

		err = ng.listAlertInstances(listCommand)
		require.NoError(t, err)

		require.Len(t, listCommand.Result, 2)
	})

	t.Run("can list all added instances in org", func(t *testing.T) {
		listCommand := &listAlertInstancesQuery{
			DefinitionOrgID: orgID,
		}

		err := ng.listAlertInstances(listCommand)
		require.NoError(t, err)

		require.Len(t, listCommand.Result, 4)
	})

	t.Run("can list all added instances in org filtered by current state", func(t *testing.T) {
		listCommand := &listAlertInstancesQuery{
			DefinitionOrgID: orgID,
			State:           InstanceStateNormal,
		}

		err := ng.listAlertInstances(listCommand)
		require.NoError(t, err)

		require.Len(t, listCommand.Result, 1)
	})

	t.Run("update instance with same org_id, uid and different labels", func(t *testing.T) {
		saveCmdOne := &saveAlertInstanceCommand{
			DefinitionOrgID: alertDefinition4.OrgID,
			DefinitionUID:   alertDefinition4.UID,
			State:           InstanceStateFiring,
			Labels:          InstanceLabels{"test": "testValue"},
		}

		err := ng.saveAlertInstance(saveCmdOne)
		require.NoError(t, err)

		saveCmdTwo := &saveAlertInstanceCommand{
			DefinitionOrgID: saveCmdOne.DefinitionOrgID,
			DefinitionUID:   saveCmdOne.DefinitionUID,
			State:           InstanceStateNormal,
			Labels:          InstanceLabels{"test": "testValue"},
		}
		err = ng.saveAlertInstance(saveCmdTwo)
		require.NoError(t, err)

		listCommand := &listAlertInstancesQuery{
			DefinitionOrgID: alertDefinition4.OrgID,
			DefinitionUID:   alertDefinition4.UID,
		}

		err = ng.listAlertInstances(listCommand)
		require.NoError(t, err)

		require.Len(t, listCommand.Result, 1)

		require.Equal(t, saveCmdTwo.DefinitionOrgID, listCommand.Result[0].DefinitionOrgID)
		require.Equal(t, saveCmdTwo.DefinitionUID, listCommand.Result[0].DefinitionUID)
		require.Equal(t, saveCmdTwo.Labels, listCommand.Result[0].Labels)
		require.Equal(t, saveCmdTwo.State, listCommand.Result[0].CurrentState)
		require.NotEmpty(t, listCommand.Result[0].DefinitionTitle)
		require.Equal(t, alertDefinition4.Title, listCommand.Result[0].DefinitionTitle)
	})
}
