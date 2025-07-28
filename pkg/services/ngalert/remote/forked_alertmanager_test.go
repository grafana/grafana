package remote

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/alertmanager_mock"
	remote_alertmanager_mock "github.com/grafana/grafana/pkg/services/ngalert/remote/mock"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

const (
	modeRemoteSecondary = iota
	modeRemotePrimary
)

func TestForkedAlertmanager_ModeRemoteSecondary(t *testing.T) {
	ctx := context.Background()
	expErr := errors.New("test error")

	t.Run("ApplyConfig", func(tt *testing.T) {
		{
			// If the remote Alertmanager is not ready, ApplyConfig should be called on both Alertmanagers.
			internal, remote, forked := genTestAlertmanagers(tt, modeRemoteSecondary, withSyncInterval(10*time.Minute))
			internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once()
			readyCall := remote.EXPECT().Ready().Return(false).Once()
			remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once().NotBefore(readyCall)
			require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))

			// Calling ApplyConfig again with a ready remote Alertmanager before the sync interval is elapsed
			// should result in the forked Alertmanager calling ApplyConfig on the internal Alertmanager.
			internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once()
			remote.EXPECT().Ready().Return(true).Once()
			require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))
		}

		{
			// If the remote Alertmanager is ready and the sync interval has elapsed,
			// the forked Alertmanager should sync the configuration on the remote Alertmanager
			// and call ApplyConfig only on the internal Alertmanager.
			internal, remote, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
			internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Twice()
			remote.EXPECT().Ready().Return(true).Twice()
			remote.EXPECT().CompareAndSendConfiguration(ctx, mock.Anything).Return(nil).Twice()
			require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))
			require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))
		}

		{
			// An error in the remote Alertmanager should not be returned,
			// but it should result in the forked Alertmanager trying to sync
			// the configuration in the next call to ApplyConfig, regardless of the sync interval.
			internal, remote, forked := genTestAlertmanagers(tt, modeRemoteSecondary, withSyncInterval(10*time.Minute))
			internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Twice()
			remote.EXPECT().Ready().Return(false).Twice()
			remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(expErr).Twice()
			require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))
			require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))

			// Let's try the same thing but starting from a ready Alertmanager.
			internal, remote, forked = genTestAlertmanagers(tt, modeRemoteSecondary, withSyncInterval(10*time.Minute))
			internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Twice()
			remote.EXPECT().Ready().Return(true).Twice()
			remote.EXPECT().CompareAndSendConfiguration(ctx, mock.Anything).Return(expErr).Twice()
			require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))
			require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))
		}

		{
			// An error in the internal Alertmanager should be returned.
			internal, remote, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
			internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(expErr).Once()
			readyCall := remote.EXPECT().Ready().Return(false).Once()
			remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once().NotBefore(readyCall)
			require.ErrorIs(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}), expErr)
		}
	})

	t.Run("ApplyConfig - with remote state", func(tt *testing.T) {
		{
			// During the first ApplyConfig call, we should:
			// 1. Apply the configuration to the remote Alertmanager
			// 2. Merge the remote state
			// 3. Apply the configuration to the internal Alertmanager
			internal, remote, forked := genTestAlertmanagers(tt, modeRemoteSecondary, withRemoteState)
			readyCall := remote.EXPECT().Ready().Return(false).Once()
			remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once().NotBefore(readyCall)
			remote.EXPECT().Ready().Return(true).Once()
			remoteStateCall := remote.EXPECT().GetRemoteState(mock.Anything).Return(notifier.ExternalState{}, nil).Once()
			internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once().NotBefore(remoteStateCall)
			require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))
			require.True(tt, internal.mergeStateCalled)

			// We shouldn't attempt to merge the remote state again on the next sync loop iteration.
			internal.mergeStateCalled = false
			remote.EXPECT().Ready().Return(true).Once()
			internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once()
			remote.EXPECT().CompareAndSendConfiguration(ctx, mock.Anything).Return(nil).Once()
			require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))
			require.False(tt, internal.mergeStateCalled)
		}

		{
			// If we fail to apply the configuration in the remote Alertmanager, we should get an error and not start the internal Alertmanager.
			internal, remote, forked := genTestAlertmanagers(tt, modeRemoteSecondary, withSyncInterval(10*time.Minute), withRemoteState)
			readyCall := remote.EXPECT().Ready().Return(false).Once()
			remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(expErr).Once().NotBefore(readyCall)
			remote.EXPECT().Ready().Return(false).Once()
			err := forked.ApplyConfig(ctx, &models.AlertConfiguration{})
			require.Equal(tt, "remote Alertmanager not ready, can't fetch remote state", err.Error())
			require.False(tt, internal.mergeStateCalled)

			// Calling ApplyConfig again should result in the forked Alertmanager calling ApplyConfig on both
			// Alertmanagers and merging the remote state, even if the sync interval has not elapsed.
			remote.EXPECT().Ready().Return(true).Twice()
			remote.EXPECT().CompareAndSendConfiguration(ctx, mock.Anything).Return(nil).Once()
			remoteStateCall := remote.EXPECT().GetRemoteState(mock.Anything).Return(notifier.ExternalState{}, nil).Once()
			internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once().NotBefore(remoteStateCall)
			require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))
			require.True(tt, internal.mergeStateCalled)
		}

		{
			// An error in the remote Alertmanager should be returned.
			// The internal Alertmanager shouldn't be started.
			internal, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
			remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(expErr).Once()
			require.ErrorIs(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}), expErr)
			require.False(t, internal.mergeStateCalled)
		}

		{
			// An error in the internal Alertmanager should be returned.
			internal, remote, forked := genTestAlertmanagers(tt, modeRemoteSecondary, withRemoteState)
			internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(expErr).Once()

			// Simulate starting the remote Alertmanager and merging the remote state.
			readyCall := remote.EXPECT().Ready().Return(false).Once()
			remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once().NotBefore(readyCall)
			remote.EXPECT().Ready().Return(true).Once()
			remote.EXPECT().GetRemoteState(mock.Anything).Return(notifier.ExternalState{}, nil).Once()

			require.ErrorIs(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}), expErr)
			require.True(t, internal.mergeStateCalled)
		}
	})

	t.Run("SaveAndApplyConfig", func(tt *testing.T) {
		// SaveAndApplyConfig should only be called on the remote Alertmanager.
		// State and configuration are updated on an interval.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().SaveAndApplyConfig(ctx, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.SaveAndApplyConfig(ctx, &apimodels.PostableUserConfig{}))

		// If there's an error, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().SaveAndApplyConfig(ctx, mock.Anything).Return(expErr).Once()
		require.ErrorIs(tt, forked.SaveAndApplyConfig(ctx, &apimodels.PostableUserConfig{}), expErr)
	})

	t.Run("SaveAndApplyDefaultConfig", func(tt *testing.T) {
		// SaveAndApplyDefaultConfig should only be called on the internal Alertmanager.
		// State and configuration are updated on an interval.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().SaveAndApplyDefaultConfig(ctx).Return(nil).Once()
		require.NoError(tt, forked.SaveAndApplyDefaultConfig(ctx))

		// If there's an error, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().SaveAndApplyDefaultConfig(ctx).Return(expErr).Once()
		require.ErrorIs(tt, forked.SaveAndApplyDefaultConfig(ctx), expErr)
	})

	t.Run("GetStatus", func(tt *testing.T) {
		// We care about the status of the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
		status := apimodels.GettableStatus{}
		internal.EXPECT().GetStatus(ctx).Return(status, nil).Once()
		got, err := forked.GetStatus(ctx)
		require.NoError(tt, err)
		require.Equal(tt, status, got)
	})

	t.Run("CreateSilence", func(tt *testing.T) {
		// We should create the silence in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)

		expID := "test-id"
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return(expID, nil).Once()
		id, err := forked.CreateSilence(ctx, nil)
		require.NoError(tt, err)
		require.Equal(tt, expID, id)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", expErr).Once()
		_, err = forked.CreateSilence(ctx, nil)
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("DeleteSilence", func(tt *testing.T) {
		// We should delete the silence in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.DeleteSilence(ctx, ""))

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(expErr).Once()
		require.ErrorIs(tt, expErr, forked.DeleteSilence(ctx, ""))
	})

	t.Run("GetSilence", func(tt *testing.T) {
		// We should get the silence from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)

		expSilence := apimodels.GettableSilence{}
		internal.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(expSilence, nil).Once()
		silence, err := forked.GetSilence(ctx, "")
		require.NoError(tt, err)
		require.Equal(tt, expSilence, silence)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(apimodels.GettableSilence{}, expErr).Once()
		_, err = forked.GetSilence(ctx, "")
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("ListSilences", func(tt *testing.T) {
		// We should get the silences from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)

		expSilences := apimodels.GettableSilences{}
		internal.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(expSilences, nil).Once()
		silences, err := forked.ListSilences(ctx, []string{})
		require.NoError(tt, err)
		require.Equal(tt, expSilences, silences)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(apimodels.GettableSilences{}, expErr).Once()
		_, err = forked.ListSilences(ctx, []string{})
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("GetAlerts", func(tt *testing.T) {
		// We should get alerts from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)

		expAlerts := apimodels.GettableAlerts{}
		internal.EXPECT().GetAlerts(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(expAlerts, nil).Once()

		alerts, err := forked.GetAlerts(ctx, true, true, true, []string{"test"}, "test")
		require.NoError(tt, err)
		require.Equal(tt, expAlerts, alerts)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)

		internal.EXPECT().GetAlerts(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(apimodels.GettableAlerts{}, expErr).Once()

		_, err = forked.GetAlerts(ctx, true, true, true, []string{"test"}, "test")
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("GetAlertGroups", func(tt *testing.T) {
		// We should get alert groups from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)

		expAlertGroups := apimodels.AlertGroups{}
		internal.EXPECT().GetAlertGroups(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(expAlertGroups, nil).Once()

		alertGroups, err := forked.GetAlertGroups(ctx, true, true, true, []string{"test"}, "test")
		require.NoError(tt, err)
		require.Equal(tt, expAlertGroups, alertGroups)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)

		internal.EXPECT().GetAlertGroups(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(apimodels.AlertGroups{}, expErr).Once()

		_, err = forked.GetAlertGroups(ctx, true, true, true, []string{"test"}, "test")
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("PutAlerts", func(tt *testing.T) {
		// We should send alerts to the internal Alertmanager only.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(expErr).Once()
		require.ErrorIs(tt, expErr, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))
	})

	t.Run("GetReceivers", func(tt *testing.T) {
		// We should retrieve the receivers from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
		expReceivers := []apimodels.Receiver{}
		internal.EXPECT().GetReceivers(mock.Anything).Return(expReceivers, nil).Once()
		receivers, err := forked.GetReceivers(ctx)
		require.NoError(tt, err)
		require.Equal(tt, expReceivers, receivers)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().GetReceivers(mock.Anything).Return([]apimodels.Receiver{}, expErr).Once()
		_, err = forked.GetReceivers(ctx)
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("TestReceivers", func(tt *testing.T) {
		// TestReceivers should be called only in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, 0, nil).Once()
		_, _, err := forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, 0, expErr).Once()
		_, _, err = forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("TestTemplate", func(tt *testing.T) {
		// TestTemplate should be called only in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, expErr).Once()
		_, err = forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("StopAndWait", func(tt *testing.T) {
		{
			// StopAndWait should be called in both Alertmanagers.
			// Methods to sync the Alertmanagers should be called on the remote Alertmanager.
			internal, remote, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
			internal.EXPECT().StopAndWait().Once()
			remote.EXPECT().StopAndWait().Once()
			remote.EXPECT().CompareAndSendConfiguration(mock.Anything, mock.Anything).Return(nil).Once()
			remote.EXPECT().SendState(mock.Anything).Return(nil).Once()
			forked.StopAndWait()
		}

		{
			// An error in the remote Alertmanager should't be a problem.
			// These errors are caught and logged.
			internal, remote, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
			internal.EXPECT().StopAndWait().Once()
			remote.EXPECT().StopAndWait().Once()
			remote.EXPECT().CompareAndSendConfiguration(mock.Anything, mock.Anything).Return(expErr).Once()
			remote.EXPECT().SendState(mock.Anything).Return(expErr).Once()
			forked.StopAndWait()
		}

		{
			// An error when retrieving the configuration should cause
			// CompareAndSendConfiguration not to be called.
			internal, remote, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
			secondaryForked, ok := forked.(*RemoteSecondaryForkedAlertmanager)
			require.True(t, ok)
			secondaryForked.store = &errConfigStore{}

			internal.EXPECT().StopAndWait().Once()
			remote.EXPECT().StopAndWait().Once()
			remote.EXPECT().SendState(mock.Anything).Return(expErr).Once()
			forked.StopAndWait()
		}
	})

	t.Run("Ready", func(tt *testing.T) {
		// Ready should be called only on the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().Ready().Return(true).Once()
		require.True(tt, forked.Ready())

		internal.EXPECT().Ready().Return(false).Maybe()
		require.False(tt, forked.Ready())
	})
}

func TestForkedAlertmanager_ModeRemotePrimary(t *testing.T) {
	ctx := context.Background()
	expErr := errors.New("test error")

	t.Run("ApplyConfig", func(tt *testing.T) {
		// If the remote Alertmanager is not ready, ApplyConfig should be called on both Alertmanagers,
		// first on the remote, then on the internal.
		internal, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		remoteCall := remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once()
		internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once().NotBefore(remoteCall)
		require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))

		// An error in the remote Alertmanager should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(expErr).Once()
		require.ErrorIs(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}), expErr)

		// An error in the internal Alertmanager should not be returned.
		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(nil).Once()
		internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(expErr).Once()
		require.NoError(tt, forked.ApplyConfig(ctx, &models.AlertConfiguration{}))
	})

	t.Run("SaveAndApplyDefaultConfig", func(tt *testing.T) {
		// SaveAndApplyDefaultConfig should be called on both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().SaveAndApplyDefaultConfig(ctx).Return(nil).Once()
		internal.EXPECT().SaveAndApplyDefaultConfig(ctx).Return(nil).Once()
		require.NoError(tt, forked.SaveAndApplyDefaultConfig(ctx))

		// An error in the remote Alertmanager should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().SaveAndApplyDefaultConfig(ctx).Return(expErr).Once()
		require.ErrorIs(tt, forked.SaveAndApplyDefaultConfig(ctx), expErr)

		// An error in the internal Alertmanager should not be returned.
		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().SaveAndApplyDefaultConfig(ctx).Return(nil).Once()
		internal.EXPECT().SaveAndApplyDefaultConfig(ctx).Return(expErr).Once()
		require.NoError(tt, forked.SaveAndApplyDefaultConfig(ctx))
	})

	t.Run("SaveAndApplyConfig", func(tt *testing.T) {
		// SaveAndApplyConfig should first be called on the remote Alertmanager
		// and then on the internal one.
		internal, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		remoteCall := remote.EXPECT().SaveAndApplyConfig(ctx, mock.Anything).Return(nil).Once()
		internal.EXPECT().SaveAndApplyConfig(ctx, mock.Anything).Return(nil).Once().NotBefore(remoteCall)
		require.NoError(tt, forked.SaveAndApplyConfig(ctx, &apimodels.PostableUserConfig{}))

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().SaveAndApplyConfig(ctx, mock.Anything).Return(expErr).Once()
		require.ErrorIs(tt, expErr, forked.SaveAndApplyConfig(ctx, &apimodels.PostableUserConfig{}))

		// An error in the internal Alertmanager should not be returned.
		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().SaveAndApplyConfig(ctx, mock.Anything).Return(nil).Once()
		internal.EXPECT().SaveAndApplyConfig(ctx, mock.Anything).Return(expErr).Once()
		require.NoError(tt, forked.SaveAndApplyConfig(ctx, &apimodels.PostableUserConfig{}))
	})

	t.Run("GetStatus", func(tt *testing.T) {
		{
			// We care about the status of the remote Alertmanager.
			_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
			status := apimodels.GettableStatus{}
			remote.EXPECT().GetStatus(ctx).Return(status, nil).Once()
			got, err := forked.GetStatus(ctx)
			require.NoError(tt, err)
			require.Equal(tt, status, got)
		}

		{
			// If there's an error in the remote Alertmanager, it should be returned.
			_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
			remote.EXPECT().GetStatus(ctx).Return(apimodels.GettableStatus{}, expErr).Once()
			_, err := forked.GetStatus(ctx)
			require.ErrorIs(tt, expErr, err)
		}
	})

	t.Run("CreateSilence", func(tt *testing.T) {
		// We should create the silence in both Alertmanagers using the same uid.
		testSilence := &apimodels.PostableSilence{}
		expID := "test-id"

		internal, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().CreateSilence(mock.Anything, testSilence).Return(expID, nil).Once()
		internal.EXPECT().CreateSilence(mock.Anything, testSilence).Return(testSilence.ID, nil).Once()
		id, err := forked.CreateSilence(ctx, testSilence)
		require.NoError(tt, err)
		require.Equal(tt, expID, testSilence.ID)
		require.Equal(tt, expID, id)

		// If there's an error in the remote Alertmanager, the error should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", expErr).Once()
		_, err = forked.CreateSilence(ctx, testSilence)
		require.ErrorIs(tt, expErr, err)

		// An error in the internal Alertmanager should not be returned.
		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return(expID, nil).Once()
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", expErr).Once()
		id, err = forked.CreateSilence(ctx, testSilence)
		require.NoError(tt, err)
		require.Equal(tt, expID, id)

		// If the silence ID changes, the internal Alertmanager should attempt to expire the old silence.
		newID := "new"
		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return(newID, nil).Once()
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Once()
		// If internal.CreateSilence() returns a new id, it should be ignored.
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("random-id", nil).Once()
		id, err = forked.CreateSilence(ctx, testSilence)
		require.NoError(tt, err)
		require.Equal(tt, newID, testSilence.ID)
		require.Equal(tt, newID, id)

		// Restore original ID.
		testSilence.ID = expID

		// An error attempting to delete a silence in the internal Alertmanager not be returned.
		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return(newID, nil).Once()
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(fmt.Errorf("test error")).Once()
		// If internal.CreateSilence() returns a new id, it should be ignored.
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("random-id", nil).Once()
		id, err = forked.CreateSilence(ctx, testSilence)
		require.NoError(tt, err)
		require.Equal(tt, newID, testSilence.ID)
		require.Equal(tt, newID, id)
	})

	t.Run("DeleteSilence", func(tt *testing.T) {
		// We should delete the silence in both Alertmanagers.
		testID := "test-id"
		internal, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().DeleteSilence(mock.Anything, testID).Return(nil).Once()
		internal.EXPECT().DeleteSilence(mock.Anything, testID).Return(nil).Once()
		require.NoError(tt, forked.DeleteSilence(ctx, testID))

		// If there's an error in the remote Alertmanager, the error should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().DeleteSilence(mock.Anything, testID).Return(expErr).Maybe()
		require.ErrorIs(tt, expErr, forked.DeleteSilence(ctx, testID))

		// An error in the internal Alertmanager should not be returned.
		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().DeleteSilence(mock.Anything, testID).Return(nil).Maybe()
		internal.EXPECT().DeleteSilence(mock.Anything, testID).Return(nil).Maybe()
		require.NoError(tt, forked.DeleteSilence(ctx, testID))
	})

	t.Run("GetSilence", func(tt *testing.T) {
		// We should get the silence from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		expSilence := apimodels.GettableSilence{}
		remote.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(expSilence, nil).Once()
		silence, err := forked.GetSilence(ctx, "")
		require.NoError(tt, err)
		require.Equal(tt, expSilence, silence)

		// If there's an error in the remote Alertmanager, the error should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(apimodels.GettableSilence{}, expErr).Once()
		_, err = forked.GetSilence(ctx, "")
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("ListSilences", func(tt *testing.T) {
		// We should get the silences from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		expSilences := apimodels.GettableSilences{}
		remote.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(expSilences, nil).Once()
		silences, err := forked.ListSilences(ctx, []string{})
		require.NoError(tt, err)
		require.Equal(tt, expSilences, silences)

		// If there's an error in the remote Alertmanager, the error should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(apimodels.GettableSilences{}, expErr).Once()
		_, err = forked.ListSilences(ctx, []string{})
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("GetAlerts", func(tt *testing.T) {
		// We should get alerts from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)

		expAlerts := apimodels.GettableAlerts{}
		remote.EXPECT().GetAlerts(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(expAlerts, nil).Once()

		alerts, err := forked.GetAlerts(ctx, true, true, true, []string{"test"}, "test")
		require.NoError(tt, err)
		require.Equal(tt, expAlerts, alerts)

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)

		remote.EXPECT().GetAlerts(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(apimodels.GettableAlerts{}, expErr).Once()

		_, err = forked.GetAlerts(ctx, true, true, true, []string{"test"}, "test")
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("GetAlertGroups", func(tt *testing.T) {
		// We should get alert groups from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)

		expAlertGroups := apimodels.AlertGroups{}
		remote.EXPECT().GetAlertGroups(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(expAlertGroups, nil).Once()

		alertGroups, err := forked.GetAlertGroups(ctx, true, true, true, []string{"test"}, "test")
		require.NoError(tt, err)
		require.Equal(tt, expAlertGroups, alertGroups)

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)

		remote.EXPECT().GetAlertGroups(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(apimodels.AlertGroups{}, expErr).Once()

		_, err = forked.GetAlertGroups(ctx, true, true, true, []string{"test"}, "test")
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("PutAlerts", func(tt *testing.T) {
		// We should send alerts to the remote Alertmanager only.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(expErr).Once()
		require.ErrorIs(tt, expErr, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))
	})

	t.Run("GetReceivers", func(tt *testing.T) {
		// We should retrieve the receivers from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		expReceivers := []apimodels.Receiver{}
		remote.EXPECT().GetReceivers(mock.Anything).Return(expReceivers, nil).Once()
		receivers, err := forked.GetReceivers(ctx)
		require.NoError(tt, err)
		require.Equal(tt, expReceivers, receivers)

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().GetReceivers(mock.Anything).Return([]apimodels.Receiver{}, expErr).Once()
		_, err = forked.GetReceivers(ctx)
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("TestReceivers", func(tt *testing.T) {
		// TestReceivers should be called only in the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, 0, nil).Once()
		_, _, err := forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, 0, expErr).Once()
		_, _, err = forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("TestTemplate", func(tt *testing.T) {
		// TestTemplate should be called only in the internal Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the internal Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, expErr).Once()
		_, err = forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("StopAndWait", func(tt *testing.T) {
		// StopAndWait should be called on both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		internal.EXPECT().StopAndWait().Once()
		remote.EXPECT().StopAndWait().Once()
		forked.StopAndWait()
	})

	t.Run("Ready", func(tt *testing.T) {
		// Ready should be called on both Alertmanagers
		internal, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		internal.EXPECT().Ready().Return(true).Once()
		remote.EXPECT().Ready().Return(true).Once()
		require.True(tt, forked.Ready())

		// If one of the two Alertmanagers is not ready, it returns false.
		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		internal.EXPECT().Ready().Return(false).Maybe()
		remote.EXPECT().Ready().Return(true).Maybe()
		require.False(tt, forked.Ready())

		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		internal.EXPECT().Ready().Return(true).Maybe()
		remote.EXPECT().Ready().Return(false).Maybe()
		require.False(tt, forked.Ready())
	})
}

type internalAlertmanagerMock struct {
	*alertmanager_mock.AlertmanagerMock
	mergeStateCalled bool
}

func (m *internalAlertmanagerMock) MergeState(notifier.ExternalState) error {
	m.mergeStateCalled = true
	return nil
}

func withRemoteState(rsc RemoteSecondaryConfig) RemoteSecondaryConfig {
	rsc.WithRemoteState = true
	return rsc
}

func withSyncInterval(syncInterval time.Duration) func(RemoteSecondaryConfig) RemoteSecondaryConfig {
	return func(rsc RemoteSecondaryConfig) RemoteSecondaryConfig {
		rsc.SyncInterval = syncInterval
		return rsc
	}
}

func genTestAlertmanagers(t *testing.T, mode int, options ...func(RemoteSecondaryConfig) RemoteSecondaryConfig) (*internalAlertmanagerMock, *remote_alertmanager_mock.RemoteAlertmanagerMock, notifier.Alertmanager) {
	t.Helper()
	internal := &internalAlertmanagerMock{
		alertmanager_mock.NewAlertmanagerMock(t),
		false,
	}
	remote := remote_alertmanager_mock.NewRemoteAlertmanagerMock(t)

	if mode == modeRemoteSecondary {
		configs := map[int64]*models.AlertConfiguration{
			1: {},
		}
		cfg := RemoteSecondaryConfig{
			Logger: log.NewNopLogger(),
			OrgID:  1,
			Store:  notifier.NewFakeConfigStore(t, configs),
		}

		for _, opt := range options {
			cfg = opt(cfg)
		}

		forked, err := NewRemoteSecondaryForkedAlertmanager(cfg, internal, remote)
		require.NoError(t, err)
		return internal, remote, forked
	}
	return internal, remote, NewRemotePrimaryForkedAlertmanager(log.NewNopLogger(), internal, remote)
}

// errConfigStore returns an error when a method is called.
type errConfigStore struct{}

func (s *errConfigStore) GetLatestAlertmanagerConfiguration(context.Context, int64) (*models.AlertConfiguration, error) {
	return nil, errors.New("test error")
}
