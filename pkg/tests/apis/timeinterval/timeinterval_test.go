package timeinterval

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/alerting_notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationTimeInterval(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{})

	org := helper.Org1

	type testCase struct {
		user      apis.User
		canRead   bool
		canUpdate bool
		canCreate bool
		canDelete bool
	}

	reader := helper.CreateUser("IntervalsReader", apis.Org1, roletype.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsTimeIntervalsRead,
			},
		},
	})
	writer := helper.CreateUser("IntervalsWriter", "Org1", roletype.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsTimeIntervalsRead,
				accesscontrol.ActionAlertingNotificationsTimeIntervalsWrite,
			},
		},
	})

	deleter := helper.CreateUser("IntervalsDeleter", apis.Org1, roletype.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsTimeIntervalsRead,
				accesscontrol.ActionAlertingNotificationsTimeIntervalsDelete,
			},
		},
	})

	testCases := []testCase{
		{
			user:      org.Admin,
			canRead:   true,
			canUpdate: true,
			canCreate: true,
			canDelete: true,
		},
		{
			user:      org.Editor,
			canRead:   true,
			canUpdate: true,
			canCreate: true,
			canDelete: true,
		},
		{
			user:    org.Viewer,
			canRead: true,
		},
		{
			user:    reader,
			canRead: true,
		},
		{
			user:      writer,
			canRead:   true,
			canCreate: true,
			canUpdate: true,
		},
		{
			user:      deleter,
			canRead:   true,
			canDelete: true,
		},
	}

	admin := org.Admin
	adminK8sClient, err := versioned.NewForConfig(admin.NewRestConfig())
	require.NoError(t, err)
	adminClient := adminK8sClient.NotificationsV0alpha1().TimeIntervals("default")

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("user '%s'", tc.user.Identity.GetLogin()), func(t *testing.T) {
			k8sClient, err := versioned.NewForConfig(tc.user.NewRestConfig())
			require.NoError(t, err)
			client := k8sClient.NotificationsV0alpha1().TimeIntervals("default")

			expected := v0alpha1.TimeInterval{
				ObjectMeta: v1.ObjectMeta{
					Namespace: "default",
					Name:      fmt.Sprintf("time-interval-1-%s", tc.user.Identity.GetLogin()),
					Annotations: map[string]string{
						"grafana.com/provenance": "",
					},
				},
				Spec: v0alpha1.TimeIntervalSpec{
					TimeIntervals: v0alpha1.IntervalGenerator{}.GenerateMany(2),
				},
			}

			d, err := json.Marshal(expected)
			require.NoError(t, err)

			if tc.canCreate {
				t.Run("should be able to create time interval", func(t *testing.T) {
					created, err := client.Create(ctx, &expected, v1.CreateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))
					require.Equal(t, expected.Spec, created.Spec)
					require.Equal(t, expected.ObjectMeta, created.ObjectMeta)
					require.Equal(t, "", created.Annotations["grafana.com/provenance"])

					t.Run("should fail if already exists", func(t *testing.T) {
						_, err := client.Create(ctx, &expected, v1.CreateOptions{})
						require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
					})
				})
			}

			if !tc.canCreate {
				t.Run("should be forbidden to create", func(t *testing.T) {
					_, err := client.Create(ctx, &expected, v1.CreateOptions{})
					require.Truef(t, errors.IsForbidden(err), "Payload %s", string(d))
				})
				_, err := adminClient.Create(ctx, &expected, v1.CreateOptions{})
				require.NoErrorf(t, err, "Payload %s", string(d))
			}

			if tc.canRead {
				t.Run("should be able to list time intervals", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 1)
					cp := expected.DeepCopy()
					cp.TypeMeta = v0alpha1.TimeIntervalResourceInfo.TypeMeta()
					require.Equal(t, *cp, list.Items[0])
				})

				t.Run("should be able to read time interval by name", func(t *testing.T) {
					got, err := client.Get(ctx, expected.Name, v1.GetOptions{})
					require.NoError(t, err)
					require.Equal(t, expected, *got)

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, "Notfound", v1.GetOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			}
			if !tc.canRead {
				t.Run("should be forbidden to list time intervals", func(t *testing.T) {
					_, err := client.List(ctx, v1.ListOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
				})

				t.Run("should be forbidden to read time interval by name", func(t *testing.T) {
					_, err := client.Get(ctx, expected.Name, v1.GetOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if name does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, "Notfound", v1.GetOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			if tc.canUpdate {
				t.Run("should be able to update time interval", func(t *testing.T) {
					updatedExpected := expected.DeepCopy()
					updatedExpected.Spec.TimeIntervals = v0alpha1.IntervalGenerator{}.GenerateMany(2)

					d, err = json.Marshal(updatedExpected)
					require.NoError(t, err)

					updated, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))

					require.Equal(t, updatedExpected.Spec, updated.Spec)
					require.Equal(t, updatedExpected.ObjectMeta, updated.ObjectMeta)

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						up := updatedExpected.DeepCopy()
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			}
			if !tc.canUpdate {
				t.Run("should be forbidden to update time interval", func(t *testing.T) {
					updatedExpected := expected.DeepCopy()
					updatedExpected.Spec.TimeIntervals = v0alpha1.IntervalGenerator{}.GenerateMany(2)

					_, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if resource does not exist", func(t *testing.T) {
						up := updatedExpected.DeepCopy()
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			if tc.canDelete {
				t.Run("should be able to delete time interval", func(t *testing.T) {
					err := client.Delete(ctx, expected.Name, v1.DeleteOptions{})
					require.NoError(t, err)

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						err := client.Delete(ctx, "notfound", v1.DeleteOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			}
			if !tc.canDelete {
				t.Run("should be forbidden to delete time interval", func(t *testing.T) {
					err := client.Delete(ctx, expected.Name, v1.DeleteOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should be forbidden even if resource does not exist", func(t *testing.T) {
						err := client.Delete(ctx, "notfound", v1.DeleteOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
				require.NoError(t, adminClient.Delete(ctx, expected.Name, v1.DeleteOptions{}))
			}

			if tc.canRead {
				t.Run("should get empty list if no mute timings", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 0)
				})
			}
		})
	}
}
