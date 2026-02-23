package routingtree

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/routingtree"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	policy_exports "github.com/grafana/grafana/pkg/services/ngalert/api/test-data/policy-exports"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1/fakes"
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
	"github.com/grafana/grafana/pkg/util/testutil"
)

var defaultTreeIdentifier = resource.Identifier{
	Namespace: apis.DefaultNamespace,
	Name:      v0alpha1.UserDefinedRoutingTreeName,
}

var defaultPolicy = definitions.Route{
	Receiver:   "empty",
	GroupByStr: models.DefaultNotificationSettingsGroupBy,
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{})
}

func TestIntegrationNotAllowedMethods(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)
	client, err := v0alpha1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	route := &v0alpha1.RoutingTree{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.RoutingTreeSpec{},
	}
	_, err = client.Create(ctx, route, resource.CreateOptions{})
	var statusErr *errors.StatusError
	assert.ErrorAs(t, err, &statusErr)
	require.Equalf(t, int32(501), statusErr.Status().Code, "Expected NotImplemented (501) but got %s (%d)", statusErr.Status().Status, statusErr.Status().Code)
}

func TestIntegrationAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
	adminClient, err := v0alpha1.NewRoutingTreeClientFromGenerator(admin.GetClientRegistry())
	require.NoError(t, err)

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("user '%s'", tc.user.Identity.GetLogin()), func(t *testing.T) {
			client, err := v0alpha1.NewRoutingTreeClientFromGenerator(tc.user.GetClientRegistry())
			require.NoError(t, err)

			if tc.canRead {
				t.Run("should be able to list routing trees", func(t *testing.T) {
					list, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 1)
					require.Equal(t, v0alpha1.UserDefinedRoutingTreeName, list.Items[0].Name)
				})

				t.Run("should be able to read routing trees by resource identifier", func(t *testing.T) {
					_, err := client.Get(ctx, defaultTreeIdentifier)
					require.NoError(t, err)

					t.Run("should get NotFound if resource does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, resource.Identifier{Namespace: apis.DefaultNamespace, Name: "Notfound"})
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to list routing trees", func(t *testing.T) {
					_, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
				})

				t.Run("should be forbidden to read routing tree by name", func(t *testing.T) {
					_, err := client.Get(ctx, defaultTreeIdentifier)
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if name does not exist", func(t *testing.T) {
						_, err := client.Get(ctx, resource.Identifier{Namespace: apis.DefaultNamespace, Name: "Notfound"})
						require.Error(t, err)
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			current, err := adminClient.Get(ctx, defaultTreeIdentifier)
			require.NoError(t, err)
			expected := current.Copy().(*v0alpha1.RoutingTree)
			expected.Spec.Routes = []v0alpha1.RoutingTreeRoute{
				{
					Matchers: []v0alpha1.RoutingTreeMatcher{
						{
							Label: "test",
							Type:  v0alpha1.RoutingTreeMatcherTypeEqual,
							Value: "test",
						},
					},
				},
			}

			d, err := json.Marshal(expected)
			require.NoError(t, err)

			if tc.canUpdate {
				t.Run("should be able to update routing tree", func(t *testing.T) {
					updated, err := client.Update(ctx, expected, resource.UpdateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))

					expected = updated

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						up := expected.Copy().(*v0alpha1.RoutingTree)
						up.Name = "notFound"
						_, err := client.Update(ctx, up, resource.UpdateOptions{})
						require.Error(t, err)
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to update routing tree", func(t *testing.T) {
					_, err := client.Update(ctx, expected, resource.UpdateOptions{})
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if resource does not exist", func(t *testing.T) {
						up := expected.Copy().(*v0alpha1.RoutingTree)
						up.Name = "notFound"
						_, err := client.Update(ctx, up, resource.UpdateOptions{
							ResourceVersion: up.ResourceVersion,
						})
						require.Error(t, err)
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			if tc.canUpdate {
				t.Run("should be able to reset routing tree", func(t *testing.T) {
					err := client.Delete(ctx, expected.GetStaticMetadata().Identifier(), resource.DeleteOptions{})
					require.NoError(t, err)

					t.Run("should get NotFound if name does not exist", func(t *testing.T) {
						err := client.Delete(ctx, resource.Identifier{Namespace: apis.DefaultNamespace, Name: "notfound"}, resource.DeleteOptions{})
						require.Error(t, err)
						require.Truef(t, errors.IsNotFound(err), "Should get NotFound error but got: %s", err)
					})
				})
			} else {
				t.Run("should be forbidden to reset routing tree", func(t *testing.T) {
					err := client.Delete(ctx, expected.GetStaticMetadata().Identifier(), resource.DeleteOptions{})
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should be forbidden even if resource does not exist", func(t *testing.T) {
						err := client.Delete(ctx, resource.Identifier{Namespace: apis.DefaultNamespace, Name: "notfound"}, resource.DeleteOptions{})
						require.Error(t, err)
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
				require.NoError(t, adminClient.Delete(ctx, expected.GetStaticMetadata().Identifier(), resource.DeleteOptions{}))
			}
		})

		err := adminClient.Delete(ctx, defaultTreeIdentifier, resource.DeleteOptions{})
		require.NoError(t, err)
	}
}

func TestIntegrationProvisioning(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)

	org := helper.Org1

	admin := org.Admin
	adminClient, err := v0alpha1.NewRoutingTreeClientFromGenerator(admin.GetClientRegistry())
	require.NoError(t, err)

	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles)
	db, err := store.ProvideDBStore(env.Cfg, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac, bus.ProvideBus(tracing.InitializeTracerForTest()))
	require.NoError(t, err)

	current, err := adminClient.Get(ctx, defaultTreeIdentifier)
	require.NoError(t, err)
	require.Equal(t, "none", current.GetProvenanceStatus())

	t.Run("should provide provenance status", func(t *testing.T) {
		require.NoError(t, db.SetProvenance(ctx, &definitions.Route{}, admin.Identity.GetOrgID(), "API"))

		got, err := adminClient.Get(ctx, current.GetStaticMetadata().Identifier())
		require.NoError(t, err)
		require.Equal(t, "API", got.GetProvenanceStatus())
	})
	t.Run("should not let update if provisioned", func(t *testing.T) {
		updated := current.Copy().(*v0alpha1.RoutingTree)
		updated.Spec.Routes = []v0alpha1.RoutingTreeRoute{
			{
				Matchers: []v0alpha1.RoutingTreeMatcher{
					{
						Label: "test",
						Type:  v0alpha1.RoutingTreeMatcherTypeNotEqual,
						Value: "123",
					},
				},
			},
		}

		_, err := adminClient.Update(ctx, updated, resource.UpdateOptions{})
		require.Error(t, err)
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})

	t.Run("should not let delete if provisioned", func(t *testing.T) {
		err := adminClient.Delete(ctx, current.GetStaticMetadata().Identifier(), resource.DeleteOptions{})
		require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
	})
}

func TestIntegrationOptimisticConcurrency(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)

	adminClient, err := v0alpha1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	current, err := adminClient.Get(ctx, defaultTreeIdentifier)
	require.NoError(t, err)
	require.NotEmpty(t, current.ResourceVersion)

	t.Run("should forbid if version does not match", func(t *testing.T) {
		updated := current.Copy().(*v0alpha1.RoutingTree)
		_, err := adminClient.Update(ctx, updated, resource.UpdateOptions{
			ResourceVersion: "test",
		})
		require.Error(t, err)
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err)
	})
	t.Run("should update if version matches", func(t *testing.T) {
		updated := current.Copy().(*v0alpha1.RoutingTree)
		updated.Spec.Defaults.GroupBy = append(updated.Spec.Defaults.GroupBy, "data")
		actualUpdated, err := adminClient.Update(ctx, updated, resource.UpdateOptions{})
		require.NoError(t, err)
		require.EqualValues(t, updated.Spec, actualUpdated.Spec)
		require.NotEqual(t, updated.ResourceVersion, actualUpdated.ResourceVersion)
	})
	t.Run("should update if version is empty", func(t *testing.T) {
		current, err = adminClient.Get(ctx, defaultTreeIdentifier)
		require.NoError(t, err)
		updated := current.Copy().(*v0alpha1.RoutingTree)
		updated.ResourceVersion = ""
		updated.Spec.Routes = append(updated.Spec.Routes, v0alpha1.RoutingTreeRoute{Continue: true})

		actualUpdated, err := adminClient.Update(ctx, updated, resource.UpdateOptions{})
		require.NoError(t, err)
		require.EqualValues(t, updated.Spec, actualUpdated.Spec)
		require.NotEqual(t, current.ResourceVersion, actualUpdated.ResourceVersion)
	})
}

