package legacy_storage

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

var defaultConfig = setting.GetAlertmanagerDefaultConfiguration()

func TestAlertmanagerConfigStoreGet(t *testing.T) {
	orgID := int64(1)

	t.Run("should read the latest config for giving organization", func(t *testing.T) {
		cryptoMock := newFakeCrypto()
		storeMock := &MockAMConfigStore{}
		store := NewAlertmanagerConfigStore(storeMock, cryptoMock)

		expected := models.AlertConfiguration{
			ID:                        1,
			AlertmanagerConfiguration: defaultConfig,
			ConfigurationHash:         "config-hash-123",
			ConfigurationVersion:      "123",
			CreatedAt:                 time.Now().Unix(),
			Default:                   false,
			OrgID:                     orgID,
		}

		expectedCfg := definitions.PostableUserConfig{}
		require.NoError(t, json.Unmarshal([]byte(defaultConfig), &expectedCfg))

		storeMock.EXPECT().GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(&expected, nil)

		revision, err := store.Get(context.Background(), orgID)
		require.NoError(t, err)

		require.Equal(t, expected.ConfigurationVersion, revision.Version)
		require.Equal(t, expected.ConfigurationHash, revision.ConcurrencyToken)
		require.Equal(t, expectedCfg, *revision.Config)

		storeMock.AssertCalled(t, "GetLatestAlertmanagerConfiguration", mock.Anything, orgID)

		t.Run("should decrypt extra configs ", func(t *testing.T) {
			require.Len(t, cryptoMock.Calls, 1)
			require.Equal(t, "DecryptExtraConfigs", cryptoMock.Calls[0].Method)
			require.Equal(t, &expectedCfg, cryptoMock.Calls[0].Args[1])
		})
	})

	t.Run("propagate errors", func(t *testing.T) {
		t.Run("when underlying store fails", func(t *testing.T) {
			storeMock := &MockAMConfigStore{}
			store := NewAlertmanagerConfigStore(storeMock, newFakeCrypto())
			expectedErr := errors.New("test=err")
			storeMock.EXPECT().GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(nil, expectedErr)

			_, err := store.Get(context.Background(), orgID)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("return ErrNoAlertmanagerConfiguration config does not exist", func(t *testing.T) {
			storeMock := &MockAMConfigStore{}
			store := NewAlertmanagerConfigStore(storeMock, newFakeCrypto())
			storeMock.EXPECT().GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(nil, nil)

			_, err := store.Get(context.Background(), orgID)
			require.Truef(t, ErrNoAlertmanagerConfiguration.Is(err), "expected ErrNoAlertmanagerConfiguration but got %s", err.Error())
		})

		t.Run("when config cannot be unmarshalled", func(t *testing.T) {
			storeMock := &MockAMConfigStore{}
			store := NewAlertmanagerConfigStore(storeMock, newFakeCrypto())
			storeMock.EXPECT().GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(&models.AlertConfiguration{
				AlertmanagerConfiguration: "invalid-json",
			}, nil)

			_, err := store.Get(context.Background(), orgID)
			require.Truef(t, ErrBadAlertmanagerConfiguration.Base.Is(err), "expected ErrBadAlertmanagerConfiguration but got %s", err.Error())
		})

		t.Run("when decrypting extra configs fails", func(t *testing.T) {
			cryptoMock := newFakeCrypto()
			storeMock := &MockAMConfigStore{}
			store := NewAlertmanagerConfigStore(storeMock, cryptoMock)

			expectedErr := errors.New("test-err")
			cryptoMock.DecryptExtraConfigsFunc = func(ctx context.Context, config *definitions.PostableUserConfig) error {
				return expectedErr
			}
			storeMock.EXPECT().GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(&models.AlertConfiguration{
				AlertmanagerConfiguration: defaultConfig,
			}, nil)

			_, err := store.Get(context.Background(), orgID)
			require.ErrorIs(t, err, expectedErr)
		})
	})
}

func TestAlertmanagerConfigStoreSave(t *testing.T) {
	orgID := int64(1)

	cfg := definitions.PostableUserConfig{}
	require.NoError(t, json.Unmarshal([]byte(defaultConfig), &cfg))
	expectedCfg, err := SerializeAlertmanagerConfig(cfg)
	require.NoError(t, err)

	revision := ConfigRevision{
		Config:           &cfg,
		ConcurrencyToken: "config-hash-123",
		Version:          "123",
	}

	t.Run("should save the config to store", func(t *testing.T) {
		cryptoMock := newFakeCrypto()
		storeMock := &MockAMConfigStore{}
		store := NewAlertmanagerConfigStore(storeMock, cryptoMock)

		storeMock.EXPECT().UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).RunAndReturn(func(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
			assert.Equal(t, string(expectedCfg), cmd.AlertmanagerConfiguration)
			assert.Equal(t, orgID, cmd.OrgID)
			assert.Equal(t, revision.Version, cmd.ConfigurationVersion)
			assert.Equal(t, false, cmd.Default)
			assert.Equal(t, revision.ConcurrencyToken, cmd.FetchedConfigurationHash)
			return nil
		})

		err := store.Save(context.Background(), &revision, orgID)
		require.NoError(t, err)

		storeMock.AssertCalled(t, "UpdateAlertmanagerConfiguration", mock.Anything, mock.Anything)

		t.Run("should encrypt extra configs ", func(t *testing.T) {
			require.Len(t, cryptoMock.Calls, 1)
			require.Equal(t, "EncryptExtraConfigs", cryptoMock.Calls[0].Method)
			require.Equal(t, &cfg, cryptoMock.Calls[0].Args[1])
		})
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when underlying storage returns error", func(t *testing.T) {
			storeMock := &MockAMConfigStore{}
			store := NewAlertmanagerConfigStore(storeMock, newFakeCrypto())

			expectedErr := errors.New("test-err")
			storeMock.EXPECT().UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(expectedErr)

			err := store.Save(context.Background(), &revision, orgID)

			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when encrypting extra configs fails", func(t *testing.T) {
			cryptoMock := newFakeCrypto()
			storeMock := &MockAMConfigStore{}
			store := NewAlertmanagerConfigStore(storeMock, cryptoMock)

			expectedErr := errors.New("test-err")
			cryptoMock.EncryptExtraConfigsFunc = func(ctx context.Context, config *definitions.PostableUserConfig) error {
				return expectedErr
			}

			err := store.Save(context.Background(), &revision, orgID)
			require.ErrorIs(t, err, expectedErr)
		})
	})
}
