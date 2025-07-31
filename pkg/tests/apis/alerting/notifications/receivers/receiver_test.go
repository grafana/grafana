package receivers

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"path"
	"slices"
	"sort"
	"strings"
	"testing"

	"github.com/grafana/alerting/notify"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/routingtree"

	test_common "github.com/grafana/grafana/pkg/tests/apis/alerting/notifications/common"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	alertingac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

//go:embed test-data/*.*
var testData embed.FS

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{})
}

func TestIntegrationResourceIdentifier(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)
	client := test_common.NewReceiverClient(t, helper.Org1.Admin)
	newResource := &v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title:        "Test-Receiver",
			Integrations: []v0alpha1.ReceiverIntegration{},
		},
	}

	t.Run("create should fail if object name is specified", func(t *testing.T) {
		resource := newResource.Copy().(*v0alpha1.Receiver)
		resource.Name = "new-receiver"
		_, err := client.Create(ctx, resource, v1.CreateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest but got %s", err)
	})

	var resourceID string
	t.Run("create should succeed and provide resource name", func(t *testing.T) {
		actual, err := client.Create(ctx, newResource, v1.CreateOptions{})
		require.NoError(t, err)
		require.NotEmptyf(t, actual.Name, "Resource name should not be empty")
		require.NotEmptyf(t, actual.UID, "Resource UID should not be empty")
		resourceID = actual.Name
	})

	t.Run("resource should be available by the identifier", func(t *testing.T) {
		actual, err := client.Get(ctx, resourceID, v1.GetOptions{})
		require.NoError(t, err)
		require.NotEmptyf(t, actual.Name, "Resource name should not be empty")
		require.Equal(t, newResource.Spec, actual.Spec)
	})

	t.Run("update should rename receiver if name in the specification changes", func(t *testing.T) {
		existing, err := client.Get(ctx, resourceID, v1.GetOptions{})
		require.NoError(t, err)

		updated := existing.Copy().(*v0alpha1.Receiver)
		updated.Spec.Title = "another-newReceiver"

		actual, err := client.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, updated.Spec, actual.Spec)
		require.NotEqualf(t, updated.Name, actual.Name, "Update should change the resource name but it didn't")
		require.NotEqualf(t, updated.ResourceVersion, actual.ResourceVersion, "Update should change the resource version but it didn't")

		resource, err := client.Get(ctx, actual.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, actual.Spec, resource.Spec)
		require.Equal(t, actual.Name, resource.Name)
		require.Equal(t, actual.ResourceVersion, resource.ResourceVersion)
	})
}