func TestIntegrationDataConsistency(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)

	cliCfg := helper.Org1.Admin.NewRestConfig()
	legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	client, err := v0alpha1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	receiver := "empty"
	timeInterval := "test-time-interval"
	createRoute := func(t *testing.T, route definitions.Route) {
		t.Helper()
		routeClient, err := v0alpha1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
		require.NoError(t, err)
		managedRoute := legacy_storage.NewManagedRoute(v0alpha1.UserDefinedRoutingTreeName, &route)
		managedRoute.Version = "" // Avoid version conflict.
		v1Route, err := routingtree.ConvertToK8sResource(helper.Org1.Admin.Identity.GetOrgID(), managedRoute, func(int64) string { return "default" })
		require.NoError(t, err)
		_, err = routeClient.Update(ctx, v1Route, resource.UpdateOptions{})
		require.NoError(t, err)
	}

	_, err = common.NewTimeIntervalClient(t, helper.Org1.Admin).Create(ctx, &v0alpha1.TimeInterval{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.TimeIntervalSpec{
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
			tree, err := client.Get(ctx, defaultTreeIdentifier)
			require.NoError(t, err)
			expected := []v0alpha1.RoutingTreeMatcher{
				{
					Label: "label_match",
					Type:  v0alpha1.RoutingTreeMatcherTypeEqual,
					Value: "test-123",
				},
				{
					Label: "label_re",
					Type:  v0alpha1.RoutingTreeMatcherTypeEqualRegex,
					Value: ".*",
				},
				{
					Label: "label_matchers",
					Type:  v0alpha1.RoutingTreeMatcherTypeEqualRegex,
					Value: "test-321",
				},
				{
					Label: "object-label-matchers",
					Type:  v0alpha1.RoutingTreeMatcherTypeNotEqualRegex,
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

			tree, err := client.Get(ctx, defaultTreeIdentifier)
			require.NoError(t, err)
			_, err = client.Update(ctx, tree, resource.UpdateOptions{})
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
				Receiver:            receiver,
				GroupByStr:          []string{"test-789"},
				GroupWait:           util.Pointer(model.Duration(2 * time.Minute)),
				GroupInterval:       util.Pointer(model.Duration(5 * time.Minute)),
				RepeatInterval:      util.Pointer(model.Duration(30 * time.Hour)),
				MuteTimeIntervals:   []string{timeInterval},
				ActiveTimeIntervals: []string{timeInterval},
				Continue:            true,
			},
		},
	}
	createRoute(t, route)

	t.Run("correctly reads all fields", func(t *testing.T) {
		tree, err := client.Get(ctx, defaultTreeIdentifier)
		require.NoError(t, err)
		assert.Equal(t, v0alpha1.RoutingTreeRouteDefaults{
			Receiver:       receiver,
			GroupBy:        []string{"test-123", "test-456"},
			GroupWait:      util.Pointer("30s"),
			GroupInterval:  util.Pointer("1m"),
			RepeatInterval: util.Pointer("1d"),
		}, tree.Spec.Defaults)
		assert.Len(t, tree.Spec.Routes, 1)
		assert.Equal(t, v0alpha1.RoutingTreeRoute{
			Continue:            true,
			Receiver:            util.Pointer(receiver),
			GroupBy:             []string{"test-789"},
			GroupWait:           util.Pointer("2m"),
			GroupInterval:       util.Pointer("5m"),
			RepeatInterval:      util.Pointer("1d6h"),
			MuteTimeIntervals:   []string{timeInterval},
			ActiveTimeIntervals: []string{timeInterval},
			Matchers: []v0alpha1.RoutingTreeMatcher{
				{
					Label: "m",
					Type:  v0alpha1.RoutingTreeMatcherTypeNotEqual,
					Value: "1",
				},
				{
					Label: "n",
					Type:  v0alpha1.RoutingTreeMatcherTypeEqual,
					Value: "1",
				},
				{
					Label: "o",
					Type:  v0alpha1.RoutingTreeMatcherTypeEqualRegex,
					Value: "1",
				},
				{
					Label: "p",
					Type:  v0alpha1.RoutingTreeMatcherTypeNotEqualRegex,
					Value: "1",
				},
			},
		}, tree.Spec.Routes[0])
	})

	t.Run("correctly save all fields", func(t *testing.T) {
		before, status, body := legacyCli.GetAlertmanagerConfigWithStatus(t)
		require.Equalf(t, http.StatusOK, status, body)
		tree, err := client.Get(ctx, defaultTreeIdentifier)
		tree.Spec.Defaults.GroupBy = []string{"test-123", "test-456", "test-789"}
		require.NoError(t, err)
		_, err = client.Update(ctx, tree, resource.UpdateOptions{})
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
		tree, err := client.Get(ctx, defaultTreeIdentifier)
		require.NoError(t, err)
		assert.Equal(t, "foo🙂", tree.Spec.Routes[0].GroupBy[0])
		expected := []v0alpha1.RoutingTreeMatcher{
			{Label: "foo🙂", Type: v0alpha1.RoutingTreeMatcherTypeEqual, Value: "bar"},
			{Label: "_bar1", Type: v0alpha1.RoutingTreeMatcherTypeNotEqual, Value: "baz🙂"},
			{Label: "0baz", Type: v0alpha1.RoutingTreeMatcherTypeEqualRegex, Value: "[a-zA-Z0-9]+,?"},
			{Label: "corge", Type: v0alpha1.RoutingTreeMatcherTypeNotEqualRegex, Value: "^[0-9]+((,[0-9]{3})*(,[0-9]{0,3})?)?$"},
			{Label: "Προμηθέας", Type: v0alpha1.RoutingTreeMatcherTypeEqual, Value: "Prom"},
			{Label: "犬", Type: v0alpha1.RoutingTreeMatcherTypeNotEqual, Value: "Shiba Inu"},
		}
		assert.ElementsMatch(t, expected, tree.Spec.Routes[0].Matchers)
	})
}

func TestIntegrationExtraConfigsConflicts(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"alertingImportAlertmanagerAPI"},
	})

	cliCfg := helper.Org1.Admin.NewRestConfig()
	legacyCli := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	client, err := v0alpha1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	// Now upload a new extra config
	testAlertmanagerConfigYAML := `
route:
  receiver: default

receivers:
- name: default
  webhook_configs:
  - url: 'http://localhost/webhook'
`

	headers := map[string]string{
		"Content-Type":                         "application/yaml",
		"X-Grafana-Alerting-Config-Identifier": "external-system",
		"X-Grafana-Alerting-Merge-Matchers":    "imported=true",
	}

	// Post the configuration to Grafana
	response := legacyCli.ConvertPrometheusPostAlertmanagerConfig(t, definitions.AlertmanagerUserConfig{
		AlertmanagerConfig: testAlertmanagerConfigYAML,
	}, headers)
	require.Equal(t, "success", response.Status)

	current, err := client.Get(ctx, defaultTreeIdentifier)
	require.NoError(t, err)
	updated := current.Copy().(*v0alpha1.RoutingTree)
	updated.Spec.Routes = append(updated.Spec.Routes, v0alpha1.RoutingTreeRoute{
		Matchers: []v0alpha1.RoutingTreeMatcher{
			{
				Label: "imported",
				Type:  v0alpha1.RoutingTreeMatcherTypeEqual,
				Value: "true",
			},
		},
	})

	_, err = client.Update(ctx, updated, resource.UpdateOptions{})
	require.Error(t, err)
	require.Truef(t, errors.IsBadRequest(err), "Should get BadRequest error but got: %s", err)

	// Now delete extra config
	legacyCli.ConvertPrometheusDeleteAlertmanagerConfig(t, headers)

	// and try again
	_, err = client.Update(ctx, updated, resource.UpdateOptions{})
	require.NoError(t, err)
}

