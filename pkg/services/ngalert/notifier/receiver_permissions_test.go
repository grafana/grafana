package notifier

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	fake_secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestReceiverService_UpdateReceiverKeepsPermissions(t *testing.T) {
	failure := errors.New("update failed")
	for _, tc := range []struct {
		name      string
		rename    bool
		saveErr   error
		commitErr error
		want      []string
	}{
		// A rename keeps the UID, so permissions keyed by it are left alone.
		{name: "rename", rename: true, want: []string{"save", "commit"}},
		{name: "unchanged name", want: []string{"save", "commit"}},
		{name: "save failure", rename: true, saveErr: failure, want: []string{"save", "rollback"}},
		{name: "commit failure", rename: true, commitErr: failure, want: []string{"save", "commit"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := t.Context()
			requester := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
				1: {
					accesscontrol.ActionAlertingNotificationsWrite: nil,
					accesscontrol.ActionAlertingNotificationsRead:  nil,
				},
			}}
			secrets := fake_secrets.NewFakeSecretsService()
			sut := createReceiverServiceSut(t, &secrets)
			receiver, err := sut.GetReceiver(ctx, string(v1.ReceiverUID("grafana-default-email")), false, requester)
			require.NoError(t, err)
			if tc.rename {
				receiver.Name = "renamed"
			}

			var calls []string
			sut.xact = receiverPermissionTransactionFunc(func(ctx context.Context, work func(context.Context) error) error {
				err := work(context.WithValue(ctx, NopTransactionManager{}, struct{}{}))
				if err != nil {
					calls = append(calls, "rollback")
					return err
				}
				calls = append(calls, "commit")
				if tc.commitErr != nil {
					return tc.commitErr
				}
				return nil
			})
			sut.cfgStore = receiverPermissionConfigStore{alertmanagerConfigStore: sut.cfgStore, save: func(ctx context.Context) error {
				assertInTransaction(t, ctx)
				calls = append(calls, "save")
				return tc.saveErr
			}}
			sut.resourcePermissions = failingReceiverPermissions(t)

			_, err = sut.UpdateReceiver(ctx, receiver, nil, requester.OrgID, requester)
			if tc.saveErr != nil || tc.commitErr != nil {
				require.ErrorIs(t, err, failure)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tc.want, calls)
		})
	}
}

func TestReceiverService_UpdateReceiverInExistingTransaction(t *testing.T) {
	for _, tc := range []struct {
		name   string
		rename bool
	}{
		{name: "rename is allowed", rename: true},
		{name: "unchanged name is allowed"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			secrets := fake_secrets.NewFakeSecretsService()
			sut := createReceiverServiceSut(t, &secrets)
			requester := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
				1: {
					accesscontrol.ActionAlertingNotificationsWrite: nil,
					accesscontrol.ActionAlertingNotificationsRead:  nil,
				},
			}}
			ctx := context.WithValue(t.Context(), sqlstore.ContextSessionKey{}, &sqlstore.DBSession{})
			receiver, err := sut.GetReceiver(ctx, string(v1.ReceiverUID("grafana-default-email")), false, requester)
			require.NoError(t, err)
			if tc.rename {
				receiver.Name = "renamed"
			}
			called := false
			sut.xact = receiverPermissionTransactionFunc(func(ctx context.Context, work func(context.Context) error) error {
				called = true
				return work(context.WithValue(ctx, NopTransactionManager{}, struct{}{}))
			})
			sut.resourcePermissions = failingReceiverPermissions(t)

			_, err = sut.UpdateReceiver(ctx, receiver, nil, requester.OrgID, requester)
			require.NoError(t, err)
			require.True(t, called)
		})
	}
}

func TestReceiverService_UpdateReceiverAllowsTypedNilSession(t *testing.T) {
	secrets := fake_secrets.NewFakeSecretsService()
	sut := createReceiverServiceSut(t, &secrets)
	requester := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingNotificationsWrite: nil,
			accesscontrol.ActionAlertingNotificationsRead:  nil,
		},
	}}
	ctx := context.WithValue(t.Context(), sqlstore.ContextSessionKey{}, (*sqlstore.DBSession)(nil))
	receiver, err := sut.GetReceiver(ctx, string(v1.ReceiverUID("grafana-default-email")), false, requester)
	require.NoError(t, err)
	called := false
	sut.xact = receiverPermissionTransactionFunc(func(ctx context.Context, work func(context.Context) error) error {
		called = true
		return work(ctx)
	})
	_, err = sut.UpdateReceiver(ctx, receiver, nil, requester.OrgID, requester)
	require.NoError(t, err)
	require.True(t, called, "a typed nil session is not a transaction")
}

type receiverPermissionTransactionFunc func(context.Context, func(context.Context) error) error

func (f receiverPermissionTransactionFunc) InTransaction(ctx context.Context, work func(context.Context) error) error {
	return f(ctx, work)
}

type receiverPermissionConfigStore struct {
	alertmanagerConfigStore
	save func(context.Context) error
}

func (s receiverPermissionConfigStore) Save(ctx context.Context, _ *legacy_storage.ConfigRevision, _ int64) error {
	return s.save(ctx)
}

// failingReceiverPermissions fails the test if permissions are copied or deleted, which an update must never do since
// the UID, which permissions are keyed by, is preserved.
func failingReceiverPermissions(t *testing.T) receiverPermissionSpy {
	return receiverPermissionSpy{
		FakeReceiverPermissionsService: fakes.NewFakeReceiverPermissionsService(),
		t:                              t,
	}
}

type receiverPermissionSpy struct {
	*fakes.FakeReceiverPermissionsService
	t *testing.T
}

func (s receiverPermissionSpy) CopyPermissions(context.Context, int64, identity.Requester, string, string) (int, error) {
	s.t.Error("permissions must not be copied on update")
	return 0, nil
}

func (s receiverPermissionSpy) DeleteResourcePermissions(context.Context, int64, string) error {
	s.t.Error("permissions must not be deleted on update")
	return nil
}