// TestIntegrationResourcePermissions focuses on testing resource permissions for the alerting receiver resource. It
// verifies that access is correctly set when creating resources and assigning permissions to users, teams, and roles.
func TestIntegrationResourcePermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	org1 := helper.Org1

	noneUser := helper.CreateUser("none", apis.Org1, org.RoleNone, nil)

	creator := helper.CreateUser("creator", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(
			accesscontrol.ActionAlertingReceiversCreate,
		),
	})

	admin := org1.Admin
	viewer := org1.Viewer
	editor := org1.Editor
	adminClient := test_common.NewReceiverClient(t, admin)

	writeACMetadata := []string{"canWrite", "canDelete"}
	allACMetadata := []string{"canWrite", "canDelete", "canReadSecrets", "canAdmin"}

	mustID := func(user apis.User) int64 {
		id, err := user.Identity.GetInternalID()
		require.NoError(t, err)
		return id
	}

	for _, tc := range []struct {
		name          string
		creatingUser  apis.User
		testUser      apis.User
		assignments   []accesscontrol.SetResourcePermissionCommand
		expACMetadata []string
		expRead       bool
	}{
		// Basic access.
		{
			name:          "Admin creates and has all metadata and access",
			creatingUser:  admin,
			testUser:      admin,
			assignments:   nil,
			expACMetadata: allACMetadata,
			expRead:       true,
		},
		{
			name:          "Creator creates and has all metadata and access",
			creatingUser:  creator,
			testUser:      creator,
			assignments:   nil,
			expACMetadata: allACMetadata,
			expRead:       true,
		},
		{
			name:          "Admin creates, noneUser has no metadata and no access",
			creatingUser:  admin,
			testUser:      noneUser,
			assignments:   nil,
			expACMetadata: nil,
			expRead:       false,
		},
		{
			name:          "Admin creates, viewer has no metadata but has access",
			creatingUser:  admin,
			testUser:      viewer,
			expACMetadata: nil,
			expRead:       true,
		},
		{
			name:          "Admin creates, editor has write metadata and access",
			creatingUser:  admin,
			testUser:      editor,
			expACMetadata: writeACMetadata,
			expRead:       true,
		},
		// User-based assignments.
		{
			name:          "Admin creates, assigns read, noneUser has no metadata but has access",
			creatingUser:  admin,
			testUser:      noneUser,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(noneUser), Permission: string(alertingac.ReceiverPermissionView)}},
			expACMetadata: nil,
			expRead:       true,
		},
		{
			name:          "Admin creates, assigns write, noneUser has write metadata and access",
			creatingUser:  admin,
			testUser:      noneUser,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(noneUser), Permission: string(alertingac.ReceiverPermissionEdit)}},
			expACMetadata: writeACMetadata,
			expRead:       true,
		},
		{
			name:          "Admin creates, assigns admin, noneUser has all metadata and access",
			creatingUser:  admin,
			testUser:      noneUser,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(noneUser), Permission: string(alertingac.ReceiverPermissionAdmin)}},
			expACMetadata: allACMetadata,
			expRead:       true,
		},
		// Other users don't get assignments.
		{
			name:          "Admin creates, assigns read to noneUser, creator has no metadata and no access",
			creatingUser:  admin,
			testUser:      creator,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(noneUser), Permission: string(alertingac.ReceiverPermissionView)}},
			expACMetadata: nil,
			expRead:       false,
		},
		{
			name:          "Admin creates, assigns write to noneUser, creator has no metadata and no access",
			creatingUser:  admin,
			testUser:      creator,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(noneUser), Permission: string(alertingac.ReceiverPermissionEdit)}},
			expACMetadata: nil,
			expRead:       false,
		},
		{
			name:          "Admin creates, assigns admin to noneUser, creator has no metadata and no access",
			creatingUser:  admin,
			testUser:      creator,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(noneUser), Permission: string(alertingac.ReceiverPermissionAdmin)}},
			expACMetadata: nil,
			expRead:       false,
		},
		// Role-based access.
		{
			name:          "Admin creates, assigns editor, viewer has write metadata and access",
			creatingUser:  admin,
			testUser:      viewer,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(viewer), Permission: string(alertingac.ReceiverPermissionEdit)}},
			expACMetadata: writeACMetadata,
			expRead:       true,
		},
		{
			name:          "Admin creates, assigns admin, viewer has all metadata and access",
			creatingUser:  admin,
			testUser:      viewer,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(viewer), Permission: string(alertingac.ReceiverPermissionAdmin)}},
			expACMetadata: allACMetadata,
			expRead:       true,
		},
		{
			name:          "Admin creates, assigns admin, editor has all metadata and access",
			creatingUser:  admin,
			testUser:      editor,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(editor), Permission: string(alertingac.ReceiverPermissionAdmin)}},
			expACMetadata: allACMetadata,
			expRead:       true,
		},
		// Team-based access. Staff team has editor+admin but not viewer in it.
		{
			name:          "Admin creates, assigns admin to staff, viewer has no metadata and access",
			creatingUser:  admin,
			testUser:      viewer,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{TeamID: org1.Staff.ID, Permission: string(alertingac.ReceiverPermissionAdmin)}},
			expACMetadata: nil,
			expRead:       true,
		},
		{
			name:          "Admin creates, assigns admin to staff, editor has all metadata and access",
			creatingUser:  admin,
			testUser:      editor,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{TeamID: org1.Staff.ID, Permission: string(alertingac.ReceiverPermissionAdmin)}},
			expACMetadata: allACMetadata,
			expRead:       true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			createClient := test_common.NewReceiverClient(t, tc.creatingUser)
			client := test_common.NewReceiverClient(t, tc.testUser)

			created := &v0alpha1.Receiver{
				ObjectMeta: v1.ObjectMeta{
					Namespace: "default",
				},
				Spec: v0alpha1.ReceiverSpec{
					Title:        "receiver-1",
					Integrations: []v0alpha1.ReceiverIntegration{},
				},
			}
			d, err := json.Marshal(created)
			require.NoError(t, err)

			// Create receiver with creatingUser
			created, err = createClient.Create(ctx, created, v1.CreateOptions{})
			require.NoErrorf(t, err, "Payload %s", string(d))
			require.NotNil(t, created)

			defer func() {
				_ = adminClient.Delete(ctx, created.Name, v1.DeleteOptions{})
			}()

			// Assign resource permissions
			cliCfg := helper.Org1.Admin.NewRestConfig()
			alertingApi := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)
			for _, permission := range tc.assignments {
				status, body := alertingApi.AssignReceiverPermission(t, created.Name, permission)
				require.Equalf(t, http.StatusOK, status, "Expected status 200 but got %d: %s", status, body)
			}

			// Test read
			if tc.expRead {
				// Helper methods.
				extractReceiverFromList := func(list *v0alpha1.ReceiverList, name string) *v0alpha1.Receiver {
					for i := range list.Items {
						if list.Items[i].Name == name {
							return list.Items[i].Copy().(*v0alpha1.Receiver)
						}
					}
					return nil
				}

				// Obtain expected responses using admin client as source of truth.
				expectedGetWithMetadata, expectedListWithMetadata := func() (*v0alpha1.Receiver, *v0alpha1.Receiver) {
					expectedGet, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
					require.NoError(t, err)
					require.NotNil(t, expectedGet)

					// Set expected metadata.
					expectedGetWithMetadata := expectedGet.Copy().(*v0alpha1.Receiver)
					// Clear any existing access control metadata.
					for _, k := range allACMetadata {
						delete(expectedGetWithMetadata.Annotations, v0alpha1.AccessControlAnnotation(k))
					}
					for _, ac := range tc.expACMetadata {
						expectedGetWithMetadata.SetAccessControl(ac)
					}

					expectedList, err := adminClient.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					expectedListWithMetadata := extractReceiverFromList(expectedList, created.Name)
					require.NotNil(t, expectedListWithMetadata)
					expectedListWithMetadata = expectedListWithMetadata.Copy().(*v0alpha1.Receiver)
					// Clear any existing access control metadata.
					for _, k := range allACMetadata {
						delete(expectedListWithMetadata.Annotations, v0alpha1.AccessControlAnnotation(k))
					}
					for _, ac := range tc.expACMetadata {
						expectedListWithMetadata.SetAccessControl(ac)
					}
					return expectedGetWithMetadata, expectedListWithMetadata
				}()

				t.Run("should be able to list receivers", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					listedReceiver := extractReceiverFromList(list, created.Name)
					assert.Equalf(t, expectedListWithMetadata, listedReceiver, "Expected %v but got %v", expectedListWithMetadata, listedReceiver)
				})

				t.Run("should be able to read receiver by resource identifier", func(t *testing.T) {
					got, err := client.Get(ctx, expectedGetWithMetadata.Name, v1.GetOptions{})
					require.NoError(t, err)
					assert.Equalf(t, expectedGetWithMetadata, got, "Expected %v but got %v", expectedGetWithMetadata, got)
				})
			} else {
				t.Run("list receivers should be empty", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Emptyf(t, list.Items, "Expected no receivers but got %v", list.Items)
				})

				t.Run("should be forbidden to read receiver by name", func(t *testing.T) {
					_, err := client.Get(ctx, created.Name, v1.GetOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
				})
			}
		})
	}
}

