// +build integration

package tests

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestChannelRuleCreate(t *testing.T) {
	storage := SetupTestChannelRuleStorage(t)

	getCmd := models.GetLiveChannelRuleCommand{
		OrgId: 1,
		Uid:   "200",
	}
	_, err := storage.GetChannelRule(context.Background(), getCmd)
	require.Equal(t, models.ErrLiveChannelRuleNotFound, err)

	createCmd := models.CreateLiveChannelRuleCommand{
		Uid:     "200",
		OrgId:   1,
		Pattern: "xxx/*",
		Settings: models.LiveChannelRuleSettings{
			RemoteWrite: &models.RemoteWriteConfig{
				Endpoint: "test_endpoint",
			},
		},
		SecureSettings: map[string]string{
			"remoteWritePassword": "test_password",
		},
	}
	result, err := storage.CreateChannelRule(context.Background(), createCmd)
	require.NoError(t, err)
	require.Equal(t, "xxx/*", result.Pattern)
	require.Equal(t, "200", result.Uid)
	require.Equal(t, "test_endpoint", result.Settings.RemoteWrite.Endpoint)
	encPassword, ok := result.SecureSettings["remoteWritePassword"]
	require.True(t, ok)
	require.NotEqual(t, "test_password", string(encPassword))
	password, ok := result.SecureSettings.DecryptedValue("remoteWritePassword")
	require.True(t, ok)
	require.Equal(t, "test_password", password)
}

func TestChannelRuleUpdate(t *testing.T) {
	storage := SetupTestChannelRuleStorage(t)

	createCmd := models.CreateLiveChannelRuleCommand{
		OrgId:   1,
		Pattern: "xxx/*",
		Settings: models.LiveChannelRuleSettings{
			RemoteWrite: &models.RemoteWriteConfig{
				Endpoint: "test_endpoint",
			},
		},
		SecureSettings: map[string]string{
			"remoteWritePassword": "test_password",
		},
	}
	result, err := storage.CreateChannelRule(context.Background(), createCmd)
	require.NoError(t, err)

	uid := result.Uid
	require.NotZero(t, uid)

	updateCmd := models.UpdateLiveChannelRuleCommand{
		Uid:     uid,
		OrgId:   1,
		Pattern: "xxx_updated/*",
		Settings: models.LiveChannelRuleSettings{
			RemoteWrite: &models.RemoteWriteConfig{
				Endpoint: "test_endpoint_updated",
			},
		},
		SecureSettings: map[string]string{
			"remoteWritePassword": "test_password_updated",
		},
	}
	_, err = storage.UpdateChannelRule(context.Background(), updateCmd)
	require.Equal(t, models.ErrLiveChannelRuleUpdatingOldVersion, err)

	updateCmd.Version = result.Version + 1
	result, err = storage.UpdateChannelRule(context.Background(), updateCmd)
	require.NoError(t, err)
	require.Equal(t, "xxx_updated/*", result.Pattern)
	require.NotZero(t, result.Uid)
	require.Equal(t, "test_endpoint_updated", result.Settings.RemoteWrite.Endpoint)
	password, ok := result.SecureSettings.DecryptedValue("remoteWritePassword")
	require.True(t, ok)
	require.Equal(t, "test_password_updated", password)
}

func TestChannelRuleDelete(t *testing.T) {
	storage := SetupTestChannelRuleStorage(t)

	createCmd := models.CreateLiveChannelRuleCommand{
		OrgId:   1,
		Pattern: "xxx/*",
		Settings: models.LiveChannelRuleSettings{
			RemoteWrite: &models.RemoteWriteConfig{
				Endpoint: "test_endpoint",
			},
		},
		SecureSettings: map[string]string{
			"remoteWritePassword": "test_password",
		},
	}
	result, err := storage.CreateChannelRule(context.Background(), createCmd)
	require.NoError(t, err)

	uid := result.Uid

	deleteCmd := models.DeleteLiveChannelRuleCommand{
		Uid:   uid,
		OrgId: 1,
	}
	numDeleted, err := storage.DeleteChannelRule(context.Background(), deleteCmd)
	require.NoError(t, err)
	require.Equal(t, int64(1), numDeleted)

	getCmd := models.GetLiveChannelRuleCommand{
		OrgId: 1,
		Uid:   uid,
	}
	_, err = storage.GetChannelRule(context.Background(), getCmd)
	require.Equal(t, models.ErrLiveChannelRuleNotFound, err)
}

func TestChannelRuleList(t *testing.T) {
	storage := SetupTestChannelRuleStorage(t)

	createCmd := models.CreateLiveChannelRuleCommand{
		OrgId:   2,
		Pattern: "xxx2/*",
		Settings: models.LiveChannelRuleSettings{
			RemoteWrite: &models.RemoteWriteConfig{
				Endpoint: "test_endpoint",
			},
		},
		SecureSettings: map[string]string{
			"remoteWritePassword": "test_password",
		},
	}
	_, err := storage.CreateChannelRule(context.Background(), createCmd)
	require.NoError(t, err)

	createCmd = models.CreateLiveChannelRuleCommand{
		OrgId:   3,
		Pattern: "xxx3/*",
		Settings: models.LiveChannelRuleSettings{
			RemoteWrite: &models.RemoteWriteConfig{
				Endpoint: "test_endpoint",
			},
		},
		SecureSettings: map[string]string{
			"remoteWritePassword": "test_password",
		},
	}
	_, err = storage.CreateChannelRule(context.Background(), createCmd)
	require.NoError(t, err)

	listCmd := models.ListLiveChannelRuleCommand{
		OrgId: 3,
	}
	rules, err := storage.ListChannelRules(context.Background(), listCmd)
	require.Len(t, rules, 1)
	require.Equal(t, "xxx3/*", rules[0].Pattern)
}