func TestIntegrationMultipleRoutesCRUD(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{featuremgmt.FlagAlertingMultiplePolicies},
	})

	org1 := helper.Org1
	admin := org1.Admin
	adminClient, err := v0alpha1.NewRoutingTreeClientFromGenerator(admin.GetClientRegistry())
	require.NoError(t, err)

	env := helper.GetEnv()
	ac := acimpl.ProvideAccessControl(env.FeatureToggles)
	db, err := store.ProvideDBStore(env.Cfg, env.FeatureToggles, env.SQLStore, &foldertest.FakeService{}, &dashboards.FakeDashboardService{}, ac, bus.ProvideBus(tracing.InitializeTracerForTest()))
	require.NoError(t, err)

	nameToIdentifier := func(name string) resource.Identifier {
		return resource.Identifier{
			Namespace: apis.DefaultNamespace,
			Name:      name,
		}
	}

	// Prep config so that referenced receivers and time intervals exist.
	cfg := policy_exports.Config()
	createReceiverStubs(t, admin, cfg.AlertmanagerConfig.Receivers)
	createTimeIntervalStubs(t, admin, cfg.AlertmanagerConfig.TimeIntervals)

	// Sanity check there aren't any existing managed routes other than the default.
	list, err := adminClient.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
	require.NoError(t, err)
	require.Len(t, list.Items, 1)
	require.Equal(t, v0alpha1.UserDefinedRoutingTreeName, list.Items[0].Name)

	validateGetErr := func(t *testing.T, name string, expectedErrReason v1.StatusReason) {
		t.Helper()
		_, err := adminClient.Get(ctx, nameToIdentifier(name))
		require.Error(t, err)
		require.Equal(t, expectedErrReason, errors.ReasonForError(err))
	}

	validateGetEqual := func(t *testing.T, name string, expectedRoute *v0alpha1.RoutingTree) {
		t.Helper()
		gotRoute, err := adminClient.Get(ctx, nameToIdentifier(name))
		require.NoError(t, err)
		assert.Equal(t, expectedRoute, gotRoute)
	}

	t.Run("Create", func(t *testing.T) {
		// Create -> Get various pre-defined routes.
		for name, route := range cfg.ManagedRoutes {
			t.Run(fmt.Sprintf("Create policy %s", name), func(t *testing.T) {
				createdRoute, err := adminClient.Create(ctx, k8sRoute(t, name, route), resource.CreateOptions{})
				require.NoError(t, err)

				validateGetEqual(t, name, createdRoute)
			})
		}

		t.Run("Create default policy fails", func(t *testing.T) {
			// Attempting to create a route with name UserDefinedRoutingTreeName fails.
			_, err = adminClient.Create(ctx, k8sRoute(t, v0alpha1.UserDefinedRoutingTreeName, &defaultPolicy), resource.CreateOptions{})
			require.Error(t, err)
		})

		t.Run("Get Default Policy", func(t *testing.T) {
			validateGetEqual(t, v0alpha1.UserDefinedRoutingTreeName, k8sRoute(t, v0alpha1.UserDefinedRoutingTreeName, &defaultPolicy))
		})
	})

	resetPolicies := func(t *testing.T) map[string]*v0alpha1.RoutingTree {
		t.Helper()
		// Delete/reset any remaining routes.
		for name := range cfg.ManagedRoutes {
			_ = db.SetProvenance(ctx, legacy_storage.NewManagedRoute(name, &definitions.Route{}), org1.OrgID, "") // Just in case it was provisioned.
			_ = adminClient.Delete(ctx, nameToIdentifier(name), resource.DeleteOptions{})
		}
		_ = db.SetProvenance(ctx, legacy_storage.NewManagedRoute(v0alpha1.UserDefinedRoutingTreeName, &definitions.Route{}), org1.OrgID, "")
		_ = adminClient.Delete(ctx, nameToIdentifier(v0alpha1.UserDefinedRoutingTreeName), resource.DeleteOptions{})

		// Recreate them.
		created := make(map[string]*v0alpha1.RoutingTree, len(cfg.ManagedRoutes))
		for name, route := range cfg.ManagedRoutes {
			c, err := adminClient.Create(ctx, k8sRoute(t, name, route), resource.CreateOptions{})
			require.NoError(t, err)
			created[name] = c
		}
		return created
	}

	t.Run("Provisioned Get should include provenance", func(t *testing.T) {
		allCreatedRoutes := resetPolicies(t)
		allCreatedRoutes[v0alpha1.UserDefinedRoutingTreeName] = k8sRoute(t, v0alpha1.UserDefinedRoutingTreeName, &defaultPolicy)

		for name, route := range allCreatedRoutes {
			require.NoError(t, db.SetProvenance(ctx, legacy_storage.NewManagedRoute(name, &definitions.Route{}), org1.OrgID, "API"))

			t.Run(fmt.Sprintf("Policy %s", name), func(t *testing.T) {
				got, err := adminClient.Get(ctx, nameToIdentifier(name))
				require.NoError(t, err)
				expected := route.Copy().(*v0alpha1.RoutingTree)
				expected.SetProvenanceStatus("API")
				assert.Equal(t, expected, got)
			})
		}
	})

	t.Run("List", func(t *testing.T) {
		allCreatedRoutes := resetPolicies(t)
		// List all routes and validate again.
		list, err = adminClient.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
		require.NoError(t, err)
		assert.Len(t, list.Items, len(cfg.ManagedRoutes)+1)
		t.Run("Includes all managed routes ", func(t *testing.T) {
			expectedRoutes := make([]v0alpha1.RoutingTree, 0, len(cfg.ManagedRoutes)+1)
			for _, route := range allCreatedRoutes {
				expectedRoutes = append(expectedRoutes, *route)
			}
			expectedRoutes = append(expectedRoutes, *k8sRoute(t, v0alpha1.UserDefinedRoutingTreeName, &defaultPolicy))

			for i := range expectedRoutes {
				expectedRoutes[i].TypeMeta = v1.TypeMeta{} // List does not include this information.
			}
			assert.ElementsMatch(t, expectedRoutes, list.Items)
		})
		t.Run("Default policy last", func(t *testing.T) {
			assert.Equal(t, v0alpha1.UserDefinedRoutingTreeName, list.Items[len(cfg.ManagedRoutes)].Name)
		})
	})

	t.Run("Update", func(t *testing.T) {
		policies := resetPolicies(t)
		policies[v0alpha1.UserDefinedRoutingTreeName] = k8sRoute(t, v0alpha1.UserDefinedRoutingTreeName, policy_exports.Legacy())

		// Update all policies to the same definition.
		currentVersion := ""
		t.Run("Empty ResourceVersion should succeed", func(t *testing.T) {
			for name := range policies {
				t.Run(fmt.Sprintf("Policy %s", name), func(t *testing.T) {
					// Empty version should pass
					updatedRoute, err := adminClient.Update(ctx, k8sRoute(t, name, policy_exports.OverrideInherit()), resource.UpdateOptions{ResourceVersion: ""})
					require.NoError(t, err)

					validateGetEqual(t, name, updatedRoute)
					currentVersion = updatedRoute.ResourceVersion
				})
			}
		})

		t.Run("Incorrect ResourceVersion should fail with conflict", func(t *testing.T) {
			for name := range policies {
				t.Run(fmt.Sprintf("Policy %s", name), func(t *testing.T) {
					// Incorrect Version should throw conflict.
					_, err := adminClient.Update(ctx, k8sRoute(t, name, policy_exports.DeeplyNested()), resource.UpdateOptions{ResourceVersion: "incorrect-version"})
					require.Truef(t, errors.IsConflict(err), "Should get Conflict error but got: %s", err)
				})
			}
		})

		// Update them back to their correct definitions.
		t.Run("Correct ResourceVersion should succeed", func(t *testing.T) {
			for name, route := range policies {
				t.Run(fmt.Sprintf("Policy %s", name), func(t *testing.T) {
					// Actual version.
					updatedRoute, err := adminClient.Update(ctx, route.Copy().(*v0alpha1.RoutingTree), resource.UpdateOptions{ResourceVersion: currentVersion})
					require.NoError(t, err)
					policies[name] = updatedRoute

					validateGetEqual(t, name, updatedRoute)
				})
			}
		})

		t.Run("Update on provisioned should fail", func(t *testing.T) {
			for name := range policies {
				t.Run(fmt.Sprintf("Policy %s", name), func(t *testing.T) {
					require.NoError(t, db.SetProvenance(ctx, legacy_storage.NewManagedRoute(name, &definitions.Route{}), org1.OrgID, "API"))

					_, err := adminClient.Update(ctx, k8sRoute(t, name, policy_exports.Empty()), resource.UpdateOptions{ResourceVersion: ""}) // Bypass version check.
					require.Error(t, err)
					require.ErrorContains(t, err, "provenance")
				})
			}
		})
	})

	t.Run("Delete", func(t *testing.T) {
		policies := resetPolicies(t)
		policies[v0alpha1.UserDefinedRoutingTreeName] = k8sRoute(t, v0alpha1.UserDefinedRoutingTreeName, &defaultPolicy)

		for name, route := range policies {
			t.Run(fmt.Sprintf("Policy %s", name), func(t *testing.T) {
				t.Run("Incorrect ResourceVersion should fail with conflict", func(t *testing.T) {
					// Incorrect Version should throw conflict.
					err := adminClient.Delete(ctx, nameToIdentifier(name), resource.DeleteOptions{Preconditions: resource.DeleteOptionsPreconditions{ResourceVersion: "incorrect-version"}})
					require.Truef(t, errors.IsConflict(err), "Should get Conflict error but got: %s", err)
				})

				t.Run("Delete provisioned should fail", func(t *testing.T) {
					require.NoError(t, db.SetProvenance(ctx, legacy_storage.NewManagedRoute(name, &definitions.Route{}), org1.OrgID, "API"))

					err := adminClient.Delete(ctx, nameToIdentifier(name), resource.DeleteOptions{Preconditions: resource.DeleteOptionsPreconditions{ResourceVersion: ""}})
					assert.Error(t, err)
					assert.ErrorContains(t, err, "provenance")

					// Reset provenance.
					require.NoError(t, db.SetProvenance(ctx, legacy_storage.NewManagedRoute(name, &definitions.Route{}), org1.OrgID, ""))
				})

				t.Run("Correct ResourceVersion should succeed", func(t *testing.T) {
					err := adminClient.Delete(ctx, nameToIdentifier(name), resource.DeleteOptions{Preconditions: resource.DeleteOptionsPreconditions{ResourceVersion: route.ResourceVersion}})
					require.NoError(t, err)
					if name == v0alpha1.UserDefinedRoutingTreeName {
						validateGetEqual(t, name, k8sRoute(t, v0alpha1.UserDefinedRoutingTreeName, &defaultPolicy)) // Default policy only resets, it doesn't delete.
					} else {
						validateGetErr(t, name, v1.StatusReasonNotFound)
					}
				})

				// Recreate so we can delete again using the empty ResourceVersion.
				_, _ = adminClient.Create(ctx, route, resource.CreateOptions{}) // Not necessary to check error here, downstream will catch.

				t.Run("Empty ResourceVersion should succeed", func(t *testing.T) {
					err := adminClient.Delete(ctx, nameToIdentifier(name), resource.DeleteOptions{Preconditions: resource.DeleteOptionsPreconditions{ResourceVersion: ""}})
					require.NoError(t, err)
					if name == v0alpha1.UserDefinedRoutingTreeName {
						validateGetEqual(t, name, k8sRoute(t, v0alpha1.UserDefinedRoutingTreeName, &defaultPolicy)) // Default policy only resets, it doesn't delete.
					} else {
						validateGetErr(t, name, v1.StatusReasonNotFound)
					}
				})
			})
		}
	})
}