func TestIntegrationAccessControl(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	org1 := helper.Org1

	type testCase struct {
		user           apis.User
		canRead        bool
		canUpdate      bool
		canCreate      bool
		canDelete      bool
		canReadSecrets bool
		canAdmin       bool
	}
	// region users
	unauthorized := helper.CreateUser("unauthorized", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{})

	reader := helper.CreateUser("reader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(accesscontrol.ActionAlertingReceiversRead),
	})
	secretsReader := helper.CreateUser("secretsReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(accesscontrol.ActionAlertingReceiversReadSecrets),
	})
	creator := helper.CreateUser("creator", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(
			accesscontrol.ActionAlertingReceiversRead,
			accesscontrol.ActionAlertingReceiversCreate,
		),
	})
	updater := helper.CreateUser("updater", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(
			accesscontrol.ActionAlertingReceiversRead,
			accesscontrol.ActionAlertingReceiversUpdate,
		),
	})
	deleter := helper.CreateUser("deleter", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(
			accesscontrol.ActionAlertingReceiversRead,
			accesscontrol.ActionAlertingReceiversDelete,
		),
	})
	legacyReader := helper.CreateUser("legacyReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsRead,
			},
		},
	})
	legacyWriter := helper.CreateUser("legacyWriter", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsRead,
				accesscontrol.ActionAlertingNotificationsWrite,
			},
		},
	})
	adminLikeUser := helper.CreateUser("adminLikeUser", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(append(
			[]string{accesscontrol.ActionAlertingReceiversCreate},
			ossaccesscontrol.ReceiversAdminActions...,
		)...),
	})

	// Test receivers with uids longer than 40 characters. User name is used in receiver name.
	adminLikeUserLongName := helper.CreateUser("adminLikeUserCreatingAReallyLongReceiverName", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(append(
			[]string{accesscontrol.ActionAlertingReceiversCreate},
			ossaccesscontrol.ReceiversAdminActions...,
		)...),
	})

	// endregion

	testCases := []testCase{
		{
			user:      unauthorized,
			canRead:   false,
			canUpdate: false,
			canCreate: false,
			canDelete: false,
		},
		{
			user:           org1.Admin,
			canRead:        true,
			canCreate:      true,
			canUpdate:      true,
			canDelete:      true,
			canAdmin:       true,
			canReadSecrets: true,
		},
		{
			user:      org1.Editor,
			canRead:   true,
			canUpdate: true,
			canCreate: true,
			canDelete: true,
		},
		{
			user:    org1.Viewer,
			canRead: true,
		},
		{
			user:    reader,
			canRead: true,
		},
		{
			user:           secretsReader,
			canRead:        true,
			canReadSecrets: true,
		},
		{
			user:      creator,
			canRead:   true,
			canCreate: true,
		},
		{
			user:      updater,
			canRead:   true,
			canUpdate: true,
		},
		{
			user:      deleter,
			canRead:   true,
			canDelete: true,
		},
		{
			user:    legacyReader,
			canRead: true,
		},
		{
			user:      legacyWriter,
			canRead:   true,
			canCreate: true,
			canUpdate: true,
			canDelete: true,
		},
		{
			user:           adminLikeUser,
			canRead:        true,
			canCreate:      true,
			canUpdate:      true,
			canDelete:      true,
			canAdmin:       true,
			canReadSecrets: true,
		},
		{
			user:           adminLikeUserLongName,
			canRead:        true,
			canCreate:      true,
			canUpdate:      true,
			canDelete:      true,
			canAdmin:       true,
			canReadSecrets: true,
		},
	}

	adminClient := test_common.NewReceiverClient(t, helper.Org1.Admin)
	for _, tc := range testCases {
		t.Run(fmt.Sprintf("user '%s'", tc.user.Identity.GetLogin()), func(t *testing.T) {
			client := test_common.NewReceiverClient(t, tc.user)

			expected := &v0alpha1.Receiver{
				ObjectMeta: v1.ObjectMeta{
					Namespace: "default",
				},
				Spec: v0alpha1.ReceiverSpec{
					Title:        fmt.Sprintf("receiver-1-%s", tc.user.Identity.GetLogin()),
					Integrations: []v0alpha1.ReceiverIntegration{},
				},
			}
			d, err := json.Marshal(expected)
			require.NoError(t, err)

			newReceiver := expected.Copy().(*v0alpha1.Receiver)
			newReceiver.Spec.Title = fmt.Sprintf("receiver-2-%s", tc.user.Identity.GetLogin())
			if tc.canCreate {
				t.Run("should be able to create receiver", func(t *testing.T) {
					actual, err := client.Create(ctx, newReceiver, v1.CreateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))

					require.Equal(t, newReceiver.Spec, actual.Spec)

					t.Run("should fail if already exists", func(t *testing.T) {
						_, err := client.Create(ctx, newReceiver, v1.CreateOptions{})
						require.Truef(t, errors.IsConflict(err), "expected  bad request but got %s", err)
					})

					// Cleanup.
					require.NoError(t, adminClient.Delete(ctx, actual.Name, v1.DeleteOptions{}))
				})
			} else {
				t.Run("should be forbidden to create", func(t *testing.T) {
					_, err := client.Create(ctx, newReceiver, v1.CreateOptions{})
					require.Truef(t, errors.IsForbidden(err), "Payload %s", string(d))
				})
			}

			// create resource to proceed with other tests. We don't use the one created above because the user will always
			// have admin permissions on it.
			expected, err = adminClient.Create(ctx, expected, v1.CreateOptions{})
			require.NoErrorf(t, err, "Payload %s", string(d))
			require.NotNil(t, expected)

			if tc.canRead {
				// Set expected metadata.
				expectedWithMetadata := expected.Copy().(*v0alpha1.Receiver)
				expectedWithMetadata.SetInUse(0, nil)
				if tc.canUpdate {
					expectedWithMetadata.SetAccessControl("canWrite")
				}
				if tc.canDelete {
					expectedWithMetadata.SetAccessControl("canDelete")
				}
				if tc.canReadSecrets {
					expectedWithMetadata.SetAccessControl("canReadSecrets")
				}
				if tc.canAdmin {
					expectedWithMetadata.SetAccessControl("canAdmin")
				}
				t.Run("should be able to list receivers", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 2) // default + created
				})

				t.Run("should be able to read receiver by resource identifier", func(t *testing.T) {
					got, err := client.Get(ctx, expected.Name, v1.GetOptions{})
					require.NoError(t, err)
					require.Equal(t, expectedWithMetadata, got)

					t.Run("should get NotFound if resource does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, "Notfound", v1.GetOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("list receivers should be empty", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Emptyf(t, list.Items, "Expected no receivers but got %v", list.Items)
				})

				t.Run("should be forbidden to read receiver by name", func(t *testing.T) {
					_, err := client.Get(ctx, expected.Name, v1.GetOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if name does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, "Notfound", v1.GetOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			updatedExpected := expected.Copy().(*v0alpha1.Receiver)
			updatedExpected.Spec.Integrations = append(updatedExpected.Spec.Integrations, createIntegration(t, "email"))

			d, err = json.Marshal(updatedExpected)
			require.NoError(t, err)

			if tc.canUpdate {
				t.Run("should be able to update receiver", func(t *testing.T) {
					updated, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))

					expected = updated

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						up := updatedExpected.Copy().(*v0alpha1.Receiver)
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to update receiver", func(t *testing.T) {
					_, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if resource does not exist", func(t *testing.T) {
						up := updatedExpected.Copy().(*v0alpha1.Receiver)
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			deleteOptions := v1.DeleteOptions{Preconditions: &v1.Preconditions{ResourceVersion: util.Pointer(expected.ResourceVersion)}}

			if tc.canDelete {
				t.Run("should be able to delete receiver", func(t *testing.T) {
					err := client.Delete(ctx, expected.Name, deleteOptions)
					require.NoError(t, err)

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						err := client.Delete(ctx, "notfound", v1.DeleteOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to delete receiver", func(t *testing.T) {
					err := client.Delete(ctx, expected.Name, deleteOptions)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should be forbidden even if resource does not exist", func(t *testing.T) {
						err := client.Delete(ctx, "notfound", v1.DeleteOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
				require.NoError(t, adminClient.Delete(ctx, expected.Name, v1.DeleteOptions{}))
			}

			if tc.canRead {
				t.Run("should get empty list if no receivers", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 1)
				})
			}
		})
	}
}

func TestIntegrationInUseMetadata(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	cliCfg := helper.Org1.Admin.NewRestConfig()
	legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	adminClient := test_common.NewReceiverClient(t, helper.Org1.Admin)
	// Prepare environment and create notification policy and rule that use receiver
	alertmanagerRaw, err := testData.ReadFile(path.Join("test-data", "notification-settings.json"))
	require.NoError(t, err)
	var amConfig definitions.PostableUserConfig
	require.NoError(t, json.Unmarshal(alertmanagerRaw, &amConfig))

	// Add more references to the receiver in other routes.
	route1 := *amConfig.AlertmanagerConfig.Route.Routes[0]
	route1.Routes = nil
	route2 := route1
	parentRoute := *amConfig.AlertmanagerConfig.Route.Routes[0]
	parentRoute.Routes = []*definitions.Route{&route1, &route2}
	amConfig.AlertmanagerConfig.Route.Routes = append(amConfig.AlertmanagerConfig.Route.Routes, &parentRoute)

	persistInitialConfig(t, amConfig)

	postGroupRaw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1.json"))
	require.NoError(t, err)
	var ruleGroup definitions.PostableRuleGroupConfig
	require.NoError(t, json.Unmarshal(postGroupRaw, &ruleGroup))

	// Add more references to the receiver by creating adding same rule with a different title.
	ruleGen := func() definitions.PostableGrafanaRule { return *ruleGroup.Rules[0].GrafanaManagedAlert }
	rule2 := ruleGen()
	rule2.Title = "Rule2"
	rule2.NotificationSettings = &definitions.AlertRuleNotificationSettings{Receiver: "grafana-default-email"}
	rule3 := ruleGen()
	rule3.Title = "Rule3"
	ruleGroup.Rules = append(ruleGroup.Rules,
		definitions.PostableExtendedRuleNode{
			ApiRuleNode:         ruleGroup.Rules[0].ApiRuleNode,
			GrafanaManagedAlert: &rule2,
		},
		definitions.PostableExtendedRuleNode{
			ApiRuleNode:         ruleGroup.Rules[0].ApiRuleNode,
			GrafanaManagedAlert: &rule3,
		},
	)

	folderUID := "test-folder"
	legacyCli.CreateFolder(t, folderUID, "TEST")
	_, status, data := legacyCli.PostRulesGroupWithStatus(t, folderUID, &ruleGroup, false)
	require.Equalf(t, http.StatusAccepted, status, "Failed to post Rule: %s", data)

	requestReceivers := func(t *testing.T, title string) (v0alpha1.Receiver, v0alpha1.Receiver) {
		t.Helper()
		receivers, err := adminClient.List(ctx, v1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, receivers.Items, 2)
		idx := slices.IndexFunc(receivers.Items, func(interval v0alpha1.Receiver) bool {
			return interval.Spec.Title == title
		})
		receiverListed := receivers.Items[idx]

		receiverGet, err := adminClient.Get(ctx, receiverListed.Name, v1.GetOptions{})
		require.NoError(t, err)

		return receiverListed, *receiverGet
	}

	checkInUse := func(t *testing.T, receiverList, receiverGet v0alpha1.Receiver, routes, rules int) {
		t.Helper()
		assert.Equalf(t, fmt.Sprintf("%d", routes), receiverList.Annotations[v0alpha1.InUseAnnotation("routes")], "LIST: Expected %s used by %d routes", receiverList.Spec.Title, routes)
		assert.Equalf(t, fmt.Sprintf("%d", rules), receiverList.Annotations[v0alpha1.InUseAnnotation("rules")], "LIST: Expected %s used by %d rules", receiverList.Spec.Title, rules)
		assert.Equalf(t, fmt.Sprintf("%d", routes), receiverGet.Annotations[v0alpha1.InUseAnnotation("routes")], "GET: Expected %s used by %d routes", receiverGet.Spec.Title, routes)
		assert.Equalf(t, fmt.Sprintf("%d", rules), receiverGet.Annotations[v0alpha1.InUseAnnotation("rules")], "GET: Expected %s used by %d rules", receiverGet.Spec.Title, rules)
	}

	receiverListed, receiverGet := requestReceivers(t, "user-defined")
	checkInUse(t, receiverListed, receiverGet, 4, 2)

	// Verify the default.
	receiverListed, receiverGet = requestReceivers(t, "grafana-default-email")
	checkInUse(t, receiverListed, receiverGet, 1, 1)

	// Removing the new extra route should leave only 1.
	amConfig.AlertmanagerConfig.Route.Routes = amConfig.AlertmanagerConfig.Route.Routes[:1]
	v1Route, err := routingtree.ConvertToK8sResource(helper.Org1.AdminServiceAccount.OrgId, *amConfig.AlertmanagerConfig.Route, "", func(int64) string { return "default" })
	require.NoError(t, err)
	routeAdminClient := test_common.NewRoutingTreeClient(t, helper.Org1.Admin)
	_, err = routeAdminClient.Update(ctx, v1Route, v1.UpdateOptions{})
	require.NoError(t, err)

	receiverListed, receiverGet = requestReceivers(t, "user-defined")
	checkInUse(t, receiverListed, receiverGet, 1, 2)

	// Remove the extra rules.
	ruleGroup.Rules = ruleGroup.Rules[:1]
	_, status, data = legacyCli.PostRulesGroupWithStatus(t, folderUID, &ruleGroup, false)
	require.Equalf(t, http.StatusAccepted, status, "Failed to post Rule: %s", data)

	receiverListed, receiverGet = requestReceivers(t, "user-defined")
	checkInUse(t, receiverListed, receiverGet, 1, 1)

	receiverListed, receiverGet = requestReceivers(t, "grafana-default-email")
	checkInUse(t, receiverListed, receiverGet, 1, 0)

	// Remove the remaining routes.
	amConfig.AlertmanagerConfig.Route.Routes = nil
	v1route, err := routingtree.ConvertToK8sResource(1, *amConfig.AlertmanagerConfig.Route, "", func(int64) string { return "default" })
	require.NoError(t, err)
	_, err = routeAdminClient.Update(ctx, v1route, v1.UpdateOptions{})
	require.NoError(t, err)

	// Remove the remaining rules.
	ruleGroup.Rules = nil
	_, status, data = legacyCli.PostRulesGroupWithStatus(t, folderUID, &ruleGroup, false)
	require.Equalf(t, http.StatusAccepted, status, "Failed to post Rule: %s", data)

	receiverListed, receiverGet = requestReceivers(t, "user-defined")
	checkInUse(t, receiverListed, receiverGet, 0, 0)

	receiverListed, receiverGet = requestReceivers(t, "grafana-default-email")
	checkInUse(t, receiverListed, receiverGet, 1, 0)
}

func TestIntegrationProvisioning(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	org := helper.Org1

	admin := org.Admin
	adminClient := test_common.NewReceiverClient(t, helper.Org1.Admin)
	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles)
	db, err := store.ProvideDBStore(env.SettingsProvider, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac, bus.ProvideBus(tracing.InitializeTracerForTest()))
	require.NoError(t, err)

	created, err := adminClient.Create(ctx, &v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title: "test-receiver-1",
			Integrations: []v0alpha1.ReceiverIntegration{
				createIntegration(t, "email"),
			},
		},
	}, v1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "none", created.GetProvenanceStatus())

	t.Run("should provide provenance status", func(t *testing.T) {
		require.NoError(t, db.SetProvenance(ctx, &definitions.EmbeddedContactPoint{
			UID: *created.Spec.Integrations[0].Uid,
		}, admin.Identity.GetOrgID(), "API"))

		got, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "API", got.GetProvenanceStatus())
	})

	t.Run("should not let update if provisioned", func(t *testing.T) {
		got, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)
		updated := got.Copy().(*v0alpha1.Receiver)
		updated.Spec.Integrations = append(updated.Spec.Integrations, createIntegration(t, "email"))

		_, err = adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})

	t.Run("should not let delete if provisioned", func(t *testing.T) {
		err := adminClient.Delete(ctx, created.Name, v1.DeleteOptions{})
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})
}

func TestIntegrationOptimisticConcurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminClient := test_common.NewReceiverClient(t, helper.Org1.Admin)
	receiver := v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title:        "receiver-1",
			Integrations: []v0alpha1.ReceiverIntegration{},
		},
	}

	created, err := adminClient.Create(ctx, &receiver, v1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)
	require.NotEmpty(t, created.ResourceVersion)

	t.Run("should forbid if version does not match", func(t *testing.T) {
		updated := created.Copy().(*v0alpha1.Receiver)
		updated.ResourceVersion = "test"
		_, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err)
	})
	t.Run("should update if version matches", func(t *testing.T) {
		updated := created.Copy().(*v0alpha1.Receiver)
		updated.Spec.Integrations = append(updated.Spec.Integrations, createIntegration(t, "email"))
		actualUpdated, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		for i, integration := range actualUpdated.Spec.Integrations {
			updated.Spec.Integrations[i].Uid = integration.Uid
		}
		require.EqualValues(t, updated.Spec, actualUpdated.Spec)
		require.NotEqual(t, updated.ResourceVersion, actualUpdated.ResourceVersion)
	})
	t.Run("should fail to update if version is empty", func(t *testing.T) {
		updated := created.Copy().(*v0alpha1.Receiver)
		updated.ResourceVersion = ""
		updated.Spec.Integrations = append(updated.Spec.Integrations, createIntegration(t, "webhook"))
		_, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err) // TODO Change that? K8s returns 400 instead.
	})
	t.Run("should fail to delete if version does not match", func(t *testing.T) {
		actual, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)

		err = adminClient.Delete(ctx, actual.Name, v1.DeleteOptions{
			Preconditions: &v1.Preconditions{
				ResourceVersion: util.Pointer("something"),
			},
		})
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err)
	})
	t.Run("should succeed if version matches", func(t *testing.T) {
		actual, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)

		err = adminClient.Delete(ctx, actual.Name, v1.DeleteOptions{
			Preconditions: &v1.Preconditions{
				ResourceVersion: util.Pointer(actual.ResourceVersion),
			},
		})
		require.NoError(t, err)
	})
	t.Run("should succeed if version is empty", func(t *testing.T) {
		actual, err := adminClient.Create(ctx, &receiver, v1.CreateOptions{})
		require.NoError(t, err)

		err = adminClient.Delete(ctx, actual.Name, v1.DeleteOptions{
			Preconditions: &v1.Preconditions{
				ResourceVersion: util.Pointer(actual.ResourceVersion),
			},
		})
		require.NoError(t, err)
	})
}

