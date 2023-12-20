package provisioning

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
)

func TestAlertmanagerConfigStoreGet(t *testing.T) {
	orgID := int64(1)

	t.Run("should read the latest config for giving organization", func(t *testing.T) {
		storeMock := &MockAMConfigStore{}
		store := &alertmanagerConfigStoreImpl{
			store: storeMock,
			xact:  newNopTransactionManager(),
		}

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

		require.Equal(t, expected.ConfigurationVersion, revision.version)
		require.Equal(t, expected.ConfigurationHash, revision.concurrencyToken)
		require.Equal(t, expectedCfg, *revision.cfg)

		storeMock.AssertCalled(t, "GetLatestAlertmanagerConfiguration", mock.Anything, orgID)
	})

	t.Run("propagate errors", func(t *testing.T) {
		t.Run("when underlying store fails", func(t *testing.T) {
			storeMock := &MockAMConfigStore{}
			store := &alertmanagerConfigStoreImpl{
				store: storeMock,
				xact:  newNopTransactionManager(),
			}
			expectedErr := errors.New("test=err")
			storeMock.EXPECT().GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(nil, expectedErr)

			_, err := store.Get(context.Background(), orgID)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("return ErrNoAlertmanagerConfiguration config does not exist", func(t *testing.T) {
			storeMock := &MockAMConfigStore{}
			store := &alertmanagerConfigStoreImpl{
				store: storeMock,
				xact:  newNopTransactionManager(),
			}
			storeMock.EXPECT().GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(nil, nil)

			_, err := store.Get(context.Background(), orgID)
			require.Truef(t, ErrNoAlertmanagerConfiguration.Is(err), "expected ErrNoAlertmanagerConfiguration but got %s", err.Error())
		})

		t.Run("when config cannot be unmarshalled", func(t *testing.T) {
			storeMock := &MockAMConfigStore{}
			store := &alertmanagerConfigStoreImpl{
				store: storeMock,
				xact:  newNopTransactionManager(),
			}
			storeMock.EXPECT().GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(&models.AlertConfiguration{
				AlertmanagerConfiguration: "invalid-json",
			}, nil)

			_, err := store.Get(context.Background(), orgID)
			require.Truef(t, ErrBadAlertmanagerConfiguration.Base.Is(err), "expected ErrBadAlertmanagerConfiguration but got %s", err.Error())
		})
	})
}

func TestAlertmanagerConfigStoreSave(t *testing.T) {
	orgID := int64(1)

	cfg := definitions.PostableUserConfig{}
	require.NoError(t, json.Unmarshal([]byte(defaultConfig), &cfg))
	expectedCfg, err := serializeAlertmanagerConfig(cfg)
	require.NoError(t, err)

	revision := cfgRevision{
		cfg:              &cfg,
		concurrencyToken: "config-hash-123",
		version:          "123",
	}

	t.Run("should save the config to store", func(t *testing.T) {
		storeMock := &MockAMConfigStore{}
		store := &alertmanagerConfigStoreImpl{
			store: storeMock,
			xact:  newNopTransactionManager(),
		}

		storeMock.EXPECT().UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).RunAndReturn(func(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
			assertInTransaction(t, ctx)
			assert.Equal(t, string(expectedCfg), cmd.AlertmanagerConfiguration)
			assert.Equal(t, orgID, cmd.OrgID)
			assert.Equal(t, revision.version, cmd.ConfigurationVersion)
			assert.Equal(t, false, cmd.Default)
			assert.Equal(t, revision.concurrencyToken, cmd.FetchedConfigurationHash)
			return nil
		})

		afterExecuted := false
		err := store.Save(context.Background(), &revision, orgID, func(ctx context.Context) error {
			assertInTransaction(t, ctx)
			afterExecuted = true
			return nil
		})
		require.NoError(t, err)
		assert.Truef(t, afterExecuted, "callback was supposed to be executed but it was not")

		storeMock.AssertCalled(t, "UpdateAlertmanagerConfiguration", mock.Anything, mock.Anything)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when underlying storage returns error", func(t *testing.T) {
			storeMock := &MockAMConfigStore{}
			store := &alertmanagerConfigStoreImpl{
				store: storeMock,
				xact:  newNopTransactionManager(),
			}

			expectedErr := errors.New("test-err")
			storeMock.EXPECT().UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(expectedErr)

			err := store.Save(context.Background(), &revision, orgID, func(ctx context.Context) error {
				assert.Fail(t, "callback should not be executed")
				return nil
			})

			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when callback returns error", func(t *testing.T) {
			storeMock := &MockAMConfigStore{}
			store := &alertmanagerConfigStoreImpl{
				store: storeMock,
				xact:  newNopTransactionManager(),
			}

			storeMock.EXPECT().UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(nil)

			expectedErr := errors.New("test-err")
			err := store.Save(context.Background(), &revision, orgID, func(ctx context.Context) error {
				return expectedErr
			})

			require.ErrorIs(t, err, expectedErr)

			storeMock.AssertCalled(t, "UpdateAlertmanagerConfiguration", mock.Anything, mock.Anything) // assert that the callback executed after this method
		})
	})
}
