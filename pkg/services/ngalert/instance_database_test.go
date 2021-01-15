// +build integration

package ngalert

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAlertInstanceOperations(t *testing.T) {
	ng := setupTestEnv(t)

	t.Run("can save and read new alert instance", func(t *testing.T) {
		saveCmd := &saveAlertInstanceCommand{
			DefinitionOrgID: 1,
			DefinitionUID:   "uid 1",
			State:           InstanceStateFiring,
			Labels:          InstanceLabels{"test": "testValue"},
		}
		err := ng.saveAlertInstance(saveCmd)
		require.NoError(t, err)

		getCmd := &getAlertInstanceQuery{
			DefinitionOrgID: 1,
			DefinitionUID:   "uid 1",
			Labels:          InstanceLabels{"test": "testValue"},
		}

		err = ng.getAlertInstance(getCmd)
		require.NoError(t, err)

		require.Equal(t, saveCmd.Labels, getCmd.Result.Labels)
	})

	t.Run("can save and read new alert instance with no labels", func(t *testing.T) {
		saveCmd := &saveAlertInstanceCommand{
			DefinitionOrgID: 1,
			DefinitionUID:   "uid 2",
			State:           InstanceStateNormal,
		}
		err := ng.saveAlertInstance(saveCmd)
		require.NoError(t, err)

		getCmd := &getAlertInstanceQuery{
			DefinitionOrgID: 1,
			DefinitionUID:   "uid 2",
		}

		err = ng.getAlertInstance(getCmd)
		require.NoError(t, err)

		require.Equal(t, saveCmd.DefinitionOrgID, getCmd.Result.DefinitionOrgID)
		require.Equal(t, saveCmd.DefinitionUID, getCmd.Result.DefinitionUID)
		require.Equal(t, saveCmd.Labels, getCmd.Result.Labels)
	})

	t.Run("can save two instances with same org_id, uid and different labels", func(t *testing.T) {
		saveCmdOne := &saveAlertInstanceCommand{
			DefinitionOrgID: 1,
			DefinitionUID:   "uid 3",
			State:           InstanceStateFiring,
			Labels:          InstanceLabels{"test": "testValue"},
		}

		err := ng.saveAlertInstance(saveCmdOne)
		require.NoError(t, err)

		saveCmdTwo := &saveAlertInstanceCommand{
			DefinitionOrgID: 1,
			DefinitionUID:   "uid 3",
			State:           InstanceStateFiring,
			Labels:          InstanceLabels{"test": "meow"},
		}
		err = ng.saveAlertInstance(saveCmdTwo)
		require.NoError(t, err)

		listCommand := &listAlertInstancesQuery{
			DefinitionOrgID: 1,
			DefinitionUID:   "uid 3",
		}

		err = ng.listAlertInstances(listCommand)
		require.NoError(t, err)

		require.Len(t, listCommand.Result, 2)
	})

	t.Run("can list all added instances in org", func(t *testing.T) {
		listCommand := &listAlertInstancesQuery{
			DefinitionOrgID: 1,
		}

		err := ng.listAlertInstances(listCommand)
		require.NoError(t, err)

		require.Len(t, listCommand.Result, 4)
	})

	t.Run("can list all added instances in org filtered by current state", func(t *testing.T) {
		listCommand := &listAlertInstancesQuery{
			DefinitionOrgID: 1,
			State:           InstanceStateNormal,
		}

		err := ng.listAlertInstances(listCommand)
		require.NoError(t, err)

		require.Len(t, listCommand.Result, 1)
	})

	t.Run("update instance with same org_id, uid and different labels", func(t *testing.T) {
		saveCmdOne := &saveAlertInstanceCommand{
			DefinitionOrgID: 1,
			DefinitionUID:   "uid 4",
			State:           InstanceStateFiring,
			Labels:          InstanceLabels{"test": "testValue"},
		}

		err := ng.saveAlertInstance(saveCmdOne)
		require.NoError(t, err)

		saveCmdTwo := &saveAlertInstanceCommand{
			DefinitionOrgID: 1,
			DefinitionUID:   "uid 4",
			State:           InstanceStateNormal,
			Labels:          InstanceLabels{"test": "testValue"},
		}
		err = ng.saveAlertInstance(saveCmdTwo)
		require.NoError(t, err)

		listCommand := &listAlertInstancesQuery{
			DefinitionOrgID: 1,
			DefinitionUID:   "uid 4",
		}

		err = ng.listAlertInstances(listCommand)
		require.NoError(t, err)

		require.Len(t, listCommand.Result, 1)

		require.Equal(t, saveCmdTwo.DefinitionOrgID, listCommand.Result[0].DefinitionOrgID)
		require.Equal(t, saveCmdTwo.DefinitionUID, listCommand.Result[0].DefinitionUID)
		require.Equal(t, saveCmdTwo.Labels, listCommand.Result[0].Labels)
		require.Equal(t, saveCmdTwo.State, listCommand.Result[0].CurrentState)
	})

}
