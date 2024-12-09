package accesscontrol

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
)

func TestReceiverAccess(t *testing.T) {
	recv1 := models.ReceiverGen(models.ReceiverMuts.WithName("test receiver 1"), models.ReceiverMuts.WithValidIntegration("slack"))()
	recv2 := models.ReceiverGen(models.ReceiverMuts.WithName("test receiver 2"), models.ReceiverMuts.WithValidIntegration("email"))()
	recv3 := models.ReceiverGen(models.ReceiverMuts.WithName("test receiver 3"), models.ReceiverMuts.WithValidIntegration("webhook"))()

	allReceivers := []*models.Receiver{
		&recv1,
		&recv2,
		&recv3,
	}

	permissions := func(perms ...models.ReceiverPermission) models.ReceiverPermissionSet {
		set := models.NewReceiverPermissionSet()
		for _, v := range models.ReceiverPermissions() {
			set.Set(v, false)
		}
		for _, v := range perms {
			set.Set(v, true)
		}
		return set
	}

	testCases := []struct {
		name                     string
		user                     identity.Requester
		expected                 map[string]models.ReceiverPermissionSet
		expectedWithProvisioning map[string]models.ReceiverPermissionSet
	}{
		// Legacy read.
		{
			name: "legacy global reader should have no elevated permissions",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingNotificationsRead}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
		},
		{
			name: "legacy global notifications provisioning reader should have no elevated permissions",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingNotificationsProvisioningRead}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
		},
		{
			name: "legacy global provisioning reader should have no elevated permissions",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingProvisioningRead}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
		},
		{
			name: "legacy global provisioning secret reader should have secret permissions on provisioning only",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingProvisioningReadSecrets}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
			expectedWithProvisioning: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionReadSecret),
				recv2.UID: permissions(models.ReceiverPermissionReadSecret),
				recv3.UID: permissions(models.ReceiverPermissionReadSecret),
			},
		},
		// Receiver read.
		{
			name: "global receiver reader should have no elevated permissions",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingReceiversRead, Scope: ScopeReceiversAll}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
		},
		{
			name: "global receiver secret reader should have secret permissions",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingReceiversReadSecrets, Scope: ScopeReceiversAll}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionReadSecret),
				recv2.UID: permissions(models.ReceiverPermissionReadSecret),
				recv3.UID: permissions(models.ReceiverPermissionReadSecret),
			},
		},
		{
			name: "per-receiver secret reader should have per-receiver",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingReceiversReadSecrets, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversReadSecrets, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionReadSecret),
				recv2.UID: permissions(),
				recv3.UID: permissions(models.ReceiverPermissionReadSecret),
			},
		},
		// Legacy write.
		{
			name: "legacy global writer should have full write",
			user: newViewUser(ac.Permission{Action: ac.ActionAlertingNotificationsWrite}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
				recv2.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
				recv3.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
			},
		},
		{
			name: "legacy writers should require read",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingNotificationsWrite}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
		},
		//{
		//	name: "legacy global notifications provisioning writer should have full write on provisioning only",
		//	user: newViewUser(ac.Permission{Action: ac.ActionAlertingNotificationsProvisioningWrite}),
		//	expected: map[string]models.ReceiverPermissionSet{
		//		recv1.UID: permissions(),
		//		recv2.UID: permissions(),
		//		recv3.UID: permissions(),
		//	},
		//	expectedWithProvisioning: map[string]models.ReceiverPermissionSet{
		//		recv1.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
		//		recv2.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
		//		recv3.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
		//	},
		//},
		//{
		//	name: "legacy global provisioning writer should have full write on provisioning only",
		//	user: newViewUser(ac.Permission{Action: ac.ActionAlertingProvisioningWrite}),
		//	expected: map[string]models.ReceiverPermissionSet{
		//		recv1.UID: permissions(),
		//		recv2.UID: permissions(),
		//		recv3.UID: permissions(),
		//	},
		//	expectedWithProvisioning: map[string]models.ReceiverPermissionSet{
		//		recv1.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
		//		recv2.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
		//		recv3.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
		//	},
		//},
		// Receiver create
		{
			name: "receiver create should not have write",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingReceiversCreate}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
		},
		// Receiver update.
		{
			name: "global receiver update should have write but no delete",
			user: newViewUser(ac.Permission{Action: ac.ActionAlertingReceiversUpdate, Scope: ScopeReceiversAll}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionWrite),
				recv2.UID: permissions(models.ReceiverPermissionWrite),
				recv3.UID: permissions(models.ReceiverPermissionWrite),
			},
		},
		{
			name: "per-receiver update should have per-receiver write but no delete",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingReceiversUpdate, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversUpdate, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionWrite),
				recv2.UID: permissions(),
				recv3.UID: permissions(models.ReceiverPermissionWrite),
			},
		},
		{
			name: "per-receiver update should require read",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingReceiversUpdate, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversUpdate, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
		},
		// Receiver delete.
		{
			name: "global receiver delete should have delete but no write",
			user: newViewUser(ac.Permission{Action: ac.ActionAlertingReceiversDelete, Scope: ScopeReceiversAll}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionDelete),
				recv2.UID: permissions(models.ReceiverPermissionDelete),
				recv3.UID: permissions(models.ReceiverPermissionDelete),
			},
		},
		{
			name: "per-receiver delete should have per-receiver delete but no write",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingReceiversDelete, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversDelete, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionDelete),
				recv2.UID: permissions(),
				recv3.UID: permissions(models.ReceiverPermissionDelete),
			},
		},
		{
			name: "per-receiver delete should require read",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingReceiversDelete, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversDelete, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
		},
		// Receiver admin.
		{
			name: "receiver read permissions alone can't admin",
			user: newViewUser(ac.Permission{Action: ac.ActionAlertingReceiversPermissionsRead, Scope: ScopeReceiversAll}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
		},
		{
			name: "receiver write permissions alone can't admin",
			user: newViewUser(ac.Permission{Action: ac.ActionAlertingReceiversPermissionsWrite, Scope: ScopeReceiversAll}),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
		},
		{
			name: "global receiver read + write permissions can admin",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingReceiversPermissionsRead, Scope: ScopeReceiversAll},
				ac.Permission{Action: ac.ActionAlertingReceiversPermissionsWrite, Scope: ScopeReceiversAll},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionAdmin),
				recv2.UID: permissions(models.ReceiverPermissionAdmin),
				recv3.UID: permissions(models.ReceiverPermissionAdmin),
			},
		},
		{
			name: "per-receiver read + write permissions should have per-receiver admin",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingReceiversPermissionsRead, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversPermissionsWrite, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversPermissionsRead, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversPermissionsWrite, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionAdmin),
				recv2.UID: permissions(),
				recv3.UID: permissions(models.ReceiverPermissionAdmin),
			},
		},
		{
			name: "per-receiver admin should require read",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingReceiversPermissionsRead, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversPermissionsWrite, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversPermissionsRead, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversPermissionsWrite, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(),
				recv3.UID: permissions(),
			},
		},
		// Mixed permissions.
		{
			name: "legacy provisioning secret read, receiver write",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingProvisioningReadSecrets},
				ac.Permission{Action: ac.ActionAlertingReceiversUpdate, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv2.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(models.ReceiverPermissionWrite),
				recv3.UID: permissions(),
			},
			expectedWithProvisioning: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionReadSecret),
				recv2.UID: permissions(models.ReceiverPermissionReadSecret, models.ReceiverPermissionWrite),
				recv3.UID: permissions(models.ReceiverPermissionReadSecret),
			},
		},
		{
			name: "legacy provisioning secret read, receiver delete",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingProvisioningReadSecrets},
				ac.Permission{Action: ac.ActionAlertingReceiversDelete, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv2.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(),
				recv2.UID: permissions(models.ReceiverPermissionDelete),
				recv3.UID: permissions(),
			},
			expectedWithProvisioning: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionReadSecret),
				recv2.UID: permissions(models.ReceiverPermissionReadSecret, models.ReceiverPermissionDelete),
				recv3.UID: permissions(models.ReceiverPermissionReadSecret),
			},
		},
		{
			name: "legacy write, receiver secret",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingNotificationsWrite},
				ac.Permission{Action: ac.ActionAlertingReceiversReadSecrets, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv2.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
				recv2.UID: permissions(models.ReceiverPermissionReadSecret, models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
				recv3.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
			},
		},
		{
			name: "mixed secret / delete / write",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingReceiversReadSecrets, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversReadSecrets, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversUpdate, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversUpdate, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv2.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversDelete, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv2.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversDelete, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionReadSecret, models.ReceiverPermissionWrite),
				recv2.UID: permissions(models.ReceiverPermissionWrite, models.ReceiverPermissionDelete),
				recv3.UID: permissions(models.ReceiverPermissionReadSecret, models.ReceiverPermissionDelete),
			},
		},
		{
			name: "mixed requires read",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingReceiversReadSecrets, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversReadSecrets, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversUpdate, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv1.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversUpdate, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv2.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversDelete, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv2.UID)},
				ac.Permission{Action: ac.ActionAlertingReceiversDelete, Scope: ScopeReceiversProvider.GetResourceScopeUID(recv3.UID)},
			),
			expected: map[string]models.ReceiverPermissionSet{
				recv1.UID: permissions(models.ReceiverPermissionReadSecret, models.ReceiverPermissionWrite),
				recv2.UID: permissions(),
				recv3.UID: permissions(models.ReceiverPermissionReadSecret, models.ReceiverPermissionDelete),
			},
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			svc := NewReceiverAccess[*models.Receiver](&recordingAccessControlFake{}, false)

			actual, err := svc.Access(context.Background(), testCase.user, allReceivers...)

			assert.NoError(t, err)
			assert.Equalf(t, testCase.expected, actual, "expected: %v, actual: %v", testCase.expected, actual)

			provisioningPerms := testCase.expected
			if testCase.expectedWithProvisioning != nil {
				provisioningPerms = testCase.expectedWithProvisioning
			}
			svc = NewReceiverAccess[*models.Receiver](&recordingAccessControlFake{}, true)
			actual, err = svc.Access(context.Background(), testCase.user, allReceivers...)
			assert.NoError(t, err)
			assert.Equalf(t, provisioningPerms, actual, "expectedWithProvisioning: %v, actual: %v", provisioningPerms, actual)
		})
	}
}

func newEmptyUser(permissions ...ac.Permission) identity.Requester {
	return ac.BackgroundUser("test", orgID, org.RoleNone, permissions)
}

func newViewUser(permissions ...ac.Permission) identity.Requester {
	return ac.BackgroundUser("test", orgID, org.RoleNone, append([]ac.Permission{
		{Action: ac.ActionAlertingReceiversRead, Scope: ScopeReceiversAll},
		{Action: ac.ActionAlertingNotificationsRead},
	}, permissions...))
}
