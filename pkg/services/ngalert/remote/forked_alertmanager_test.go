package remote

import (
	"context"
	"errors"
	"testing"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	alertingModels "github.com/grafana/alerting/models"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/alertmanager_mock"
)

func TestForkedAlertmanager_ModeRemotePrimary(t *testing.T) {
	ctx := context.Background()
	expErr := errors.New("test error")

	t.Run("ApplyConfig", func(tt *testing.T) {
		// If the remote Alertmanager is not ready, ApplyConfig should be called on both Alertmanagers,
		// first on the remote, then on the internal.
		internal, remote, forked := genTestAlertmanagers(tt)
		remoteCall := remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(true, nil).Once()
		internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(true, nil).Once().NotBefore(remoteCall)
		applied, err := forked.ApplyConfig(ctx, alertingNotify.NotificationsConfiguration{})
		require.True(tt, applied)
		require.NoError(tt, err)

		// An error in the remote Alertmanager should be returned.
		_, remote, forked = genTestAlertmanagers(tt)
		remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(false, expErr).Once()
		applied, err = forked.ApplyConfig(ctx, alertingNotify.NotificationsConfiguration{})
		require.False(tt, applied)
		require.ErrorIs(tt, err, expErr)

		// An error in the internal Alertmanager should not be returned.
		internal, remote, forked = genTestAlertmanagers(tt)
		remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(true, nil).Once()
		internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(false, expErr).Once()
		applied, err = forked.ApplyConfig(ctx, alertingNotify.NotificationsConfiguration{})
		require.True(tt, applied)
		require.NoError(tt, err)
	})

	t.Run("SaveAndApplyDefaultConfig", func(tt *testing.T) {
		withMoa := func(am notifier.Alertmanager) *notifier.MultiOrgAlertmanager {
			return notifier.NewTestMultiOrgAlertmanager(t,
				notifier.WithAlertmanagers(map[int64]notifier.Alertmanager{
					1: am,
				}),
				notifier.WithSkipLoad(),
			)
		}
		// SaveAndApplyDefaultConfig should be called on both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt)
		internal.EXPECT().Ready().Return(true).Once()
		remote.EXPECT().Ready().Return(true).Once()
		remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(true, nil).Once()
		internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(true, nil).Once()
		require.NoError(tt, withMoa(forked).SaveAndApplyDefaultConfig(ctx, 1))

		// An error in the remote Alertmanager should be returned.
		internal, remote, forked = genTestAlertmanagers(tt)
		internal.EXPECT().Ready().Return(true).Once()
		remote.EXPECT().Ready().Return(true).Once()
		remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(false, expErr).Once()
		require.ErrorIs(tt, withMoa(forked).SaveAndApplyDefaultConfig(ctx, 1), expErr)

		// An error in the internal Alertmanager should not be returned.
		internal, remote, forked = genTestAlertmanagers(tt)
		internal.EXPECT().Ready().Return(true).Once()
		remote.EXPECT().Ready().Return(true).Once()
		remote.EXPECT().ApplyConfig(ctx, mock.Anything).Return(true, nil).Once()
		internal.EXPECT().ApplyConfig(ctx, mock.Anything).Return(false, expErr).Once()
		require.NoError(tt, withMoa(forked).SaveAndApplyDefaultConfig(ctx, 1))
	})

	t.Run("GetStatus", func(tt *testing.T) {
		{
			// We care about the status of the remote Alertmanager.
			_, remote, forked := genTestAlertmanagers(tt)
			status := apimodels.GettableStatus{}
			remote.EXPECT().GetStatus(ctx).Return(status, nil).Once()
			got, err := forked.GetStatus(ctx)
			require.NoError(tt, err)
			require.Equal(tt, status, got)
		}

		{
			// If there's an error in the remote Alertmanager, it should be returned.
			_, remote, forked := genTestAlertmanagers(tt)
			remote.EXPECT().GetStatus(ctx).Return(apimodels.GettableStatus{}, expErr).Once()
			_, err := forked.GetStatus(ctx)
			require.ErrorIs(tt, expErr, err)
		}
	})

	t.Run("CreateSilence", func(tt *testing.T) {
		// We should create the silence in the remote Alertmanager.
		testSilence := &apimodels.PostableSilence{}
		expID := "test-id"

		_, remote, forked := genTestAlertmanagers(tt)
		remote.EXPECT().CreateSilence(mock.Anything, testSilence).Return(expID, nil).Once()
		id, err := forked.CreateSilence(ctx, testSilence)
		require.NoError(tt, err)
		require.Equal(tt, expID, id)

		// If there's an error in the remote Alertmanager, the error should be returned.
		_, remote, forked = genTestAlertmanagers(tt)
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", expErr).Once()
		_, err = forked.CreateSilence(ctx, testSilence)
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("DeleteSilence", func(tt *testing.T) {
		// We should delete the silence in the remote Alertmanager.
		testID := "test-id"
		_, remote, forked := genTestAlertmanagers(tt)
		remote.EXPECT().DeleteSilence(mock.Anything, testID).Return(nil).Once()
		require.NoError(tt, forked.DeleteSilence(ctx, testID))

		// If there's an error in the remote Alertmanager, the error should be returned.
		_, remote, forked = genTestAlertmanagers(tt)
		remote.EXPECT().DeleteSilence(mock.Anything, testID).Return(expErr).Once()
		require.ErrorIs(tt, expErr, forked.DeleteSilence(ctx, testID))
	})

	t.Run("GetSilence", func(tt *testing.T) {
		// We should get the silence from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt)
		expSilence := apimodels.GettableSilence{}
		remote.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(expSilence, nil).Once()
		silence, err := forked.GetSilence(ctx, "")
		require.NoError(tt, err)
		require.Equal(tt, expSilence, silence)

		// If there's an error in the remote Alertmanager, the error should be returned.
		_, remote, forked = genTestAlertmanagers(tt)
		remote.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(apimodels.GettableSilence{}, expErr).Once()
		_, err = forked.GetSilence(ctx, "")
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("ListSilences", func(tt *testing.T) {
		// We should get the silences from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt)
		expSilences := apimodels.GettableSilences{}
		remote.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(expSilences, nil).Once()
		silences, err := forked.ListSilences(ctx, []string{})
		require.NoError(tt, err)
		require.Equal(tt, expSilences, silences)

		// If there's an error in the remote Alertmanager, the error should be returned.
		_, remote, forked = genTestAlertmanagers(tt)
		remote.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(apimodels.GettableSilences{}, expErr).Once()
		_, err = forked.ListSilences(ctx, []string{})
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("GetAlerts", func(tt *testing.T) {
		// We should get alerts from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt)

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
		_, remote, forked = genTestAlertmanagers(tt)

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
		_, remote, forked := genTestAlertmanagers(tt)

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
		_, remote, forked = genTestAlertmanagers(tt)

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
		_, remote, forked := genTestAlertmanagers(tt)
		remote.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt)
		remote.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(expErr).Once()
		require.ErrorIs(tt, expErr, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))
	})

	t.Run("GetReceivers", func(tt *testing.T) {
		// We should retrieve the receivers from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt)
		expReceivers := []alertingModels.ReceiverStatus{}
		remote.EXPECT().GetReceivers(mock.Anything).Return(expReceivers, nil).Once()
		receivers, err := forked.GetReceivers(ctx)
		require.NoError(tt, err)
		require.Equal(tt, expReceivers, receivers)

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt)
		remote.EXPECT().GetReceivers(mock.Anything).Return([]alertingModels.ReceiverStatus{}, expErr).Once()
		_, err = forked.GetReceivers(ctx)
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("TestIntegration", func(tt *testing.T) {
		// TestReceivers should be called only in the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt)
		remote.EXPECT().TestIntegration(mock.Anything, "", mock.Anything, mock.Anything).Return(alertingModels.IntegrationStatus{}, nil).Once()
		_, err := forked.TestIntegration(ctx, "", models.IntegrationGen()(), alertingModels.TestReceiversConfigAlertParams{})
		require.NoError(tt, err)

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt)
		remote.EXPECT().TestIntegration(mock.Anything, "", mock.Anything, mock.Anything).Return(alertingModels.IntegrationStatus{}, expErr).Once()
		_, err = forked.TestIntegration(ctx, "", models.IntegrationGen()(), alertingModels.TestReceiversConfigAlertParams{})
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("TestTemplate", func(tt *testing.T) {
		// TestTemplate should be called only in the internal Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt)
		remote.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the internal Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt)
		remote.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, expErr).Once()
		_, err = forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("StopAndWait", func(tt *testing.T) {
		// StopAndWait should be called on both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt)
		internal.EXPECT().StopAndWait().Once()
		remote.EXPECT().StopAndWait().Once()
		forked.StopAndWait()
	})

	t.Run("Ready", func(tt *testing.T) {
		// Ready should be called on both Alertmanagers
		internal, remote, forked := genTestAlertmanagers(tt)
		internal.EXPECT().Ready().Return(true).Once()
		remote.EXPECT().Ready().Return(true).Once()
		require.True(tt, forked.Ready())

		// If one of the two Alertmanagers is not ready, it returns false.
		internal, remote, forked = genTestAlertmanagers(tt)
		internal.EXPECT().Ready().Return(false).Maybe()
		remote.EXPECT().Ready().Return(true).Maybe()
		require.False(tt, forked.Ready())

		internal, remote, forked = genTestAlertmanagers(tt)
		internal.EXPECT().Ready().Return(true).Maybe()
		remote.EXPECT().Ready().Return(false).Maybe()
		require.False(tt, forked.Ready())
	})
}
func genTestAlertmanagers(t *testing.T) (*alertmanager_mock.AlertmanagerMock, *alertmanager_mock.AlertmanagerMock, notifier.Alertmanager) {
	t.Helper()
	internal := alertmanager_mock.NewAlertmanagerMock(t)
	remote := alertmanager_mock.NewAlertmanagerMock(t)
	return internal, remote, newRemotePrimaryForkedAlertmanager(log.NewNopLogger(), internal, remote)
}