func TestIntegrationPatch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminClient := test_common.NewReceiverClient(t, helper.Org1.Admin)
	receiver := v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title: "receiver",
			Integrations: []v0alpha1.ReceiverIntegration{
				createIntegration(t, "email"),
				createIntegration(t, "webhook"),
				createIntegration(t, "sns"),
			},
		},
	}

	current, err := adminClient.Create(ctx, &receiver, v1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, current)

	t.Run("should patch with json patch", func(t *testing.T) {
		current, err := adminClient.Get(ctx, current.Name, v1.GetOptions{})
		require.NoError(t, err)

		index := slices.IndexFunc(current.Spec.Integrations, func(t v0alpha1.ReceiverIntegration) bool {
			return t.Type == "webhook"
		})

		patch := []map[string]any{
			{
				"op":   "remove",
				"path": fmt.Sprintf("/spec/integrations/%d/settings/username", index),
			},
			{
				"op":   "remove",
				"path": fmt.Sprintf("/spec/integrations/%d/secureFields/password", index),
			},
			{
				"op":    "replace",
				"path":  fmt.Sprintf("/spec/integrations/%d/settings/authorization_scheme", index),
				"value": "bearer",
			},
			{
				"op":    "add",
				"path":  fmt.Sprintf("/spec/integrations/%d/settings/authorization_credentials", index),
				"value": "authz-token",
			},
			{
				"op":   "remove",
				"path": fmt.Sprintf("/spec/integrations/%d/secureFields/authorization_credentials", index),
			},
		}

		expected := current.Spec.Integrations[index]
		delete(expected.Settings, "username")
		delete(expected.Settings, "password")
		expected.Settings["authorization_scheme"] = "bearer"
		delete(expected.SecureFields, "password")
		expected.SecureFields["authorization_credentials"] = true

		patchData, err := json.Marshal(patch)
		require.NoError(t, err)

		result, err := adminClient.Patch(ctx, current.Name, types.JSONPatchType, patchData, v1.PatchOptions{})
		require.NoError(t, err)

		require.EqualValues(t, expected, result.Spec.Integrations[index])

		// Use export endpoint because it's the only way to get decrypted secrets fast.
		cliCfg := helper.Org1.Admin.NewRestConfig()
		legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

		export := legacyCli.ExportReceiverTyped(t, current.Spec.Title, true)
		// we need special unmarshaler to parse settings
		cp, err := api.ContactPointFromContactPointExport(export)
		require.NoError(t, err)

		assert.Len(t, cp.Sns, 1)
		assert.Len(t, cp.Email, 1)
		require.Len(t, cp.Webhook, 1)

		settings := cp.Webhook[0]
		assert.EqualValues(t, "authz-token", *settings.AuthorizationCredentials)
		assert.EqualValues(t, "bearer", *settings.AuthorizationScheme)
		assert.Nil(t, settings.Password)
		assert.Nil(t, settings.User)
	})
}

