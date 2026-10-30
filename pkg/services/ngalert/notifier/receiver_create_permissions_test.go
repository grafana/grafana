package notifier

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	fake_secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationCreateReceiverPermissionEvents(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, rollback := range []bool{false, true} {
		name := "commit"
		if rollback {
			name = "rollback"
		}
		t.Run(name, func(t *testing.T) {
			sql := sqlstore.NewTestStore(t)
			secrets := fake_secrets.NewFakeSecretsService()
			sut := createReceiverServiceSut(t, &secrets)
			sut.xact = sql
			requester := &user.SignedInUser{UserID: 7, OrgID: 1, Permissions: map[int64]map[string][]string{
				1: {accesscontrol.ActionAlertingNotificationsWrite: nil, accesscontrol.ActionAlertingNotificationsRead: nil},
			}}
			var calls []string
			ac := &createReceiverCacheRecorder{t: t, calls: &calls}
			permissions, err := ossaccesscontrol.ProvideReceiverPermissionsService(setting.NewCfg(), featuremgmt.WithFeatures(), routing.NewRouteRegister(), sql,
				actest.FakeAccessControl{ExpectedEvaluate: true}, iam.Features{}, &licensing.OSSLicensingService{}, ac, nil,
				&usertest.FakeUserService{ExpectedSignedInUser: requester}, nil, resourcepermissions.NewActionSetService())
			require.NoError(t, err)
			sut.resourcePermissions = permissions
			receiver, err := sut.GetReceiver(t.Context(), legacy_storage.NameToUid("grafana-default-email"), false, requester)
			require.NoError(t, err)
			receiver.Name = "new receiver"
			receiver.UID = ""
			for _, integration := range receiver.Integrations {
				integration.UID = ""
			}
			failure := errors.New("outer mutation failed")
			err = sql.InTransaction(t.Context(), func(ctx context.Context) error {
				_, err := sut.CreateReceiver(ctx, receiver, requester.OrgID, requester)
				require.NoError(t, err)
				require.Empty(t, calls, "the real create caller must preserve the outer SQL session")
				if rollback {
					return failure
				}
				return nil
			})
			if rollback {
				require.ErrorIs(t, err, failure)
				require.Empty(t, calls)
			} else {
				require.NoError(t, err)
				require.Equal(t, []string{"clear", "clear", "refresh"}, calls)
			}
		})
	}
}

type createReceiverCacheRecorder struct {
	actest.FakeService
	t     *testing.T
	calls *[]string
}

func (r *createReceiverCacheRecorder) ClearUserPermissionCache(identity.Requester) {
	*r.calls = append(*r.calls, "clear")
}

func (r *createReceiverCacheRecorder) GetUserPermissions(ctx context.Context, _ identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	require.False(r.t, sqlstore.IsInTransaction(ctx))
	require.True(r.t, options.ReloadCache)
	*r.calls = append(*r.calls, "refresh")
	return nil, nil
}
