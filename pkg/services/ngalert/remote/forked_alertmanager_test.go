package remote

import (
	"context"
	"testing"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	alertmanager_mocks "github.com/grafana/grafana/pkg/services/ngalert/notifier/alertmanager_mock"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestForkedAlertmanager_ModeRemoteSecondary(t *testing.T) {
	ctx := context.Background()
	t.Run("ApplyConfig", func(tt *testing.T) {
		// ApplyConfig should be called in both Alertmanagers the first time it runs.
		// The second time it should only be called in the internal Alertmanager.
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		remote.EXPECT().ApplyConfig(mock.Anything, mock.Anything).Return(nil).Once()
		internal.EXPECT().ApplyConfig(mock.Anything, mock.Anything).Return(nil).Twice()
		require.NoError(tt, forked.ApplyConfig(ctx, nil))
		require.NoError(tt, forked.ApplyConfig(ctx, nil))
	})

	t.Run("SaveAndApplyConfig", func(tt *testing.T) {
		// SaveAndApplyConfig should not be called in the remote Alertmanager.
		// We should send configuration only on startup and shutdown.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().SaveAndApplyConfig(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.SaveAndApplyConfig(ctx, nil))
	})

	t.Run("SaveAndApplyDefaultConfig", func(tt *testing.T) {
		// SaveAndApplyDefaultConfig should not be called in the remote Alertmanager.
		// We should send configuration only on startup and shutdown.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().SaveAndApplyDefaultConfig(mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.SaveAndApplyDefaultConfig(ctx))
	})

	t.Run("GetStatus", func(tt *testing.T) {
		// We care about the status of the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		status := apimodels.GettableStatus{}
		internal.EXPECT().GetStatus().Return(status).Once()
		require.Equal(tt, status, forked.GetStatus())
	})

	t.Run("CreateSilence", func(tt *testing.T) {
		// We should create the silence in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)

		expID := "abc123"
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return(expID, nil).Once()
		id, err := forked.CreateSilence(ctx, nil)
		require.NoError(tt, err)
		require.Equal(tt, expID, id)
	})

	t.Run("DeleteSilence", func(tt *testing.T) {
		// We should delete the silence in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.DeleteSilence(ctx, ""))
	})

	t.Run("GetSilence", func(tt *testing.T) {
		// We should get the silence from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)

		expSilence := apimodels.GettableSilence{}
		internal.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(expSilence, nil).Once()
		silence, err := forked.GetSilence(ctx, "")
		require.NoError(tt, err)
		require.Equal(tt, expSilence, silence)
	})

	t.Run("ListSilences", func(tt *testing.T) {
		// We should get the silences from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)

		expSilences := apimodels.GettableSilences{}
		internal.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(expSilences, nil).Once()
		silences, err := forked.ListSilences(ctx, []string{})
		require.NoError(tt, err)
		require.Equal(tt, expSilences, silences)
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
	})

	t.Run("PutAlerts", func(tt *testing.T) {
		// We should send alerts to the internal Alertmanager only.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))
	})

	t.Run("GetReceivers", func(tt *testing.T) {
		// We should retrieve the receivers from the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)

		expReceivers := []apimodels.Receiver{}
		internal.EXPECT().GetReceivers(mock.Anything).Return(expReceivers, nil).Once()
		receivers, err := forked.GetReceivers(ctx)
		require.NoError(tt, err)
		require.Equal(tt, expReceivers, receivers)
	})

	t.Run("TestReceivers", func(tt *testing.T) {
		// TestReceivers should be called only in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.NoError(tt, err)
	})

	t.Run("TestTemplate", func(tt *testing.T) {
		// TestTemplate should be called only in the internal Alertmanager.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.NoError(tt, err)
	})

	t.Run("CleanUp", func(tt *testing.T) {
		// CleanUp() should be called only in the internal Alertmanager,
		// there's no cleanup to do in the remote one.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().CleanUp().Once()
		forked.CleanUp()
	})

	t.Run("StopAndWait", func(tt *testing.T) {
		// StopAndWait should be called in both Alertmanagers.
		// Configuration is sent on shutdown to the remote Alertmanager, so ApplyConfig should be called too.
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().StopAndWait().Once()
		remote.EXPECT().StopAndWait().Once()
		// TODO: send config and state.
		// remote.EXPECT().ApplyConfig(mock.Anything, mock.Anything).Return(nil)
		forked.StopAndWait()
	})

	t.Run("Ready", func(tt *testing.T) {
		// Ready should be called on both Alertmanagers
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().Ready().Return(true).Once()
		remote.EXPECT().Ready().Return(true).Once()
		require.True(tt, forked.Ready())

		// If one of the two Alertmanagers is not ready, it returns false.
		internal, remote, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().Ready().Return(false).Maybe()
		remote.EXPECT().Ready().Return(true).Maybe()
		require.False(tt, forked.Ready())

		internal, remote, forked = genTestAlertmanagers(tt, ModeRemoteSecondary)
		internal.EXPECT().Ready().Return(true).Maybe()
		remote.EXPECT().Ready().Return(false).Maybe()
		require.False(tt, forked.Ready())
	})
}

func TestForkedAlertmanager_ModeRemotePrimary(t *testing.T) {
	ctx := context.Background()
	t.Run("ApplyConfig", func(tt *testing.T) {
		// ApplyConfig should be called in both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().ApplyConfig(mock.Anything, mock.Anything).Return(nil).Twice()
		internal.EXPECT().ApplyConfig(mock.Anything, mock.Anything).Return(nil).Twice()
		require.NoError(tt, forked.ApplyConfig(ctx, nil))
		require.NoError(tt, forked.ApplyConfig(ctx, nil))
	})

	t.Run("SaveAndApplyConfig", func(tt *testing.T) {
		// SaveAndApplyConfig should be called in both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().SaveAndApplyConfig(mock.Anything, mock.Anything).Return(nil).Once()
		remote.EXPECT().SaveAndApplyConfig(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.SaveAndApplyConfig(ctx, nil))
	})

	t.Run("SaveAndApplyDefaultConfig", func(tt *testing.T) {
		// SaveAndApplyDefaultConfig should be called in both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().SaveAndApplyDefaultConfig(mock.Anything).Return(nil).Once()
		remote.EXPECT().SaveAndApplyDefaultConfig(mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.SaveAndApplyDefaultConfig(ctx))
	})

	t.Run("GetStatus", func(tt *testing.T) {
		// We care about the status of the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		status := apimodels.GettableStatus{}
		remote.EXPECT().GetStatus().Return(status).Once()
		require.Equal(tt, status, forked.GetStatus())
	})

	t.Run("CreateSilence", func(tt *testing.T) {
		// We should create the silence in both Alertmanagers.
		// We care about the id returned by the remote one.
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		expID := "abc123"
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", nil).Once()
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return(expID, nil).Once()
		id, err := forked.CreateSilence(ctx, nil)
		require.NoError(tt, err)
		require.Equal(tt, expID, id)
	})

	t.Run("DeleteSilence", func(tt *testing.T) {
		// We should delete the silence in both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Once()
		remote.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.DeleteSilence(ctx, ""))
	})

	t.Run("GetSilence", func(tt *testing.T) {
		// We should get the silence from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		expSilence := apimodels.GettableSilence{}
		remote.EXPECT().GetSilence(mock.Anything, mock.Anything).Return(expSilence, nil).Once()
		silence, err := forked.GetSilence(ctx, "")
		require.NoError(tt, err)
		require.Equal(tt, expSilence, silence)
	})

	t.Run("ListSilences", func(tt *testing.T) {
		// We should get the silences from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		expSilences := apimodels.GettableSilences{}
		remote.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(expSilences, nil).Once()
		silences, err := forked.ListSilences(ctx, []string{})
		require.NoError(tt, err)
		require.Equal(tt, expSilences, silences)
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
	})

	t.Run("PutAlerts", func(tt *testing.T) {
		// We should send alerts to the remote Alertmanager only.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().PutAlerts(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.PutAlerts(ctx, apimodels.PostableAlerts{}))
	})

	t.Run("GetReceivers", func(tt *testing.T) {
		// We should retrieve the receivers from the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		expReceivers := []apimodels.Receiver{}
		remote.EXPECT().GetReceivers(mock.Anything).Return(expReceivers, nil).Once()
		receivers, err := forked.GetReceivers(ctx)
		require.NoError(tt, err)
		require.Equal(tt, expReceivers, receivers)
	})

	t.Run("TestReceivers", func(tt *testing.T) {
		// TestReceivers should be called only in the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().TestReceivers(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestReceivers(ctx, apimodels.TestReceiversConfigBodyParams{})
		require.NoError(tt, err)
	})

	t.Run("TestTemplate", func(tt *testing.T) {
		// TestTemplate should be called only in the remote Alertmanager.
		_, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		remote.EXPECT().TestTemplate(mock.Anything, mock.Anything).Return(nil, nil).Once()
		_, err := forked.TestTemplate(ctx, apimodels.TestTemplatesConfigBodyParams{})
		require.NoError(tt, err)
	})

	t.Run("CleanUp", func(tt *testing.T) {
		// CleanUp() should be called only in the internal Alertmanager,
		// there's no cleanup to do in the remote one.
		internal, _, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().CleanUp().Once()
		forked.CleanUp()
	})

	t.Run("StopAndWait", func(tt *testing.T) {
		// StopAndWait should be called in both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().StopAndWait().Once()
		remote.EXPECT().StopAndWait().Once()
		forked.StopAndWait()
	})

	t.Run("Ready", func(tt *testing.T) {
		// Ready should be called on both Alertmanagers
		internal, remote, forked := genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().Ready().Return(true).Once()
		remote.EXPECT().Ready().Return(true).Once()
		require.True(tt, forked.Ready())

		// If one of the two Alertmanagers is not ready, it returns false.
		internal, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().Ready().Return(false).Maybe()
		remote.EXPECT().Ready().Return(true).Maybe()
		require.False(tt, forked.Ready())

		internal, remote, forked = genTestAlertmanagers(tt, ModeRemotePrimary)
		internal.EXPECT().Ready().Return(true).Maybe()
		remote.EXPECT().Ready().Return(false).Maybe()
		require.False(tt, forked.Ready())
	})
}

func genTestAlertmanagers(t *testing.T, mode Mode) (*alertmanager_mocks.AlertmanagerMock, *alertmanager_mocks.AlertmanagerMock, *forkedAlertmanager) {
	t.Helper()

	internal := alertmanager_mocks.NewAlertmanagerMock(t)
	remote := alertmanager_mocks.NewAlertmanagerMock(t)
	forked := NewForkedAlertmanager(internal, remote, mode)

	return internal, remote, forked
}
