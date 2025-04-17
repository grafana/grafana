package timeinterval

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"path"
	"slices"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/timeinterval/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/timeinterval/v0alpha1/fakes"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/alerting/notifications/routingtree"
	"github.com/grafana/grafana/pkg/registry/apis/alerting/notifications/timeinterval"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/notifications/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

//go:embed test-data/*.*
var testData embed.FS

func TestMain(m *testing.M) {
	testsuite.RunButSkipOnSpanner(m)
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
	client := common.NewTimeIntervalClient(t, helper.Org1.Admin)

	newInterval := &v0alpha1.TimeInterval{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.Spec{
			Name:          "time-newInterval",
			TimeIntervals: fakes.IntervalGenerator{}.GenerateMany(2),
		},
	}

	t.Run("create should fail if object name is specified", func(t *testing.T) {
		interval := newInterval.Copy().(*v0alpha1.TimeInterval)
		interval.Name = "time-newInterval"
		_, err := client.Create(ctx, interval, v1.CreateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest but got %s", err)
	})

	var resourceID string
	t.Run("create should succeed and provide resource name", func(t *testing.T) {
		actual, err := client.Create(ctx, newInterval, v1.CreateOptions{})
		require.NoError(t, err)
		require.NotEmptyf(t, actual.Name, "Resource name should not be empty")
		require.NotEmptyf(t, actual.UID, "Resource UID should not be empty")
		resourceID = actual.Name
	})

	var existingInterval *v0alpha1.TimeInterval
	t.Run("resource should be available by the identifier", func(t *testing.T) {
		actual, err := client.Get(ctx, resourceID, v1.GetOptions{})
		require.NoError(t, err)
		require.NotEmptyf(t, actual.Name, "Resource name should not be empty")
		require.Equal(t, newInterval.Spec, actual.Spec)
		existingInterval = actual
	})

	t.Run("update should rename interval if name in the specification changes", func(t *testing.T) {
		if existingInterval == nil {
			t.Skip()
		}
		updated := existingInterval.Copy().(*v0alpha1.TimeInterval)
		updated.Spec.Name = "another-newInterval"
		actual, err := client.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, updated.Spec, actual.Spec)
		require.NotEqualf(t, updated.Name, actual.Name, "Update should change the resource name but it didn't")
		require.NotEqualf(t, updated.ResourceVersion, actual.ResourceVersion, "Update should change the resource version but it didn't")

		resource, err := client.Get(ctx, actual.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, actual, resource)
	})
}