func TestIntegrationReferentialIntegrity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)
	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles)
	db, err := store.ProvideDBStore(env.SettingsProvider, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac, bus.ProvideBus(tracing.InitializeTracerForTest()))
	require.NoError(t, err)
	orgID := helper.Org1.Admin.Identity.GetOrgID()

	cliCfg := helper.Org1.Admin.NewRestConfig()
	legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	adminClient := test_common.NewReceiverClient(t, helper.Org1.Admin)
	// Prepare environment and create notification policy and rule that use time receiver
	alertmanagerRaw, err := testData.ReadFile(path.Join("test-data", "notification-settings.json"))
	require.NoError(t, err)
	var amConfig definitions.PostableUserConfig
	require.NoError(t, json.Unmarshal(alertmanagerRaw, &amConfig))

	persistInitialConfig(t, amConfig)

	postGroupRaw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1.json"))
	require.NoError(t, err)
	var ruleGroup definitions.PostableRuleGroupConfig
	require.NoError(t, json.Unmarshal(postGroupRaw, &ruleGroup))

	folderUID := "test-folder"
	legacyCli.CreateFolder(t, folderUID, "TEST")
	_, status, data := legacyCli.PostRulesGroupWithStatus(t, folderUID, &ruleGroup, false)
	require.Equalf(t, http.StatusAccepted, status, "Failed to post Rule: %s", data)

	receivers, err := adminClient.List(ctx, v1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, receivers.Items, 2)
	idx := slices.IndexFunc(receivers.Items, func(interval v0alpha1.Receiver) bool {
		return interval.Spec.Title == "user-defined"
	})
	receiver := receivers.Items[idx]

	currentRoute := legacyCli.GetRoute(t)
	currentRuleGroup, status := legacyCli.GetRulesGroup(t, folderUID, ruleGroup.Name)
	require.Equal(t, http.StatusAccepted, status)

	t.Run("Update", func(t *testing.T) {
		t.Run("should rename all references if name changes", func(t *testing.T) {
			renamed := receiver.Copy().(*v0alpha1.Receiver)
			expectedTitle := renamed.Spec.Title + "-new"
			renamed.Spec.Title = expectedTitle

			actual, err := adminClient.Update(ctx, renamed, v1.UpdateOptions{})
			require.NoError(t, err)

			updatedRuleGroup, status := legacyCli.GetRulesGroup(t, folderUID, ruleGroup.Name)
			require.Equal(t, http.StatusAccepted, status)
			for idx, rule := range updatedRuleGroup.Rules {
				assert.Equalf(t, expectedTitle, rule.GrafanaManagedAlert.NotificationSettings.Receiver, "receiver in rule %d should have been renamed but it did not", idx)
			}

			updatedRoute := legacyCli.GetRoute(t)
			for _, route := range updatedRoute.Routes {
				assert.Equalf(t, expectedTitle, route.Receiver, "time receiver in routes should have been renamed but it did not")
			}

			actual, err = adminClient.Get(ctx, actual.Name, v1.GetOptions{})
			require.NoError(t, err)

			receiver = *actual
		})

		t.Run("should fail if at least one resource is provisioned", func(t *testing.T) {
			require.NoError(t, err)
			renamed := receiver.Copy().(*v0alpha1.Receiver)
			renamed.Spec.Title += util.GenerateShortUID()

			t.Run("provisioned route", func(t *testing.T) {
				require.NoError(t, db.SetProvenance(ctx, &currentRoute, orgID, "API"))
				t.Cleanup(func() {
					require.NoError(t, db.DeleteProvenance(ctx, &currentRoute, orgID))
				})
				actual, err := adminClient.Update(ctx, renamed, v1.UpdateOptions{})
				require.Errorf(t, err, "Expected error but got successful result: %v", actual)
				require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
			})

			t.Run("provisioned rules", func(t *testing.T) {
				ruleUid := currentRuleGroup.Rules[0].GrafanaManagedAlert.UID
				resource := &ngmodels.AlertRule{UID: ruleUid}
				require.NoError(t, db.SetProvenance(ctx, resource, orgID, "API"))
				t.Cleanup(func() {
					require.NoError(t, db.DeleteProvenance(ctx, resource, orgID))
				})

				actual, err := adminClient.Update(ctx, renamed, v1.UpdateOptions{})
				require.Errorf(t, err, "Expected error but got successful result: %v", actual)
				require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
			})
		})
	})

	t.Run("Delete", func(t *testing.T) {
		t.Run("should fail to delete if receiver is used in rule and routes", func(t *testing.T) {
			err := adminClient.Delete(ctx, receiver.Name, v1.DeleteOptions{})
			require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
		})

		t.Run("should fail to delete if receiver is used in only rule", func(t *testing.T) {
			route := legacyCli.GetRoute(t)
			route.Routes[0].Receiver = ""
			legacyCli.UpdateRoute(t, route, true)

			err = adminClient.Delete(ctx, receiver.Name, v1.DeleteOptions{})
			require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
		})
	})
}

