// +build integration

package ngalert

import (
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/stretchr/testify/require"
)

func TestAlertInstanceOperations(t *testing.T) {
	ng := setupTestEnv(t)

	t.Run("can save and read new alert instance", func(t *testing.T) {
		saveCmd := &saveAlertInstanceCommand{
			OrgID:             1,
			AlertDefinitionID: 1,
			State:             InstanceStateFiring,
			Labels:            InstanceLabels{"test": "testValue"},
		}
		err := ng.saveAlertInstance(saveCmd)
		require.NoError(t, err)

		getCmd := &getAlertInstanceCommand{
			OrgID:             1,
			AlertDefinitionID: 1,
			Labels:            InstanceLabels{"test": "testValue"},
		}

		err = ng.getAlertInstance(getCmd)
		require.NoError(t, err)

		spew.Dump(getCmd.Result)

		require.Equal(t, saveCmd.Labels, getCmd.Result.Labels)

	})

	t.Run("can save and read new alert instance with no labels", func(t *testing.T) {
		saveCmd := &saveAlertInstanceCommand{
			OrgID:             1,
			AlertDefinitionID: 2,
			State:             InstanceStateNormal,
		}
		err := ng.saveAlertInstance(saveCmd)
		require.NoError(t, err)

		getCmd := &getAlertInstanceCommand{
			OrgID:             1,
			AlertDefinitionID: 2,
		}

		err = ng.getAlertInstance(getCmd)
		require.NoError(t, err)

		spew.Dump(getCmd.Result)

		require.Equal(t, saveCmd.AlertDefinitionID, getCmd.Result.AlertDefinitionID)
		require.Equal(t, saveCmd.Labels, getCmd.Result.Labels)

	})

	t.Run("can save two instances with same id and different labels", func(t *testing.T) {
		saveCmdOne := &saveAlertInstanceCommand{
			OrgID:             1,
			AlertDefinitionID: 3,
			State:             InstanceStateFiring,
			Labels:            InstanceLabels{"test": "testValue"},
		}

		err := ng.saveAlertInstance(saveCmdOne)
		require.NoError(t, err)

		saveCmdTwo := &saveAlertInstanceCommand{
			OrgID:             1,
			AlertDefinitionID: 3,
			State:             InstanceStateFiring,
			Labels:            InstanceLabels{"test": "meow"},
		}
		err = ng.saveAlertInstance(saveCmdTwo)
		require.NoError(t, err)
	})

	t.Run("can list all added instances in org", func(t *testing.T) {
		listCommand := &listAlertInstancesCommand{
			OrgID: 1,
		}

		err := ng.listAlertInstances(listCommand)
		require.NoError(t, err)

		require.Len(t, listCommand.Result, 4)
	})

	t.Run("can list all added instances in org filtered by current state", func(t *testing.T) {
		listCommand := &listAlertInstancesCommand{
			OrgID: 1,
			State: InstanceStateNormal,
		}

		err := ng.listAlertInstances(listCommand)
		require.NoError(t, err)

		require.Len(t, listCommand.Result, 1)
	})

}