func TestIntegrationMultipleRoutesReferentialIntegrity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{featuremgmt.FlagAlertingMultiplePolicies},
	})

	org1 := helper.Org1
	admin := org1.Admin
	adminClient, err := v0alpha1.NewRoutingTreeClientFromGenerator(admin.GetClientRegistry())
	require.NoError(t, err)

	// Prep config so that referenced receivers and time intervals exist.
	cfg := policy_exports.Config()
	receivers := createReceiverStubs(t, admin, cfg.AlertmanagerConfig.Receivers)
	timeIntervals := createTimeIntervalStubs(t, admin, cfg.AlertmanagerConfig.TimeIntervals)

	recv0 := cfg.AlertmanagerConfig.Receivers[0].Name
	recv1 := cfg.AlertmanagerConfig.Receivers[1].Name
	ti0 := cfg.AlertmanagerConfig.TimeIntervals[0].Name
	ti1 := cfg.AlertmanagerConfig.TimeIntervals[1].Name

	// Create routes that reference the receivers and time intervals.
	routeDef := definitions.Route{
		Receiver: recv0,
		Routes: []*definitions.Route{{
			Receiver:            recv1,
			MuteTimeIntervals:   []string{ti0},
			ActiveTimeIntervals: []string{ti1},
		}},
	}
	// Default route.
	_, err = adminClient.Update(ctx, k8sRoute(t, v0alpha1.UserDefinedRoutingTreeName, &routeDef), resource.UpdateOptions{})
	require.NoError(t, err)

	// Named route.
	_, err = adminClient.Create(ctx, k8sRoute(t, "named route", &routeDef), resource.CreateOptions{})
	require.NoError(t, err)

	// Update the receivers, then ensure the references are updated.
	t.Run("Update receivers references", func(t *testing.T) {
		recvClient, err := v0alpha1.NewReceiverClientFromGenerator(admin.GetClientRegistry())
		require.NoError(t, err)
		updatedName := func(name string) string {
			return fmt.Sprintf("%s-updatedbytest", name)
		}
		for oldName, recv := range receivers {
			assert.Equal(t, oldName, recv.Spec.Title)

			cp := recv.Copy().(*v0alpha1.Receiver)
			cp.Spec.Title = updatedName(oldName)
			updatedRecv, err := recvClient.Update(ctx, cp, resource.UpdateOptions{})
			require.NoError(t, err)

			// Validate that the receiver name actually updated.
			got, err := recvClient.Get(ctx, updatedRecv.GetStaticMetadata().Identifier())
			require.NoError(t, err)
			assert.Equalf(t, updatedName(oldName), got.Spec.Title, "expected receiver name to be updated")
		}

		list, err := adminClient.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
		require.NoError(t, err)

		assert.Len(t, list.Items, 2)
		for _, route := range list.Items {
			// Ensure receivers are updated according to spec.
			assert.Equal(t, updatedName(recv0), route.Spec.Defaults.Receiver)
			assert.Equal(t, updatedName(recv1), *route.Spec.Routes[0].Receiver)
		}
	})

	// Update the time intervals, then ensure the references are updated.
	t.Run("Update time interval references", func(t *testing.T) {
		timeIntervalClient, err := v0alpha1.NewTimeIntervalClientFromGenerator(admin.GetClientRegistry())
		require.NoError(t, err)

		updatedName := func(name string) string {
			return fmt.Sprintf("%s-updatedbytest", name)
		}
		for oldName, ti := range timeIntervals {
			assert.Equal(t, oldName, ti.Spec.Name)

			cp := ti.Copy().(*v0alpha1.TimeInterval)
			cp.Spec.Name = updatedName(oldName)
			updatedTi, err := timeIntervalClient.Update(ctx, cp, resource.UpdateOptions{})
			require.NoError(t, err)

			// Validate that the time interval name actually updated.
			got, err := timeIntervalClient.Get(ctx, updatedTi.GetStaticMetadata().Identifier())
			require.NoError(t, err)
			assert.Equalf(t, updatedName(oldName), got.Spec.Name, "expected time interval name to be updated")
		}

		list, err := adminClient.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
		require.NoError(t, err)

		assert.Len(t, list.Items, 2)
		for _, route := range list.Items {
			// Ensure receivers are updated according to spec.
			assert.Equal(t, updatedName(ti0), route.Spec.Routes[0].MuteTimeIntervals[0])
			assert.Equal(t, updatedName(ti1), route.Spec.Routes[0].ActiveTimeIntervals[0])
		}
	})
}