func TestIntegrationCRUD(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminClient := test_common.NewReceiverClient(t, helper.Org1.Admin)
	var defaultReceiver *v0alpha1.Receiver
	t.Run("should list the default receiver", func(t *testing.T) {
		items, err := adminClient.List(ctx, v1.ListOptions{})
		require.NoError(t, err)
		assert.Len(t, items.Items, 1)
		defaultReceiver = &items.Items[0]
		assert.Equal(t, "grafana-default-email", defaultReceiver.Spec.Title)
		assert.NotEmpty(t, defaultReceiver.UID)
		assert.NotEmpty(t, defaultReceiver.Name)
		assert.NotEmpty(t, defaultReceiver.ResourceVersion)

		defaultReceiver, err = adminClient.Get(ctx, defaultReceiver.Name, v1.GetOptions{})
		require.NoError(t, err)
		assert.NotEmpty(t, defaultReceiver.UID)
		assert.NotEmpty(t, defaultReceiver.Name)
		assert.NotEmpty(t, defaultReceiver.ResourceVersion)
		assert.Len(t, defaultReceiver.Spec.Integrations, 1)
	})

	t.Run("should be able to update default receiver", func(t *testing.T) {
		require.NotNil(t, defaultReceiver)
		newDefault := defaultReceiver.Copy().(*v0alpha1.Receiver)
		newDefault.Spec.Integrations = append(newDefault.Spec.Integrations, createIntegration(t, "line"))

		updatedReceiver, err := adminClient.Update(ctx, newDefault, v1.UpdateOptions{})
		require.NoError(t, err)

		expected := newDefault.Copy().(*v0alpha1.Receiver)
		expected.Spec.Integrations[0].Uid = updatedReceiver.Spec.Integrations[0].Uid // default integration does not have UID before first update
		lineIntegration := expected.Spec.Integrations[1]
		lineIntegration.SecureFields = map[string]bool{
			"token": true,
		}
		delete(lineIntegration.Settings, "token")
		assert.Equal(t, "LINE", updatedReceiver.Spec.Integrations[1].Type) // this type is in the schema but not in backend
		lineIntegration.Type = "LINE"
		lineIntegration.Uid = updatedReceiver.Spec.Integrations[1].Uid
		expected.Spec.Integrations[1] = lineIntegration

		assert.Equal(t, expected.Spec, updatedReceiver.Spec)
	})

	t.Run("should fail to create receiver with the existing name", func(t *testing.T) {
		newReceiver := &v0alpha1.Receiver{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
			},
			Spec: v0alpha1.ReceiverSpec{
				Title:        defaultReceiver.Spec.Title,
				Integrations: []v0alpha1.ReceiverIntegration{},
			},
		}
		_, err := adminClient.Create(ctx, newReceiver, v1.CreateOptions{})
		require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
	})

	t.Run("should not let delete default receiver", func(t *testing.T) {
		err := adminClient.Delete(ctx, defaultReceiver.Name, v1.DeleteOptions{})
		require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
	})

	var receiver *v0alpha1.Receiver
	t.Run("should correctly persist all known integrations", func(t *testing.T) {
		integrations := make([]v0alpha1.ReceiverIntegration, 0, len(notify.AllKnownConfigsForTesting))
		keysIter := maps.Keys(notify.AllKnownConfigsForTesting)
		keys := slices.Collect(keysIter)
		sort.Strings(keys)
		for _, key := range keys {
			integrations = append(integrations, createIntegration(t, key))
		}
		var err error
		receiver, err = adminClient.Create(ctx, &v0alpha1.Receiver{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
			},
			Spec: v0alpha1.ReceiverSpec{
				Title:        "all-receivers",
				Integrations: integrations,
			},
		}, v1.CreateOptions{})
		require.NoError(t, err)
		require.Len(t, receiver.Spec.Integrations, len(integrations))

		// Set expected metadata
		receiver.SetAccessControl("canWrite")
		receiver.SetAccessControl("canDelete")
		receiver.SetAccessControl("canReadSecrets")
		receiver.SetAccessControl("canAdmin")
		receiver.SetInUse(0, nil)

		// Use export endpoint because it's the only way to get decrypted secrets fast.
		cliCfg := helper.Org1.Admin.NewRestConfig()
		legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

		export := legacyCli.ExportReceiverTyped(t, receiver.Spec.Title, true)
		for _, integration := range export.Receivers {
			expected := notify.AllKnownConfigsForTesting[strings.ToLower(integration.Type)] // to lower because there is LINE that is in different casing in API
			assert.JSONEqf(t, expected.Config, string(integration.Settings), "integration %s", integration.Type)
		}
	})

	t.Run("should be able read what it is created", func(t *testing.T) {
		get, err := adminClient.Get(ctx, receiver.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, receiver, get)
		t.Run("should return secrets in secureFields but not settings", func(t *testing.T) {
			for _, integration := range get.Spec.Integrations {
				t.Run(integration.Type, func(t *testing.T) {
					expected := notify.AllKnownConfigsForTesting[strings.ToLower(integration.Type)]
					var fields map[string]any
					require.NoError(t, json.Unmarshal([]byte(expected.Config), &fields))
					secretFields, err := channels_config.GetSecretKeysForContactPointType(integration.Type)
					require.NoError(t, err)
					for _, field := range secretFields {
						if _, ok := fields[field]; !ok { // skip field that is not in the original setting
							continue
						}
						assert.Contains(t, integration.SecureFields, field)
						assert.Truef(t, integration.SecureFields[field], "secure field should be always true")

						value, ok, err := unstructured.NestedString(integration.Settings, strings.Split(field, ".")...)
						assert.NoErrorf(t, err, "failed to read field %s from settings", field)
						assert.Falsef(t, ok, "secret field %s should not be in settings, value [%s]", field, value)
					}
				})
			}
		})
	})

	t.Run("should fail to persist receiver with invalid config", func(t *testing.T) {
		keysIter := maps.Keys(notify.AllKnownConfigsForTesting)
		keys := slices.Collect(keysIter)
		sort.Strings(keys)
		for _, key := range keys {
			t.Run(key, func(t *testing.T) {
				integration := createIntegration(t, key)
				// Make the integration invalid, so it fails to create. This is usually done by sending empty settings.
				clear(integration.Settings)
				if key == "webex" {
					// Webex integration is special case and passes validation without any settings so we instead set an invalid URL.
					integration.Settings["api_url"] = "(*^$*^%!@#$*()"
				}

				receiver, err := adminClient.Create(ctx, &v0alpha1.Receiver{
					ObjectMeta: v1.ObjectMeta{
						Namespace: "default",
					},
					Spec: v0alpha1.ReceiverSpec{
						Title:        fmt.Sprintf("invalid-%s", key),
						Integrations: []v0alpha1.ReceiverIntegration{integration},
					},
				}, v1.CreateOptions{})
				require.Errorf(t, err, "Expected error but got successful result: %v", receiver)
				require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest, got: %s", err)
			})
		}
	})
}

