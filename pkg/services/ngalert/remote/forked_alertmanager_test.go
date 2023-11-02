package remote

import (
	"context"
	"errors"
	"testing"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/alertmanager_mock"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestForkedAlertmanager_ModeRemoteSecondary(t *testing.T) {
	ctx := context.Background()
	testErr := errors.New("test error")

	t.Run("CreateSilence", func(tt *testing.T) {
		// We should create the silence in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)

		expID := "test-id"
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return(expID, nil).Once()
		id, err := forked.CreateSilence(ctx, nil)
		require.NoError(tt, err)
		require.Equal(tt, expID, id)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", testErr).Once()
		_, err = forked.CreateSilence(ctx, nil)
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("DeleteSilence", func(tt *testing.T) {
		// We should delete the silence in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.DeleteSilence(ctx, ""))

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(testErr).Once()
		require.ErrorIs(tt, testErr, forked.DeleteSilence(ctx, ""))
	})

	t.Run("GetSilence", func(tt *testing.T) {
		// We should get the silence from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)

		expSilence := apimodels.GettableSilence{}
		internal.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(expSilence, nil).Once()
		silence, err := forked.GetSilence(ctx, "")
		require.NoError(tt, err)
		require.Equal(tt, expSilence, silence)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(apimodels.GettableSilence{}, testErr).Once()
		_, err = forked.GetSilence(ctx, "")
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("ListSilences", func(tt *testing.T) {
		// We should get the silences from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)

		expSilences := apimodels.GettableSilences{}
		internal.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(expSilences, nil).Once()
		silences, err := forked.ListSilences(ctx, []string{})
		require.NoError(tt, err)
		require.Equal(tt, expSilences, silences)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(apimodels.GettableSilences{}, testErr).Once()
		_, err = forked.ListSilences(ctx, []string{})
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("GetAlerts", func(tt *testing.T) {
		// We should get alerts from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)

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
		internal, _, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)

		internal.EXPECT().GetAlerts(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(apimodels.GettableAlerts{}, testErr).Once()

		_, err = forked.GetAlerts(ctx, true, true, true, []string{"test"}, "test")
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("GetAlertGroups", func(tt *testing.T) {
		// We should get alert groups from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)

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
		internal, _, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)

		internal.EXPECT().GetAlertGroups(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(apimodels.AlertGroups{}, testErr).Once()

		_, err = forked.GetAlertGroups(ctx, true, true, true, []string{"test"}, "test")
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("PutAlerts", func(tt *testing.T) {
		// We should send alerts to the internal Alertmanager only.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(testErr).Once()
		require.ErrorIs(tt, testErr, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))
	})

	t.Run("GetReceivers", func(tt *testing.T) {
		// We should retrieve the receivers from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		expReceivers := []apimodels.Receiver{}
		internal.EXPECT().GetReceivers(mock.Anything).Return(expReceivers, nil).Once()
		receivers, err := forked.GetReceivers(ctx)
		require.NoError(tt, err)
		require.Equal(tt, expReceivers, receivers)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().GetReceivers(mock.Anything).Return([]apimodels.Receiver{}, testErr).Once()
		_, err = forked.GetReceivers(ctx)
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("TestReceivers", func(tt *testing.T) {
		// TestReceivers should be called only in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, testErr).Once()
		_, err = forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("TestTemplate", func(tt *testing.T) {
		// TestTemplate should be called only in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the internal Alertmanager, it should be returned.
		internal, _, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, testErr).Once()
		_, err = forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.ErrorIs(tt, testErr, err)
	})
}

func TestForkedAlertmanager_ModeRemotePrimary(t *testing.T) {
	ctx := context.Background()
	testErr := errors.New("test error")

	t.Run("CreateSilence", func(tt *testing.T) {
		// We should create the silence in both Alertmanagers.
		// We care about the id returned by the remote one.
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)

		expID := "test-id"
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", nil).Once()
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return(expID, nil).Once()
		id, err := forked.CreateSilence(ctx, nil)
		require.NoError(tt, err)
		require.Equal(tt, expID, id)

		// If have an error in either Alertmanager, the error should be returned.
		internal, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", testErr).Once()
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", nil).Maybe()
		_, err = forked.CreateSilence(ctx, nil)
		require.ErrorIs(tt, testErr, err)

		internal, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", nil).Maybe()
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", testErr).Once()
		_, err = forked.CreateSilence(ctx, nil)
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("DeleteSilence", func(tt *testing.T) {
		// We should delete the silence in both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Once()
		remote.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.DeleteSilence(ctx, ""))

		// If have an error in either Alertmanager, the error should be returned.
		internal, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(testErr).Once()
		remote.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Maybe()
		require.ErrorIs(tt, testErr, forked.DeleteSilence(ctx, ""))

		internal, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Maybe()
		remote.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(testErr).Once()
		require.ErrorIs(tt, testErr, forked.DeleteSilence(ctx, ""))
	})

	t.Run("GetSilence", func(tt *testing.T) {
		// We should get the silence from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		expSilence := apimodels.GettableSilence{}
		remote.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(expSilence, nil).Once()
		silence, err := forked.GetSilence(ctx, "")
		require.NoError(tt, err)
		require.Equal(tt, expSilence, silence)

		// If there's an error in the remote Alertmanager, the error should be returned.
		_, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(apimodels.GettableSilence{}, testErr).Once()
		_, err = forked.GetSilence(ctx, "")
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("ListSilences", func(tt *testing.T) {
		// We should get the silences from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		expSilences := apimodels.GettableSilences{}
		remote.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(expSilences, nil).Once()
		silences, err := forked.ListSilences(ctx, []string{})
		require.NoError(tt, err)
		require.Equal(tt, expSilences, silences)

		// If there's an error in the remote Alertmanager, the error should be returned.
		_, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(apimodels.GettableSilences{}, testErr).Once()
		_, err = forked.ListSilences(ctx, []string{})
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("GetAlerts", func(tt *testing.T) {
		// We should get alerts from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)

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
		_, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)

		remote.EXPECT().GetAlerts(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(apimodels.GettableAlerts{}, testErr).Once()

		_, err = forked.GetAlerts(ctx, true, true, true, []string{"test"}, "test")
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("GetAlertGroups", func(tt *testing.T) {
		// We should get alert groups from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)

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
		_, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)

		remote.EXPECT().GetAlertGroups(
			mock.Anything,
			true,
			true,
			true,
			[]string{"test"},
			"test",
		).Return(apimodels.AlertGroups{}, testErr).Once()

		_, err = forked.GetAlertGroups(ctx, true, true, true, []string{"test"}, "test")
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("PutAlerts", func(tt *testing.T) {
		// We should send alerts to the remote Alertmanager only.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(testErr).Once()
		require.ErrorIs(tt, testErr, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))
	})

	t.Run("GetReceivers", func(tt *testing.T) {
		// We should retrieve the receivers from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		expReceivers := []apimodels.Receiver{}
		remote.EXPECT().GetReceivers(mock.Anything).Return(expReceivers, nil).Once()
		receivers, err := forked.GetReceivers(ctx)
		require.NoError(tt, err)
		require.Equal(tt, expReceivers, receivers)

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().GetReceivers(mock.Anything).Return([]apimodels.Receiver{}, testErr).Once()
		_, err = forked.GetReceivers(ctx)
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("TestReceivers", func(tt *testing.T) {
		// TestReceivers should be called only in the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, testErr).Once()
		_, err = forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.ErrorIs(tt, testErr, err)
	})

	t.Run("TestTemplate", func(tt *testing.T) {
		// TestTemplate should be called only in the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.NoError(tt, err)

		// If there's an error in the remote Alertmanager, it should be returned.
		_, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, testErr).Once()
		_, err = forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.ErrorIs(tt, testErr, err)
	})
}
func genTestAlertmanagers(t *testing.T, mode Mode) (*alertmanager_mock.AlertmanagerMock, *alertmanager_mock.AlertmanagerMock, *ForkedAlertmanager) {
	t.Helper()

	internal := alertmanager_mock.NewAlertmanagerMock(t)
	remote := alertmanager_mock.NewAlertmanagerMock(t)
	forked := NewForkedAlertmanager(internal, remote, mode)

	return internal, remote, forked
}
