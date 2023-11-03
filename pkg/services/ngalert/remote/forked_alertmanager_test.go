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
		expErr := errors.New("test error")
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
		expErr := errors.New("test error")
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
		expErr := errors.New("test error")
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
		expErr := errors.New("test error")
		internal.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(apimodels.GettableSilences{}, expErr).Once()
		_, err = forked.ListSilences(ctx, []string{})
		require.ErrorIs(tt, expErr, err)
	})
}

func TestForkedAlertmanager_ModeRemotePrimary(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateSilence", func(tt *testing.T) {
		// We should create the silence in both Alertmanagers.
		// We care about the id returned by the remote one.
		internal, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)

		expID := "test-id"
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", nil).Once()
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return(expID, nil).Once()
		id, err := forked.CreateSilence(ctx, nil)
		require.NoError(tt, err)
		require.Equal(tt, expID, id)

		// If have an error in either Alertmanager, the error should be returned.
		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		expErr := errors.New("test error")
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", expErr).Once()
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", nil).Maybe()
		_, err = forked.CreateSilence(ctx, nil)
		require.ErrorIs(tt, expErr, err)

		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		internal.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", nil).Maybe()
		remote.EXPECT().CreateSilence(mock.Anything, mock.Anything).Return("", expErr).Once()
		_, err = forked.CreateSilence(ctx, nil)
		require.ErrorIs(tt, expErr, err)
	})

	t.Run("DeleteSilence", func(tt *testing.T) {
		// We should delete the silence in both Alertmanagers.
		internal, remote, forked := genTestAlertmanagers(tt, modeRemotePrimary)
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Once()
		remote.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Once()
		require.NoError(tt, forked.DeleteSilence(ctx, ""))

		// If have an error in either Alertmanager, the error should be returned.
		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		expErr := errors.New("test error")
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(expErr).Once()
		remote.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Maybe()
		require.ErrorIs(tt, expErr, forked.DeleteSilence(ctx, ""))

		internal, remote, forked = genTestAlertmanagers(tt, modeRemotePrimary)
		internal.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(nil).Maybe()
		remote.EXPECT().DeleteSilence(mock.Anything, mock.Anything).Return(expErr).Once()
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
		expErr := errors.New("test error")
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
		expErr := errors.New("test error")
		remote.EXPECT().ListSilences(mock.Anything, mock.Anything).Return(apimodels.GettableSilences{}, expErr).Once()
		_, err = forked.ListSilences(ctx, []string{})
		require.ErrorIs(tt, expErr, err)
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