func TestIntegrationTimeIntervalAccessControl(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	org1 := helper.Org1

	type testCase struct {
		user      apis.User
		canRead   bool
		canUpdate bool
		canCreate bool
		canDelete bool
	}

	reader := helper.CreateUser("IntervalsReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsTimeIntervalsRead,
			},
		},
	})
	writer := helper.CreateUser("IntervalsWriter", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsTimeIntervalsRead,
				accesscontrol.ActionAlertingNotificationsTimeIntervalsWrite,
			},
		},
	})

	deleter := helper.CreateUser("IntervalsDeleter", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsTimeIntervalsRead,
				accesscontrol.ActionAlertingNotificationsTimeIntervalsDelete,
			},
		},
	})

	testCases := []testCase{
		{
			user:      org1.Admin,
			canRead:   true,
			canUpdate: true,
			canCreate: true,
			canDelete: true,
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

	adminClient := common.NewTimeIntervalClient(t, helper.Org1.Admin)

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("user '%s'", tc.user.Identity.GetLogin()), func(t *testing.T) {
			client := common.NewTimeIntervalClient(t, tc.user)
			var expected = &v0alpha1.TimeInterval{
				ObjectMeta: v1.ObjectMeta{
					Namespace: "default",
				},
				Spec: v0alpha1.Spec{
					Name:          fmt.Sprintf("time-interval-1-%s", tc.user.Identity.GetLogin()),
					TimeIntervals: fakes.IntervalGenerator{}.GenerateMany(2),
				},
			}
			expected.SetProvenanceStatus("")
			d, err := json.Marshal(expected)
			require.NoError(t, err)

			if tc.canCreate {
				t.Run("should be able to create time interval", func(t *testing.T) {
					actual, err := client.Create(ctx, expected, v1.CreateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))
					require.Equal(t, expected.Spec, actual.Spec)

					t.Run("should fail if already exists", func(t *testing.T) {
						_, err := client.Create(ctx, actual, v1.CreateOptions{})
						require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
					})

					expected = actual
				})
			} else {
				t.Run("should be forbidden to create", func(t *testing.T) {
					_, err := client.Create(ctx, expected, v1.CreateOptions{})
					require.Truef(t, errors.IsForbidden(err), "Payload %s", string(d))
				})

				// create resource to proceed with other tests
				expected, err = adminClient.Create(ctx, expected, v1.CreateOptions{})
				require.NoErrorf(t, err, "Payload %s", string(d))
				require.NotNil(t, expected)
			}

			if tc.canRead {
				t.Run("should be able to list time intervals", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 1)
				})

				t.Run("should be able to read time interval by resource identifier", func(t *testing.T) {
					got, err := client.Get(ctx, expected.Name, v1.GetOptions{})
					require.NoError(t, err)
					require.Equal(t, expected, got)

					t.Run("should get NotFound if resource does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, "Notfound", v1.GetOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
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

			updatedExpected := expected.Copy().(*v0alpha1.TimeInterval)
			updatedExpected.Spec.TimeIntervals = fakes.IntervalGenerator{}.GenerateMany(2)

			d, err = json.Marshal(updatedExpected)
			require.NoError(t, err)

			if tc.canUpdate {
				t.Run("should be able to update time interval", func(t *testing.T) {
					updated, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))

					expected = updated

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						up := updatedExpected.Copy().(*v0alpha1.TimeInterval)
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to update time interval", func(t *testing.T) {
					_, err := client.Update(ctx, updatedExpected, v1.UpdateOptions{})
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if resource does not exist", func(t *testing.T) {
						up := updatedExpected.Copy().(*v0alpha1.TimeInterval)
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			deleteOptions := v1.DeleteOptions{Preconditions: &v1.Preconditions{ResourceVersion: util.Pointer(expected.ResourceVersion)}}

			if tc.canDelete {
				t.Run("should be able to delete time interval", func(t *testing.T) {
					err := client.Delete(ctx, expected.Name, deleteOptions)
					require.NoError(t, err)

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						err := client.Delete(ctx, "notfound", v1.DeleteOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to delete time interval", func(t *testing.T) {
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
				t.Run("should get empty list if no mute timings", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 0)
				})
			}
		})
	}
}

func TestIntegrationTimeIntervalProvisioning(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	org := helper.Org1

	admin := org.Admin
	adminClient := common.NewTimeIntervalClient(t, helper.Org1.Admin)

	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles)
	db, err := store.ProvideDBStore(env.Cfg, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac, bus.ProvideBus(tracing.InitializeTracerForTest()))
	require.NoError(t, err)

	created, err := adminClient.Create(ctx, &v0alpha1.TimeInterval{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.Spec{
			Name:          "time-interval-1",
			TimeIntervals: fakes.IntervalGenerator{}.GenerateMany(2),
		},
	}, v1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "none", created.GetProvenanceStatus())

	t.Run("should provide provenance status", func(t *testing.T) {
		require.NoError(t, db.SetProvenance(ctx, &definitions.MuteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name: created.Spec.Name,
			},
		}, admin.Identity.GetOrgID(), "API"))

		got, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "API", got.GetProvenanceStatus())
	})
	t.Run("should not let update if provisioned", func(t *testing.T) {
		updated := created.Copy().(*v0alpha1.TimeInterval)
		updated.Spec.TimeIntervals = fakes.IntervalGenerator{}.GenerateMany(2)

		_, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})

	t.Run("should not let delete if provisioned", func(t *testing.T) {
		err := adminClient.Delete(ctx, created.Name, v1.DeleteOptions{})
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})
}

