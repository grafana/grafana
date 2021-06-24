// +build integration

package tests

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestChannelRuleCreate(t *testing.T) {
	storage := SetupTestChannelRuleStorage(t)

	getCmd := models.GetLiveChannelRuleCommand{
		OrgId: 1,
		Id:    200,
	}
	_, err := storage.GetChannelRule(getCmd)
	require.Equal(t, models.ErrLiveChannelRuleNotFound, err)

	createCmd := models.CreateLiveChannelRuleCommand{
		OrgId:   1,
		Pattern: "xxx/*",
		Config: models.LiveChannelRulePlainConfig{
			RemoteWriteEndpoint: "test_endpoint",
		},
		Secure: map[string]string{
			"remoteWritePassword": "test_password",
		},
	}
	result, err := storage.CreateChannelRule(createCmd)
	require.NoError(t, err)
	require.Equal(t, "xxx/*", result.Pattern)
	require.NotZero(t, result.Id)
	require.Equal(t, "test_endpoint", result.Config.RemoteWriteEndpoint)
	encPassword, ok := result.Secure["remoteWritePassword"]
	require.True(t, ok)
	require.NotEqual(t, "test_password", string(encPassword))
	password, ok := result.Secure.DecryptedValue("remoteWritePassword")
	require.True(t, ok)
	require.Equal(t, "test_password", password)
}

func TestChannelRuleUpdate(t *testing.T) {
	storage := SetupTestChannelRuleStorage(t)

	createCmd := models.CreateLiveChannelRuleCommand{
		OrgId:   1,
		Pattern: "xxx/*",
		Config: models.LiveChannelRulePlainConfig{
			RemoteWriteEndpoint: "test_endpoint",
		},
		Secure: map[string]string{
			"remoteWritePassword": "test_password",
		},
	}
	result, err := storage.CreateChannelRule(createCmd)
	require.NoError(t, err)

	id := result.Id

	updateCmd := models.UpdateLiveChannelRuleCommand{
		Id:      id,
		OrgId:   1,
		Pattern: "xxx_updated/*",
		Config: models.LiveChannelRulePlainConfig{
			RemoteWriteEndpoint: "test_endpoint_updated",
		},
		Secure: map[string]string{
			"remoteWritePassword": "test_password_updated",
		},
	}
	_, err = storage.UpdateChannelRule(updateCmd)
	require.Equal(t, models.ErrLiveChannelRuleUpdatingOldVersion, err)

	updateCmd.Version = result.Version + 1
	result, err = storage.UpdateChannelRule(updateCmd)
	require.NoError(t, err)
	require.Equal(t, "xxx_updated/*", result.Pattern)
	require.NotZero(t, result.Id)
	require.Equal(t, "test_endpoint_updated", result.Config.RemoteWriteEndpoint)
	password, ok := result.Secure.DecryptedValue("remoteWritePassword")
	require.True(t, ok)
	require.Equal(t, "test_password_updated", password)
}

func TestChannelRuleDelete(t *testing.T) {
	storage := SetupTestChannelRuleStorage(t)

	createCmd := models.CreateLiveChannelRuleCommand{
		OrgId:   1,
		Pattern: "xxx/*",
		Config: models.LiveChannelRulePlainConfig{
			RemoteWriteEndpoint: "test_endpoint",
		},
		Secure: map[string]string{
			"remoteWritePassword": "test_password",
		},
	}
	result, err := storage.CreateChannelRule(createCmd)
	require.NoError(t, err)

	id := result.Id

	deleteCmd := models.DeleteLiveChannelRuleCommand{
		Id:    id,
		OrgId: 1,
	}
	err = storage.DeleteChannelRule(deleteCmd)
	require.NoError(t, err)

	getCmd := models.GetLiveChannelRuleCommand{
		OrgId: 1,
		Id:    id,
	}
	_, err = storage.GetChannelRule(getCmd)
	require.Equal(t, models.ErrLiveChannelRuleNotFound, err)
}

func TestChannelRuleList(t *testing.T) {
	storage := SetupTestChannelRuleStorage(t)

	createCmd := models.CreateLiveChannelRuleCommand{
		OrgId:   2,
		Pattern: "xxx2/*",
		Config: models.LiveChannelRulePlainConfig{
			RemoteWriteEndpoint: "test_endpoint",
		},
		Secure: map[string]string{
			"remoteWritePassword": "test_password",
		},
	}
	_, err := storage.CreateChannelRule(createCmd)
	require.NoError(t, err)

	createCmd = models.CreateLiveChannelRuleCommand{
		OrgId:   3,
		Pattern: "xxx3/*",
		Config: models.LiveChannelRulePlainConfig{
			RemoteWriteEndpoint: "test_endpoint",
		},
		Secure: map[string]string{
			"remoteWritePassword": "test_password",
		},
	}
	_, err = storage.CreateChannelRule(createCmd)
	require.NoError(t, err)

	listCmd := models.ListLiveChannelRuleCommand{
		OrgId: 3,
	}
	rules, err := storage.ListChannelRules(listCmd)
	require.Len(t, rules, 1)
	require.Equal(t, "xxx3/*", rules[0].Pattern)
}