func TestIntegrationReceiverListSelector(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminClient := test_common.NewReceiverClient(t, helper.Org1.Admin)
	recv1 := &v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title: "test-receiver-1",
			Integrations: []v0alpha1.ReceiverIntegration{
				createIntegration(t, "email"),
			},
		},
	}
	recv1, err := adminClient.Create(ctx, recv1, v1.CreateOptions{})
	require.NoError(t, err)

	recv2 := &v0alpha1.Receiver{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.ReceiverSpec{
			Title: "test-receiver-2",
			Integrations: []v0alpha1.ReceiverIntegration{
				createIntegration(t, "email"),
			},
		},
	}
	recv2, err = adminClient.Create(ctx, recv2, v1.CreateOptions{})
	require.NoError(t, err)

	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles)
	db, err := store.ProvideDBStore(env.SettingsProvider, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac, bus.ProvideBus(tracing.InitializeTracerForTest()))
	require.NoError(t, err)
	require.NoError(t, db.SetProvenance(ctx, &definitions.EmbeddedContactPoint{
		UID: *recv2.Spec.Integrations[0].Uid,
	}, helper.Org1.Admin.Identity.GetOrgID(), "API"))
	recv2, err = adminClient.Get(ctx, recv2.Name, v1.GetOptions{})

	require.NoError(t, err)

	receivers, err := adminClient.List(ctx, v1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, receivers.Items, 3) // Includes default.

	t.Run("should filter by receiver name", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: "spec.title=" + recv1.Spec.Title,
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, recv1.Name, list.Items[0].Name)
	})

	t.Run("should filter by metadata name", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: "metadata.name=" + recv2.Name,
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, recv2.Name, list.Items[0].Name)
	})

	t.Run("should filter by multiple filters", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: fmt.Sprintf("metadata.name=%s,spec.title=%s", recv2.Name, recv2.Spec.Title),
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, recv2.Name, list.Items[0].Name)
	})

	t.Run("should be empty when filter does not match", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: fmt.Sprintf("metadata.name=%s", "unknown"),
		})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})
}

// persistInitialConfig helps create an initial config with new receivers using legacy json. Config API blocks receiver
// modifications, so we need to use k8s API to create new receivers before posting the config.
func persistInitialConfig(t *testing.T, amConfig definitions.PostableUserConfig) {
	ctx := context.Background()

	helper := getTestHelper(t)

	receiverClient := test_common.NewReceiverClient(t, helper.Org1.Admin)
	for _, receiver := range amConfig.AlertmanagerConfig.Receivers {
		if receiver.Name == "grafana-default-email" {
			continue
		}

		toCreate := v0alpha1.Receiver{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
			},
			Spec: v0alpha1.ReceiverSpec{
				Title:        receiver.Name,
				Integrations: []v0alpha1.ReceiverIntegration{},
			},
		}

		for _, integration := range receiver.GrafanaManagedReceivers {
			settings := common.Unstructured{}
			require.NoError(t, settings.UnmarshalJSON(integration.Settings))
			toCreate.Spec.Integrations = append(toCreate.Spec.Integrations, v0alpha1.ReceiverIntegration{
				Settings:              settings.Object,
				Type:                  integration.Type,
				DisableResolveMessage: util.Pointer(false),
			})
		}

		created, err := receiverClient.Create(ctx, &toCreate, v1.CreateOptions{})
		require.NoError(t, err)

		for i, integration := range created.Spec.Integrations {
			receiver.GrafanaManagedReceivers[i].UID = *integration.Uid
		}
	}

	nsMapper := func(_ int64) string { return "default" }

	routeClient := test_common.NewRoutingTreeClient(t, helper.Org1.Admin)
	v1route, err := routingtree.ConvertToK8sResource(helper.Org1.AdminServiceAccount.OrgId, *amConfig.AlertmanagerConfig.Route, "", nsMapper)
	require.NoError(t, err)
	_, err = routeClient.Update(ctx, v1route, v1.UpdateOptions{})
	require.NoError(t, err)
}

func createIntegration(t *testing.T, integrationType string) v0alpha1.ReceiverIntegration {
	cfg, ok := notify.AllKnownConfigsForTesting[integrationType]
	require.Truef(t, ok, "no known config for integration type %s", integrationType)
	return createIntegrationWithSettings(t, integrationType, cfg.Config)
}

func createIntegrationWithSettings(t *testing.T, integrationType string, settingsJson string) v0alpha1.ReceiverIntegration {
	settings := common.Unstructured{}
	require.NoError(t, settings.UnmarshalJSON([]byte(settingsJson)))
	return v0alpha1.ReceiverIntegration{
		Settings:              settings.Object,
		Type:                  integrationType,
		DisableResolveMessage: util.Pointer(false),
	}
}

func createWildcardPermission(actions ...string) resourcepermissions.SetResourcePermissionCommand {
	return resourcepermissions.SetResourcePermissionCommand{
		Actions:           actions,
		Resource:          "receivers",
		ResourceAttribute: "uid",
		ResourceID:        "*",
	}
}