func TestIntegrationTimeIntervalOptimisticConcurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminClient := common.NewTimeIntervalClient(t, helper.Org1.Admin)

	interval := v0alpha1.TimeInterval{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.Spec{
			Name:          "time-interval",
			TimeIntervals: fakes.IntervalGenerator{}.GenerateMany(2),
		},
	}

	created, err := adminClient.Create(ctx, &interval, v1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)
	require.NotEmpty(t, created.ResourceVersion)

	t.Run("should forbid if version does not match", func(t *testing.T) {
		updated := created.Copy().(*v0alpha1.TimeInterval)
		updated.ResourceVersion = "test"
		_, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err)
	})
	t.Run("should update if version matches", func(t *testing.T) {
		updated := created.Copy().(*v0alpha1.TimeInterval)
		updated.Spec.TimeIntervals = fakes.IntervalGenerator{}.GenerateMany(2)
		actualUpdated, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		require.EqualValues(t, updated.Spec, actualUpdated.Spec)
		require.NotEqual(t, updated.ResourceVersion, actualUpdated.ResourceVersion)
	})
	t.Run("should update if version is empty", func(t *testing.T) {
		updated := created.Copy().(*v0alpha1.TimeInterval)
		updated.ResourceVersion = ""
		updated.Spec.TimeIntervals = fakes.IntervalGenerator{}.GenerateMany(2)

		actualUpdated, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		require.EqualValues(t, updated.Spec, actualUpdated.Spec)
		require.NotEqual(t, created.ResourceVersion, actualUpdated.ResourceVersion)
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
		actual, err := adminClient.Create(ctx, &interval, v1.CreateOptions{})
		require.NoError(t, err)

		err = adminClient.Delete(ctx, actual.Name, v1.DeleteOptions{
			Preconditions: &v1.Preconditions{
				ResourceVersion: util.Pointer(actual.ResourceVersion),
			},
		})
		require.NoError(t, err)
	})
}

func TestIntegrationTimeIntervalPatch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminClient := common.NewTimeIntervalClient(t, helper.Org1.Admin)

	interval := v0alpha1.TimeInterval{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.Spec{
			Name:          "time-interval",
			TimeIntervals: fakes.IntervalGenerator{}.GenerateMany(2),
		},
	}

	current, err := adminClient.Create(ctx, &interval, v1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, current)
	require.NotEmpty(t, current.ResourceVersion)

	t.Run("should patch with merge patch", func(t *testing.T) {
		patch := `{
             "spec": {
                 "time_intervals" : []
             }
		 }`

		result, err := adminClient.Patch(ctx, current.Name, types.MergePatchType, []byte(patch), v1.PatchOptions{})
		require.NoError(t, err)
		require.Empty(t, result.Spec.TimeIntervals)
		current = result
	})

	t.Run("should patch with json patch", func(t *testing.T) {
		expected := fakes.IntervalGenerator{}.Generate()

		patch := []map[string]interface{}{
			{
				"op":    "add",
				"path":  "/spec/time_intervals/-",
				"value": expected,
			},
		}

		patchData, err := json.Marshal(patch)
		require.NoError(t, err)

		result, err := adminClient.Patch(ctx, current.Name, types.JSONPatchType, patchData, v1.PatchOptions{})
		require.NoError(t, err)
		expectedSpec := v0alpha1.Spec{
			Name: current.Spec.Name,
			TimeIntervals: []v0alpha1.Interval{
				expected,
			},
		}
		require.EqualValues(t, expectedSpec, result.Spec)
		current = result
	})
}