func k8sRoute(t *testing.T, name string, r *definitions.Route) *v0alpha1.RoutingTree {
	err := r.Validate()
	require.NoError(t, err)
	managedRoute := legacy_storage.NewManagedRoute(name, r)
	v1Route, err := routingtree.ConvertToK8sResource(-1, managedRoute, func(int64) string { return apis.DefaultNamespace })
	require.NoError(t, err)
	v1Route.TypeMeta = v1.TypeMeta{
		Kind:       v0alpha1.RoutingTreeKind().Kind(),
		APIVersion: v0alpha1.GroupVersion.Identifier(),
	}
	return v1Route
}

func createReceiverStubs(t *testing.T, user apis.User, receivers []*definitions.PostableApiReceiver) map[string]*v0alpha1.Receiver {
	receiverClient, err := v0alpha1.NewReceiverClientFromGenerator(user.GetClientRegistry())
	require.NoError(t, err)

	res := make(map[string]*v0alpha1.Receiver, len(receivers))
	for _, receiver := range receivers {
		created, err := receiverClient.Create(context.Background(), &v0alpha1.Receiver{
			ObjectMeta: v1.ObjectMeta{Namespace: apis.DefaultNamespace},
			Spec:       v0alpha1.ReceiverSpec{Title: receiver.Name, Integrations: []v0alpha1.ReceiverIntegration{}},
		}, resource.CreateOptions{})
		require.NoError(t, err)
		res[receiver.Name] = created
	}
	return res
}

func createTimeIntervalStubs(t *testing.T, user apis.User, timeIntervals []config.TimeInterval) map[string]*v0alpha1.TimeInterval {
	timeIntervalClient, err := v0alpha1.NewTimeIntervalClientFromGenerator(user.GetClientRegistry())
	require.NoError(t, err)

	res := make(map[string]*v0alpha1.TimeInterval, len(timeIntervals))
	for _, ti := range timeIntervals {
		created, err := timeIntervalClient.Create(context.Background(), &v0alpha1.TimeInterval{
			ObjectMeta: v1.ObjectMeta{Namespace: apis.DefaultNamespace},
			Spec:       v0alpha1.TimeIntervalSpec{Name: ti.Name},
		}, resource.CreateOptions{})
		require.NoError(t, err)
		res[ti.Name] = created
	}
	return res
}
