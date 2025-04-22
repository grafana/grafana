package routingtree

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/routingtree/v0alpha1"
	v0alpha1_timeinterval "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/timeinterval/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/alerting/notifications/routingtree"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/timeinterval/v0alpha1/fakes"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/notifications/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

func TestMain(m *testing.M) {
	testsuite.RunButSkipOnSpanner(m)
}

func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{})
}

func TestIntegrationNotAllowedMethods(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)
	client := common.NewRoutingTreeClient(t, helper.Org1.Admin)

	route := &v0alpha1.RoutingTree{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.Spec{},
	}
	_, err := client.Create(ctx, route, v1.CreateOptions{})
	assert.Error(t, err)
	require.Truef(t, errors.IsMethodNotSupported(err), "Expected MethodNotSupported but got %s", err)

	err = client.Client.DeleteCollection(ctx, v1.DeleteOptions{}, v1.ListOptions{})
	assert.Error(t, err)
	require.Truef(t, errors.IsMethodNotSupported(err), "Expected MethodNotSupported but got %s", err)
}

func TestIntegrationAccessControl(t *testing.T) {
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
	}

	reader := helper.CreateUser("RoutesReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingRoutesRead,
			},
		},
	})
	writer := helper.CreateUser("RoutesWriter", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingRoutesRead,
				accesscontrol.ActionAlertingRoutesWrite,
			},
		},
	})
	none := helper.CreateUser("RoutesNone", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{})
	legacyReader := helper.CreateUser("LegacyRoutesReader", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsRead,
			},
		},
	})
	legacyWriter := helper.CreateUser("LegacyRoutesWriter", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsRead,
				accesscontrol.ActionAlertingNotificationsWrite,
			},
		},
	})

	testCases := []testCase{
		{
			user: none,
		},
		{
			user:      org1.Admin,
			canRead:   true,
			canUpdate: true,
		},
		{
			user:      org1.Editor,
			canRead:   true,
			canUpdate: true,
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
			canUpdate: true,
		},
		{
			user:    legacyReader,
			canRead: true,
		},
		{
			user:      legacyWriter,
			canRead:   true,
			canUpdate: true,
		},
	}

	admin := org1.Admin
	adminClient := common.NewRoutingTreeClient(t, admin)

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("user '%s'", tc.user.Identity.GetLogin()), func(t *testing.T) {
			client := common.NewRoutingTreeClient(t, tc.user)

			if tc.canRead {
				t.Run("should be able to list routing trees", func(t *testing.T) {
					list, err := client.List(ctx, v1.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 1)
					require.Equal(t, v0alpha1.UserDefinedRoutingTreeName, list.Items[0].Name)
				})

				t.Run("should be able to read routing trees by resource identifier", func(t *testing.T) {
					_, err := client.Get(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.GetOptions{})
					require.NoError(t, err)

					t.Run("should get NotFound if resource does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, "Notfound", v1.GetOptions{})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to list routing trees", func(t *testing.T) {
					_, err := client.List(ctx, v1.ListOptions{})
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
				})

				t.Run("should be forbidden to read routing tree by name", func(t *testing.T) {
					_, err := client.Get(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.GetOptions{})
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if name does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, "Notfound", v1.GetOptions{})
						require.Error(t, err)
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			current, err := adminClient.Get(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.GetOptions{})
			require.NoError(t, err)
			expected := current.Copy().(*v0alpha1.RoutingTree)
			expected.Spec.Routes = []v0alpha1.Route{
				{
					Matchers: []v0alpha1.Matcher{
						{
							Label: "test",
							Type:  v0alpha1.MatcherTypeEqual,
							Value: "test",
						},
					},
				},
			}

			d, err := json.Marshal(expected)
			require.NoError(t, err)

			if tc.canUpdate {
				t.Run("should be able to update routing tree", func(t *testing.T) {
					updated, err := client.Update(ctx, expected, v1.UpdateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))

					expected = updated

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						up := expected.Copy().(*v0alpha1.RoutingTree)
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Error(t, err)
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to update routing tree", func(t *testing.T) {
					_, err := client.Update(ctx, expected, v1.UpdateOptions{})
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if resource does not exist", func(t *testing.T) {
						up := expected.Copy().(*v0alpha1.RoutingTree)
						up.Name = "notFound"
						_, err := client.Update(ctx, up, v1.UpdateOptions{})
						require.Error(t, err)
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			if tc.canUpdate {
				t.Run("should be able to reset routing tree", func(t *testing.T) {
					err := client.Delete(ctx, expected.Name, v1.DeleteOptions{})
					require.NoError(t, err)

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						err := client.Delete(ctx, "notfound", v1.DeleteOptions{})
						require.Error(t, err)
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to reset routing tree", func(t *testing.T) {
					err := client.Delete(ctx, expected.Name, v1.DeleteOptions{})
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should be forbidden even if resource does not exist", func(t *testing.T) {
						err := client.Delete(ctx, "notfound", v1.DeleteOptions{})
						require.Error(t, err)
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
				require.NoError(t, adminClient.Delete(ctx, expected.Name, v1.DeleteOptions{}))
			}
		})

		err := adminClient.Delete(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.DeleteOptions{})
		require.NoError(t, err)
	}
}

func TestIntegrationProvisioning(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	org := helper.Org1

	admin := org.Admin
	adminClient := common.NewRoutingTreeClient(t, admin)

	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles)
	db, err := store.ProvideDBStore(env.Cfg, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac, bus.ProvideBus(tracing.InitializeTracerForTest()))
	require.NoError(t, err)

	current, err := adminClient.Get(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, "none", current.GetProvenanceStatus())

	t.Run("should provide provenance status", func(t *testing.T) {
		require.NoError(t, db.SetProvenance(ctx, &definitions.Route{}, admin.Identity.GetOrgID(), "API"))

		got, err := adminClient.Get(ctx, current.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "API", got.GetProvenanceStatus())
	})
	t.Run("should not let update if provisioned", func(t *testing.T) {
		updated := current.Copy().(*v0alpha1.RoutingTree)
		updated.Spec.Routes = []v0alpha1.Route{
			{
				Matchers: []v0alpha1.Matcher{
					{
						Label: "test",
						Type:  v0alpha1.MatcherTypeNotEqual,
						Value: "123",
					},
				},
			},
		}

		_, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Error(t, err)
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})

	t.Run("should not let delete if provisioned", func(t *testing.T) {
		err := adminClient.Delete(ctx, current.Name, v1.DeleteOptions{})
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})
}

func TestIntegrationOptimisticConcurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	adminClient := common.NewRoutingTreeClient(t, helper.Org1.Admin)

	current, err := adminClient.Get(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.GetOptions{})
	require.NoError(t, err)
	require.NotEmpty(t, current.ResourceVersion)

	t.Run("should forbid if version does not match", func(t *testing.T) {
		updated := current.Copy().(*v0alpha1.RoutingTree)
		updated.ResourceVersion = "test"
		_, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.Error(t, err)
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err)
	})
	t.Run("should update if version matches", func(t *testing.T) {
		updated := current.Copy().(*v0alpha1.RoutingTree)
		updated.Spec.Defaults.GroupBy = append(updated.Spec.Defaults.GroupBy, "data")
		actualUpdated, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		require.EqualValues(t, updated.Spec, actualUpdated.Spec)
		require.NotEqual(t, updated.ResourceVersion, actualUpdated.ResourceVersion)
	})
	t.Run("should update if version is empty", func(t *testing.T) {
		current, err = adminClient.Get(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.GetOptions{})
		require.NoError(t, err)
		updated := current.Copy().(*v0alpha1.RoutingTree)
		updated.ResourceVersion = ""
		updated.Spec.Routes = append(updated.Spec.Routes, v0alpha1.Route{Continue: true})

		actualUpdated, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		require.EqualValues(t, updated.Spec, actualUpdated.Spec)
		require.NotEqual(t, current.ResourceVersion, actualUpdated.ResourceVersion)
	})
}

func TestIntegrationDataConsistency(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := getTestHelper(t)

	cliCfg := helper.Org1.Admin.NewRestConfig()
	legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	client := common.NewRoutingTreeClient(t, helper.Org1.Admin)

	receiver := "grafana-default-email"
	timeInterval := "test-time-interval"
	createRoute := func(t *testing.T, route definitions.Route) {
		t.Helper()
		routeClient := common.NewRoutingTreeClient(t, helper.Org1.Admin)
		v1Route, err := routingtree.ConvertToK8sResource(helper.Org1.Admin.Identity.GetOrgID(), route, "", func(int64) string { return "default" })
		require.NoError(t, err)
		_, err = routeClient.Update(ctx, v1Route, v1.UpdateOptions{})
		require.NoError(t, err)
	}

	_, err := common.NewTimeIntervalClient(t, helper.Org1.Admin).Create(ctx, &v0alpha1_timeinterval.TimeInterval{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1_timeinterval.Spec{
			Name:          timeInterval,
			TimeIntervals: fakes.IntervalGenerator{}.GenerateMany(1),
		},
	}, v1.CreateOptions{})
	require.NoError(t, err)

	var regex config.Regexp
	require.NoError(t, json.Unmarshal([]byte(`".*"`), &regex))

	ensureMatcher := func(t *testing.T, mt labels.MatchType, lbl, val string) *labels.Matcher {
		m, err := labels.NewMatcher(mt, lbl, val)
		require.NoError(t, err)
		return m
	}

	t.Run("all matchers are handled", func(t *testing.T) {
		t.Run("can read all legacy matchers", func(t *testing.T) {
			route := definitions.Route{
				Receiver: receiver,
				Routes: []*definitions.Route{
					{
						Match: map[string]string{
							"label_match": "test-123",
						},
						MatchRE: map[string]config.Regexp{
							"label_re": regex,
						},
						Matchers: config.Matchers{
							ensureMatcher(t, labels.MatchRegexp, "label_matchers", "test-321"),
						},
						ObjectMatchers: definitions.ObjectMatchers{
							ensureMatcher(t, labels.MatchNotRegexp, "object-label-matchers", "test-456"),
						},
					},
				},
			}
			createRoute(t, route)
			tree, err := client.Get(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.GetOptions{})
			require.NoError(t, err)
			expected := []v0alpha1.Matcher{
				{
					Label: "label_match",
					Type:  v0alpha1.MatcherTypeEqual,
					Value: "test-123",
				},
				{
					Label: "label_re",
					Type:  v0alpha1.MatcherTypeEqualRegex,
					Value: ".*",
				},
				{
					Label: "label_matchers",
					Type:  v0alpha1.MatcherTypeEqualRegex,
					Value: "test-321",
				},
				{
					Label: "object-label-matchers",
					Type:  v0alpha1.MatcherTypeNotEqualRegex,
					Value: "test-456",
				},
			}
			assert.ElementsMatch(t, expected, tree.Spec.Routes[0].Matchers)
		})
		t.Run("should save into ObjectMatchers", func(t *testing.T) {
			route := definitions.Route{
				Receiver: receiver,
				Routes: []*definitions.Route{
					{
						Match: map[string]string{
							"oldmatch": "123",
						},
					},
					{
						MatchRE: map[string]config.Regexp{
							"oldmatchre": regex,
						},
					},
					{
						Matchers: config.Matchers{
							ensureMatcher(t, labels.MatchNotEqual, "matchers", "v"),
						},
					},
					{
						ObjectMatchers: definitions.ObjectMatchers{
							ensureMatcher(t, labels.MatchEqual, "t2", "v2"),
						},
					},
				},
			}
			createRoute(t, route)
			cfg, _, _ := legacyCli.GetAlertmanagerConfigWithStatus(t)
			expectedRoutes := cfg.AlertmanagerConfig.Route.Routes // autogenerated route is the first one
			expectedRoutes[1].Match = nil
			expectedRoutes[1].ObjectMatchers = definitions.ObjectMatchers{
				ensureMatcher(t, labels.MatchEqual, "oldmatch", "123"),
			}
			expectedRoutes[2].MatchRE = nil
			expectedRoutes[2].ObjectMatchers = definitions.ObjectMatchers{
				ensureMatcher(t, labels.MatchRegexp, "oldmatchre", ".*"),
			}
			expectedRoutes[3].Matchers = nil
			expectedRoutes[3].ObjectMatchers = definitions.ObjectMatchers{
				ensureMatcher(t, labels.MatchNotEqual, "matchers", "v"),
			}

			tree, err := client.Get(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.GetOptions{})
			require.NoError(t, err)
			_, err = client.Update(ctx, tree, v1.UpdateOptions{})
			require.NoError(t, err)

			cfg, _, _ = legacyCli.GetAlertmanagerConfigWithStatus(t)
			routes := cfg.AlertmanagerConfig.Route.Routes
			require.EqualValues(t, expectedRoutes, routes)
		})
	})

	route := definitions.Route{
		Receiver:       receiver,
		GroupByStr:     []string{"test-123", "test-456"},
		GroupWait:      util.Pointer(model.Duration(30 * time.Second)),
		GroupInterval:  util.Pointer(model.Duration(1 * time.Minute)),
		RepeatInterval: util.Pointer(model.Duration(24 * time.Hour)),
		Routes: []*definitions.Route{
			{
				ObjectMatchers: definitions.ObjectMatchers{
					ensureMatcher(t, labels.MatchNotEqual, "m", "1"),
					ensureMatcher(t, labels.MatchEqual, "n", "1"),
					ensureMatcher(t, labels.MatchRegexp, "o", "1"),
					ensureMatcher(t, labels.MatchNotRegexp, "p", "1"),
				},
				Receiver:          receiver,
				GroupByStr:        []string{"test-789"},
				GroupWait:         util.Pointer(model.Duration(2 * time.Minute)),
				GroupInterval:     util.Pointer(model.Duration(5 * time.Minute)),
				RepeatInterval:    util.Pointer(model.Duration(30 * time.Hour)),
				MuteTimeIntervals: []string{timeInterval},
				Continue:          true,
			},
		},
	}
	createRoute(t, route)

	t.Run("correctly reads all fields", func(t *testing.T) {
		tree, err := client.Get(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, v0alpha1.RouteDefaults{
			Receiver:       receiver,
			GroupBy:        []string{"test-123", "test-456"},
			GroupWait:      util.Pointer("30s"),
			GroupInterval:  util.Pointer("1m"),
			RepeatInterval: util.Pointer("1d"),
		}, tree.Spec.Defaults)
		assert.Len(t, tree.Spec.Routes, 1)
		assert.Equal(t, v0alpha1.Route{
			Continue:          true,
			Receiver:          util.Pointer(receiver),
			GroupBy:           []string{"test-789"},
			GroupWait:         util.Pointer("2m"),
			GroupInterval:     util.Pointer("5m"),
			RepeatInterval:    util.Pointer("1d6h"),
			MuteTimeIntervals: []string{timeInterval},
			Matchers: []v0alpha1.Matcher{
				{
					Label: "m",
					Type:  v0alpha1.MatcherTypeNotEqual,
					Value: "1",
				},
				{
					Label: "n",
					Type:  v0alpha1.MatcherTypeEqual,
					Value: "1",
				},
				{
					Label: "o",
					Type:  v0alpha1.MatcherTypeEqualRegex,
					Value: "1",
				},
				{
					Label: "p",
					Type:  v0alpha1.MatcherTypeNotEqualRegex,
					Value: "1",
				},
			},
		}, tree.Spec.Routes[0])
	})

	t.Run("correctly save all fields", func(t *testing.T) {
		before, status, body := legacyCli.GetAlertmanagerConfigWithStatus(t)
		require.Equalf(t, http.StatusOK, status, body)
		tree, err := client.Get(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.GetOptions{})
		tree.Spec.Defaults.GroupBy = []string{"test-123", "test-456", "test-789"}
		require.NoError(t, err)
		_, err = client.Update(ctx, tree, v1.UpdateOptions{})
		require.NoError(t, err)

		before.AlertmanagerConfig.Route.GroupByStr = []string{"test-123", "test-456", "test-789"}
		before.AlertmanagerConfig.Route.GroupBy = []model.LabelName{"test-123", "test-456", "test-789"}

		after, status, body := legacyCli.GetAlertmanagerConfigWithStatus(t)
		require.Equalf(t, http.StatusOK, status, body)
		require.Equal(t, before, after)
	})

	t.Run("unicode support in groupBy and matchers", func(t *testing.T) {
		route := definitions.Route{
			Receiver: receiver,
			Routes: []*definitions.Route{
				{
					GroupByStr: []string{"foo🙂"},
					Matchers: config.Matchers{{
						Type:  labels.MatchEqual,
						Name:  "foo🙂",
						Value: "bar",
					}, {
						Type:  labels.MatchNotEqual,
						Name:  "_bar1",
						Value: "baz🙂",
					}, {
						Type:  labels.MatchRegexp,
						Name:  "0baz",
						Value: "[a-zA-Z0-9]+,?",
					}, {
						Type:  labels.MatchNotRegexp,
						Name:  "corge",
						Value: "^[0-9]+((,[0-9]{3})*(,[0-9]{0,3})?)?$",
					}},
					ObjectMatchers: definitions.ObjectMatchers{{
						Type:  labels.MatchEqual,
						Name:  "Προμηθέας", // Prometheus in Greek
						Value: "Prom",
					}, {
						Type:  labels.MatchNotEqual,
						Name:  "犬", // Dog in Japanese (inu)
						Value: "Shiba Inu",
					}},
				},
			},
		}

		createRoute(t, route)
		tree, err := client.Get(ctx, v0alpha1.UserDefinedRoutingTreeName, v1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, "foo🙂", tree.Spec.Routes[0].GroupBy[0])
		expected := []v0alpha1.Matcher{
			{Label: "foo🙂", Type: v0alpha1.MatcherTypeEqual, Value: "bar"},
			{Label: "_bar1", Type: v0alpha1.MatcherTypeNotEqual, Value: "baz🙂"},
			{Label: "0baz", Type: v0alpha1.MatcherTypeEqualRegex, Value: "[a-zA-Z0-9]+,?"},
			{Label: "corge", Type: v0alpha1.MatcherTypeNotEqualRegex, Value: "^[0-9]+((,[0-9]{3})*(,[0-9]{0,3})?)?$"},
			{Label: "Προμηθέας", Type: v0alpha1.MatcherTypeEqual, Value: "Prom"},
			{Label: "犬", Type: v0alpha1.MatcherTypeNotEqual, Value: "Shiba Inu"},
		}
		assert.ElementsMatch(t, expected, tree.Spec.Routes[0].Matchers)
	})
}