func TestIntegrationTimeIntervalListSelector(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminClient := common.NewTimeIntervalClient(t, helper.Org1.Admin)

	interval1 := &v0alpha1.TimeInterval{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.Spec{
			Name:          "test1",
			TimeIntervals: fakes.IntervalGenerator{}.GenerateMany(2),
		},
	}
	interval1, err := adminClient.Create(ctx, interval1, v1.CreateOptions{})
	require.NoError(t, err)

	interval2 := &v0alpha1.TimeInterval{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.Spec{
			Name:          "test2",
			TimeIntervals: fakes.IntervalGenerator{}.GenerateMany(2),
		},
	}
	interval2, err = adminClient.Create(ctx, interval2, v1.CreateOptions{})
	require.NoError(t, err)
	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles)
	db, err := store.ProvideDBStore(env.Cfg, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac, bus.ProvideBus(tracing.InitializeTracerForTest()))
	require.NoError(t, err)
	require.NoError(t, db.SetProvenance(ctx, &definitions.MuteTimeInterval{
		MuteTimeInterval: config.MuteTimeInterval{
			Name: interval2.Spec.Name,
		},
	}, helper.Org1.Admin.Identity.GetOrgID(), "API"))
	interval2, err = adminClient.Get(ctx, interval2.Name, v1.GetOptions{})

	require.NoError(t, err)

	intervals, err := adminClient.List(ctx, v1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, intervals.Items, 2)

	t.Run("should filter by interval name", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: "spec.name=" + interval1.Spec.Name,
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, interval1.Name, list.Items[0].Name)
	})

	t.Run("should filter by interval metadata name", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: "metadata.name=" + interval2.Name,
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, interval2.Name, list.Items[0].Name)
	})

	t.Run("should filter by multiple filters", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: fmt.Sprintf("metadata.name=%s,spec.name=%s", interval2.Name, interval2.Spec.Name),
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, interval2.Name, list.Items[0].Name)
	})

	t.Run("should be empty when filter does not match", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{
			FieldSelector: fmt.Sprintf("metadata.name=%s", "unknown"),
		})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})
}

