package remote

import (
	"context"
	"errors"
	"testing"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/alertmanager_mock"
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

	t.Run("GetStatus", func(tt *testing.T) {
		// We care about the status of the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
		status := apimodels.GettableStatus{}
		internal.EXPECT().GetStatus().Return(status).Once()
		require.Equal(tt, status, forked.GetStatus())
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
		internal.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, expErr).Once()
		_, err = forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
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

	t.Run("CleanUp", func(tt *testing.T) {
		// CleanUp() should be called only in the internal Alertmanager,
		// there's no cleanup to do in the remote one.
		internal, _, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		internal.EXPECT().CleanUp().Once()
		forked.CleanUp()
	})

	t.Run("StopAndWait", func(tt *testing.T) {
		// StopAndWait should be called in both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		internal.EXPECT().StopAndWait().Once()
		remote.EXPECT().StopAndWait().Once()
		forked.StopAndWait()
	})

	t.Run("Ready", func(tt *testing.T) {
		// Ready should be called on both Alertmanagers
		internal, remote, forked := genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().Ready().Return(true).Once()
		remote.EXPECT().Ready().Return(true).Once()
		require.True(tt, forked.Ready())

		// If one of the two Alertmanagers is not ready, it returns false.
		internal, remote, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().Ready().Return(false).Maybe()
		remote.EXPECT().Ready().Return(true).Maybe()
		require.False(tt, forked.Ready())

		internal, remote, forked = genTestAlertmanagers(tt, modeRemoteSecondary)
		internal.EXPECT().Ready().Return(true).Maybe()
		remote.EXPECT().Ready().Return(false).Maybe()
		require.False(tt, forked.Ready())
	})
}

func TestForkedAlertmanager_ModeRemotePrimary(t *testing.T) {
	ctx := context.Background()
	expErr := errors.New("test error")

	t.Run("GetStatus", func(tt *testing.T) {
		// We care about the status of the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		status := apimodels.GettableStatus{}
		remote.EXPECT().GetStatus().Return(status).Once()
		require.Equal(tt, status, forked.GetStatus())
	})

	t.Run("CreateSilence", func(tt *testing.T) {
		// We should create the silence in the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)

		expID := "test-id"
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return(expID, nil).Once()
		id, err := forked.CreateSilence(ctx, nil)
		require.NoError(tt, err)
		require.Equal(tt, expID, id)

		// If there's an error in the remote Alertmanager, the error should be returned.
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", expErr).Maybe()
		_, err = forked.CreateSilence(ctx, nil)
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("DeleteSilence", func(tt *testing.T) {
		// We should delete the silence in the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.DeleteSilence(ctx, ""))

		// If there's an error in the remote Alertmanager, the error should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(expErr).Maybe()
		require.ErrorIs(tt, expErr, forked.DeleteSilence(ctx, ""))
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
		remote.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, expErr).Once()
		_, err = forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("TestTemplate", func(tt *testing.T) {
		// TestTemplate should be called only in the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		remote.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, expErr).Once()
		_, err = forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("CleanUp", func(tt *testing.T) {
		// CleanUp() should be called only in the internal Alertmanager,
		// there's no cleanup to do in the remote one.
		internal, _, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		internal.EXPECT().CleanUp().Once()
		forked.CleanUp()
	})

	t.Run("StopAndWait", func(tt *testing.T) {
		// StopAndWait should be called in both Alertmanagers.
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
func genTestAlertmanagers(t *testing.T, mode int) (*alertmanager_mock.AlertmanagerMock, *alertmanager_mock.AlertmanagerMock, notifier.Alertmanager) {
	t.Helper()
	internal := alertmanager_mock.NewAlertmanagerMock(t)
	remote := alertmanager_mock.NewAlertmanagerMock(t)

	if mode == modeRemoteSecondary {
		return internal, remote, NewRemoteSecondaryForkedAlertmanager(internal, remote)
	}
	return internal, remote, NewRemotePrimaryForkedAlertmanager(internal, remote)
}
