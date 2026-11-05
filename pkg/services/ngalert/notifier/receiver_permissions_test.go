package notifier

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	fake_secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestReceiverService_UpdateReceiverRefreshPermissions(t *testing.T) {
	failure := errors.New("update failed")
	for _, tc := range []struct {
		name      string
		rename    bool
		copyErr   error
		deleteErr error
		saveErr   error
		commitErr error
		want      []string
	}{
		{name: "rename", rename: true, want: []string{"copy", "delete", "save", "commit"}},
		{name: "unchanged name", want: []string{"save", "commit"}},
		{name: "copy failure", rename: true, copyErr: failure, want: []string{"copy", "rollback"}},
		{name: "delete failure", rename: true, deleteErr: failure, want: []string{"copy", "delete", "rollback"}},
		{name: "save failure", rename: true, saveErr: failure, want: []string{"copy", "delete", "save", "rollback"}},
		{name: "commit failure", rename: true, commitErr: failure, want: []string{"copy", "delete", "save", "commit"}},
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
			receiver, err := sut.GetReceiver(ctx, legacy_storage.NameToUid("grafana-default-email"), false, requester)
			require.NoError(t, err)
			oldUID := receiver.UID
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
			sut.resourcePermissions = receiverPermissionSpy{
				FakeReceiverPermissionsService: fakes.NewFakeReceiverPermissionsService(),
				copy: func(ctx context.Context, orgID int64, actor identity.Requester, old, new string) (int, error) {
					assertInTransaction(t, ctx)
					require.Equal(t, requester.OrgID, orgID)
					require.Same(t, requester, actor)
					require.Equal(t, oldUID, old)
					require.Equal(t, legacy_storage.NameToUid("renamed"), new)
					calls = append(calls, "copy")
					return 1, tc.copyErr
				},
				delete: func(ctx context.Context, orgID int64, uid string) error {
					assertInTransaction(t, ctx)
					require.Equal(t, requester.OrgID, orgID)
					require.Equal(t, oldUID, uid)
					calls = append(calls, "delete")
					return tc.deleteErr
				},
			}

			_, err = sut.UpdateReceiver(ctx, receiver, nil, requester.OrgID, requester)
			if tc.copyErr != nil || tc.deleteErr != nil || tc.saveErr != nil || tc.commitErr != nil {
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
			receiver, err := sut.GetReceiver(ctx, legacy_storage.NameToUid("grafana-default-email"), false, requester)
			require.NoError(t, err)
			if tc.rename {
				receiver.Name = "renamed"
			}
			called := false
			sut.xact = receiverPermissionTransactionFunc(func(ctx context.Context, work func(context.Context) error) error {
				called = true
				return work(context.WithValue(ctx, NopTransactionManager{}, struct{}{}))
			})
			copied := false
			sut.resourcePermissions = receiverPermissionSpy{
				FakeReceiverPermissionsService: fakes.NewFakeReceiverPermissionsService(),
				copy: func(ctx context.Context, _ int64, actor identity.Requester, _, _ string) (int, error) {
					require.True(t, sqlstore.IsInTransaction(ctx))
					require.Same(t, requester, actor)
					copied = true
					return 0, nil
				},
				delete: func(context.Context, int64, string) error { return nil },
			}

			_, err = sut.UpdateReceiver(ctx, receiver, nil, requester.OrgID, requester)
			require.Equal(t, tc.rename, copied)
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
	receiver, err := sut.GetReceiver(ctx, legacy_storage.NameToUid("grafana-default-email"), false, requester)
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

type receiverPermissionSpy struct {
	*fakes.FakeReceiverPermissionsService
	copy   func(context.Context, int64, identity.Requester, string, string) (int, error)
	delete func(context.Context, int64, string) error
}

func (s receiverPermissionSpy) CopyPermissions(ctx context.Context, orgID int64, user identity.Requester, old, new string) (int, error) {
	return s.copy(ctx, orgID, user, old, new)
}

func (s receiverPermissionSpy) DeleteResourcePermissions(ctx context.Context, orgID int64, uid string) error {
	return s.delete(ctx, orgID, uid)
}