func TestIntegrationTimeIntervalReferentialIntegrity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)
	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles)
	db, err := store.ProvideDBStore(env.Cfg, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac, bus.ProvideBus(tracing.InitializeTracerForTest()))
	require.NoError(t, err)
	orgID := helper.Org1.Admin.Identity.GetOrgID()

	cliCfg := helper.Org1.Admin.NewRestConfig()
	legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	// Prepare environment and create notification policy and rule that use time interval
	alertmanagerRaw, err := testData.ReadFile(path.Join("test-data", "notification-settings.json"))
	require.NoError(t, err)
	var amConfig definitions.PostableUserConfig
	require.NoError(t, json.Unmarshal(alertmanagerRaw, &amConfig))

	mtis := []definitions.MuteTimeInterval{}
	for _, interval := range amConfig.AlertmanagerConfig.MuteTimeIntervals {
		mtis = append(mtis, definitions.MuteTimeInterval{
			MuteTimeInterval: interval,
		})
	}

	adminClient := common.NewTimeIntervalClient(t, helper.Org1.Admin)
	v1intervals, err := timeinterval.ConvertToK8sResources(orgID, mtis, func(int64) string { return "default" }, nil)
	require.NoError(t, err)
	for _, interval := range v1intervals.Items {
		_, err := adminClient.Create(ctx, &interval, v1.CreateOptions{})
		require.NoError(t, err)
	}

	routeClient := common.NewRoutingTreeClient(t, helper.Org1.Admin)
	v1route, err := routingtree.ConvertToK8sResource(helper.Org1.Admin.Identity.GetOrgID(), *amConfig.AlertmanagerConfig.Route, "", func(int64) string { return "default" })
	require.NoError(t, err)
	_, err = routeClient.Update(ctx, v1route, v1.UpdateOptions{})
	require.NoError(t, err)

	postGroupRaw, err := testData.ReadFile(path.Join("test-data", "rulegroup-1.json"))
	require.NoError(t, err)
	var ruleGroup definitions.PostableRuleGroupConfig
	require.NoError(t, json.Unmarshal(postGroupRaw, &ruleGroup))

	folderUID := "test-folder"
	legacyCli.CreateFolder(t, folderUID, "TEST")
	_, status, data := legacyCli.PostRulesGroupWithStatus(t, folderUID, &ruleGroup, false)
	require.Equalf(t, http.StatusAccepted, status, "Failed to post Rule: %s", data)

	currentRoute := legacyCli.GetRoute(t)
	currentRuleGroup, status := legacyCli.GetRulesGroup(t, folderUID, ruleGroup.Name)
	require.Equal(t, http.StatusAccepted, status)

	intervals, err := adminClient.List(ctx, v1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, intervals.Items, 2)
	intervalIdx := slices.IndexFunc(intervals.Items, func(interval v0alpha1.TimeInterval) bool {
		return interval.Spec.Name == "test-interval"
	})
	interval := intervals.Items[intervalIdx]

	replace := func(input []string, oldName, newName string) []string {
		result := make([]string, 0, len(input))
		for _, s := range input {
			if s == oldName {
				result = append(result, newName)
				continue
			}
			result = append(result, s)
		}
		return result
	}

	t.Run("Update", func(t *testing.T) {
		t.Run("should rename all references if name changes", func(t *testing.T) {
			renamed := interval.Copy().(*v0alpha1.TimeInterval)
			renamed.Spec.Name += "-new"

			actual, err := adminClient.Update(ctx, renamed, v1.UpdateOptions{})
			require.NoError(t, err)

			updatedRuleGroup, status := legacyCli.GetRulesGroup(t, folderUID, ruleGroup.Name)
			require.Equal(t, http.StatusAccepted, status)
			for idx, rule := range updatedRuleGroup.Rules {
				expectedTimeIntervals := currentRuleGroup.Rules[idx].GrafanaManagedAlert.NotificationSettings.MuteTimeIntervals
				expectedTimeIntervals = replace(expectedTimeIntervals, interval.Spec.Name, actual.Spec.Name)
				assert.Equalf(t, expectedTimeIntervals, rule.GrafanaManagedAlert.NotificationSettings.MuteTimeIntervals, "time interval in rules should have been renamed but it did not")
			}

			updatedRoute := legacyCli.GetRoute(t)
			for idx, route := range updatedRoute.Routes {
				expectedTimeIntervals := replace(currentRoute.Routes[idx].MuteTimeIntervals, interval.Spec.Name, actual.Spec.Name)
				assert.Equalf(t, expectedTimeIntervals, route.MuteTimeIntervals, "time interval in routes should have been renamed but it did not")
			}

			interval = *actual
		})

		t.Run("should fail if at least one resource is provisioned", func(t *testing.T) {
			require.NoError(t, err)
			renamed := interval.Copy().(*v0alpha1.TimeInterval)
			renamed.Spec.Name += util.GenerateShortUID()

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
		t.Run("should fail to delete if time interval is used in rule and routes", func(t *testing.T) {
			err := adminClient.Delete(ctx, interval.Name, v1.DeleteOptions{})
			require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
		})

		t.Run("should fail to delete if time interval is used in only rule", func(t *testing.T) {
			route := legacyCli.GetRoute(t)
			route.Routes[0].MuteTimeIntervals = nil
			legacyCli.UpdateRoute(t, route, true)

			err = adminClient.Delete(ctx, interval.Name, v1.DeleteOptions{})
			require.Truef(t, errors.IsConflict(err), "Expected Conflict, got: %s", err)
		})
	})
}

func TestIntegrationTimeIntervalValidation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminClient := common.NewTimeIntervalClient(t, helper.Org1.Admin)

	testCases := []struct {
		name     string
		interval v0alpha1.Spec
	}{
		{
			name: "missing name",
			interval: v0alpha1.Spec{
				Name:          "",
				TimeIntervals: fakes.IntervalGenerator{}.GenerateMany(1),
			},
		},
		{
			name: "invalid interval",
			interval: v0alpha1.Spec{
				Name: "test",
				TimeIntervals: []v0alpha1.Interval{
					{
						DaysOfMonth: []string{"1-31"},
					},
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			i := &v0alpha1.TimeInterval{
				ObjectMeta: v1.ObjectMeta{
					Namespace: "default",
				},
				Spec: tc.interval,
			}
			_, err := adminClient.Create(ctx, i, v1.CreateOptions{})
			require.Error(t, err)
			require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest, got: %s", err)
		})
	}
}
