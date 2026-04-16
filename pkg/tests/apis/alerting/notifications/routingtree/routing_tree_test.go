package routingtree

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
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

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/routingtree"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	policy_exports "github.com/grafana/grafana/pkg/services/ngalert/api/test-data/policy-exports"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1/fakes"
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
	Name:      v1beta1.UserDefinedRoutingTreeName,
}

var defaultPolicy = definitions.Route{
	Receiver:   "empty",
	GroupByStr: models.DefaultNotificationSettingsGroupBy,
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingMultiplePolicies,
		},
	})
}

func TestIntegrationNotAllowedMethods(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableFeatureToggles: []string{featuremgmt.FlagAlertingMultiplePolicies},
	})

	client, err := v1beta1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	route := &v1beta1.RoutingTree{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v1beta1.RoutingTreeSpec{},
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
		user             apis.User
		canReadDefault   bool
		canUpdateDefault bool
		canRead          bool
		canUpdate        bool
		canDelete        bool
		canCreateNew     bool
	}

	legacyReader := helper.CreateUser("LegacyRoutesReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingRoutesRead,
			},
		},
	})
	legacyWriter := helper.CreateUser("LegacyRoutesWriter", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingRoutesRead,
				accesscontrol.ActionAlertingRoutesWrite,
			},
		},
	})
	none := helper.CreateUser("RoutesNone", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{})
	veryLegacyReader := helper.CreateUser("LegacyNotificaitonsReader", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsRead,
			},
		},
	})
	veryLegacyWriter := helper.CreateUser("LegacyNotificaitonsWriter", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingNotificationsRead,
				accesscontrol.ActionAlertingNotificationsWrite,
			},
		},
	})
	routesReader := helper.CreateUser("RoutesReader", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(accesscontrol.ActionAlertingManagedRoutesRead),
	})
	routesWriter := helper.CreateUser("RoutesWriter", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(accesscontrol.ActionAlertingManagedRoutesRead, accesscontrol.ActionAlertingManagedRoutesWrite, accesscontrol.ActionAlertingManagedRoutesDelete),
	})

	routesCreator := helper.CreateUser("RoutesCreator", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingManagedRoutesCreate,
			},
		},
	})

	testCases := []testCase{
		{
			user: none,
		},
		{
			user:             org1.Admin,
			canReadDefault:   true,
			canUpdateDefault: true,
			canRead:          true,
			canUpdate:        true,
			canDelete:        true,
			canCreateNew:     true,
		},
		{
			user:             org1.Editor,
			canReadDefault:   true,
			canUpdateDefault: true,
			canCreateNew:     true,
		},
		{
			user:           org1.Viewer,
			canReadDefault: true,
		},
		{
			user:           legacyReader,
			canReadDefault: true,
		},
		{
			user:             legacyWriter,
			canReadDefault:   true,
			canUpdateDefault: true,
		},
		{
			user:           veryLegacyReader,
			canReadDefault: true,
		},
		{
			user:             veryLegacyWriter,
			canReadDefault:   true,
			canUpdateDefault: true,
		},
		{
			user:           routesReader,
			canReadDefault: true,
			canRead:        true,
		},
		{
			user:             routesWriter,
			canReadDefault:   true,
			canUpdateDefault: true,
			canRead:          true,
			canUpdate:        true,
			canDelete:        true,
			canCreateNew:     false,
		},
		{
			user:             routesCreator,
			canReadDefault:   false,
			canUpdateDefault: false,
			canRead:          false,
			canUpdate:        false,
			canCreateNew:     true,
		},
	}

	admin := org1.Admin
	adminClient, err := v1beta1.NewRoutingTreeClientFromGenerator(admin.GetClientRegistry())
	require.NoError(t, err)

	forbiddenOrNotfound := func(predicate bool) string {
		if predicate {
			return "NotFound"
		}
		return "Forbidden"
	}

	assertForbiddenOrNotFound := func(t *testing.T, predicate bool, err error) {
		var matches bool
		if predicate {
			matches = errors.IsNotFound(err)
		} else {
			matches = errors.IsForbidden(err)
		}
		require.Truef(t, matches, "Should get %s error but got: %s", forbiddenOrNotfound(predicate), err)
	}

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("user '%s'", tc.user.Identity.GetLogin()), func(t *testing.T) {
			client, err := v1beta1.NewRoutingTreeClientFromGenerator(tc.user.GetClientRegistry())
			require.NoError(t, err)

			if tc.canReadDefault {
				t.Run("should be able to list routing trees", func(t *testing.T) {
					list, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
					require.NoError(t, err)
					require.Len(t, list.Items, 1)
					require.Equal(t, v1beta1.UserDefinedRoutingTreeName, list.Items[0].Name)
				})

				t.Run("should be able to read routing trees by resource identifier", func(t *testing.T) {
					_, err := client.Get(ctx, defaultTreeIdentifier)
					require.NoError(t, err)

					t.Run(fmt.Sprintf("should get %s if resource does not exist", forbiddenOrNotfound(tc.canRead)), func(t *testing.T) {
						_, err := client.Get(ctx, resource.Identifier{Namespace: apis.DefaultNamespace, Name: "Notfound"})
						assertForbiddenOrNotFound(t, tc.canRead, err)
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
			expected := current.Copy().(*v1beta1.RoutingTree)
			expected.Spec.Routes = []v1beta1.RoutingTreeRoute{
				{
					Matchers: []v1beta1.RoutingTreeMatcher{
						{
							Label: "test",
							Type:  v1beta1.RoutingTreeMatcherTypeEqual,
							Value: "test",
						},
					},
				},
			}

			d, err := json.Marshal(expected)
			require.NoError(t, err)

			if tc.canUpdateDefault {
				t.Run("should be able to update routing tree", func(t *testing.T) {
					updated, err := client.Update(ctx, expected, resource.UpdateOptions{})
					require.NoErrorf(t, err, "Payload %s", string(d))

					expected = updated
					t.Run(fmt.Sprintf("should get %s if name does not exist", forbiddenOrNotfound(tc.canUpdate)), func(t *testing.T) {
						up := expected.Copy().(*v1beta1.RoutingTree)
						up.Name = "notFound"
						_, err := client.Update(ctx, up, resource.UpdateOptions{})
						require.Error(t, err)
						assertForbiddenOrNotFound(t, tc.canUpdate, err)
					})
				})
			} else {
				t.Run("should be forbidden to update routing tree", func(t *testing.T) {
					_, err := client.Update(ctx, expected, resource.UpdateOptions{})
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)

					t.Run("should get forbidden even if resource does not exist", func(t *testing.T) {
						up := expected.Copy().(*v1beta1.RoutingTree)
						up.Name = "notFound"
						_, err := client.Update(ctx, up, resource.UpdateOptions{
							ResourceVersion: up.ResourceVersion,
						})
						require.Error(t, err)
						require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
					})
				})
			}

			if tc.canUpdateDefault {
				t.Run("should be able to reset routing tree", func(t *testing.T) {
					err := client.Delete(ctx, expected.GetStaticMetadata().Identifier(), resource.DeleteOptions{})
					require.NoError(t, err)

					t.Run(fmt.Sprintf("should get %s if name does not exist", forbiddenOrNotfound(tc.canDelete)), func(t *testing.T) {
						err := client.Delete(ctx, resource.Identifier{Namespace: apis.DefaultNamespace, Name: "notfound"}, resource.DeleteOptions{})
						require.Error(t, err)
						assertForbiddenOrNotFound(t, tc.canDelete, err)
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

			newTree := &v1beta1.RoutingTree{
				ObjectMeta: v1.ObjectMeta{
					Name:      fmt.Sprintf("new-tree-%s", tc.user.Identity.GetLogin()),
					Namespace: apis.DefaultNamespace,
				},
				Spec: v1beta1.RoutingTreeSpec{
					Defaults: v1beta1.RoutingTreeRouteDefaults{
						Receiver: current.Spec.Defaults.Receiver,
					},
				},
			}

			if tc.canCreateNew {
				t.Run("should be able to create new routing tree", func(t *testing.T) {
					tree, err := client.Create(ctx, newTree, resource.CreateOptions{})
					require.NoError(t, err)
					t.Run("should be able to read new routing tree", func(t *testing.T) {
						tree, err = client.Get(ctx, tree.GetStaticMetadata().Identifier())
						require.NoError(t, err)
					})
					t.Run("should be able to update routing tree", func(t *testing.T) {
						up := tree.Copy().(*v1beta1.RoutingTree)
						up.Spec.Routes = []v1beta1.RoutingTreeRoute{
							{
								Matchers: []v1beta1.RoutingTreeMatcher{
									{
										Label: "test",
										Type:  v1beta1.RoutingTreeMatcherTypeEqual,
										Value: "test",
									},
								},
							},
						}
						_, err := client.Update(ctx, up, resource.UpdateOptions{})
						require.NoError(t, err)
					})
					t.Run("should be able to delete new routing tree", func(t *testing.T) {
						err := client.Delete(ctx, tree.GetStaticMetadata().Identifier(), resource.DeleteOptions{})
						require.NoError(t, err)
					})
				})
			} else {
				t.Run("should be forbidden to create new routing tree", func(t *testing.T) {
					_, err := client.Create(ctx, newTree, resource.CreateOptions{})
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
				})
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

	// writer has resource write actions but NO provenance set-status permission.
	writer := helper.CreateUser("RoutingTreeWriter", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingRoutesRead,
				accesscontrol.ActionAlertingRoutesWrite,
			},
		},
	})
	writerClient, err := v1beta1.NewRoutingTreeClientFromGenerator(writer.GetClientRegistry())
	require.NoError(t, err)

	// provisioner has the same write actions PLUS provenance set-status permission.
	provisioner := helper.CreateUser("RoutingTreeProvisioner", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{
				accesscontrol.ActionAlertingRoutesRead,
				accesscontrol.ActionAlertingRoutesWrite,
				accesscontrol.ActionAlertingProvisioningSetStatus,
			},
		},
	})
	provisionerClient, err := v1beta1.NewRoutingTreeClientFromGenerator(provisioner.GetClientRegistry())
	require.NoError(t, err)

	t.Run("update", func(t *testing.T) {
		current, err := provisionerClient.Get(ctx, defaultTreeIdentifier)
		require.NoError(t, err)
		require.Empty(t, current.GetProvenanceStatus())

		t.Run("writer cannot set provenance", func(t *testing.T) {
			updated := current.Copy().(*v1beta1.RoutingTree)
			updated.SetProvenanceStatus(string(models.ProvenanceAPI))
			_, err := writerClient.Update(ctx, updated, resource.UpdateOptions{})
			require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
		})

		t.Run("provisioner can set provenance", func(t *testing.T) {
			current, err := provisionerClient.Get(ctx, defaultTreeIdentifier)
			require.NoError(t, err)
			updated := current.Copy().(*v1beta1.RoutingTree)
			updated.SetProvenanceStatus(string(models.ProvenanceAPI))
			got, err := provisionerClient.Update(ctx, updated, resource.UpdateOptions{})
			require.NoError(t, err)
			require.Equal(t, string(models.ProvenanceAPI), got.GetProvenanceStatus())
		})

		t.Run("writer cannot update provisioned tree", func(t *testing.T) {
			current, err := provisionerClient.Get(ctx, defaultTreeIdentifier)
			require.NoError(t, err)
			updated := current.Copy().(*v1beta1.RoutingTree)
			updated.Spec.Defaults.GroupBy = append(updated.Spec.Defaults.GroupBy, "test-label")
			_, err = writerClient.Update(ctx, updated, resource.UpdateOptions{})
			require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
		})

		t.Run("provisioner can update provisioned tree", func(t *testing.T) {
			current, err := provisionerClient.Get(ctx, defaultTreeIdentifier)
			require.NoError(t, err)
			updated := current.Copy().(*v1beta1.RoutingTree)
			updated.Spec.Defaults.GroupBy = append(updated.Spec.Defaults.GroupBy, "region")
			_, err = provisionerClient.Update(ctx, updated, resource.UpdateOptions{})
			require.NoError(t, err)
		})
	})

	t.Run("delete", func(t *testing.T) {
		// Ensure tree is provisioned before delete tests.
		current, err := provisionerClient.Get(ctx, defaultTreeIdentifier)
		require.NoError(t, err)
		if current.GetProvenanceStatus() != string(models.ProvenanceAPI) {
			updated := current.Copy().(*v1beta1.RoutingTree)
			updated.SetProvenanceStatus(string(models.ProvenanceAPI))
			_, err = provisionerClient.Update(ctx, updated, resource.UpdateOptions{})
			require.NoError(t, err)
		}

		t.Run("writer cannot delete provisioned tree", func(t *testing.T) {
			err := writerClient.Delete(ctx, defaultTreeIdentifier, resource.DeleteOptions{})
			require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
		})

		t.Run("provisioner can delete provisioned tree", func(t *testing.T) {
			err := provisionerClient.Delete(ctx, defaultTreeIdentifier, resource.DeleteOptions{})
			require.NoError(t, err)
		})
	})
}

func TestIntegrationOptimisticConcurrency(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)

	adminClient, err := v1beta1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	current, err := adminClient.Get(ctx, defaultTreeIdentifier)
	require.NoError(t, err)
	require.NotEmpty(t, current.ResourceVersion)

	t.Run("should forbid if version does not match", func(t *testing.T) {
		updated := current.Copy().(*v1beta1.RoutingTree)
		_, err := adminClient.Update(ctx, updated, resource.UpdateOptions{
			ResourceVersion: "test",
		})
		require.Error(t, err)
		require.Truef(t, errors.IsConflict(err), "should get Forbidden error but got %s", err)
	})
	t.Run("should update if version matches", func(t *testing.T) {
		updated := current.Copy().(*v1beta1.RoutingTree)
		updated.Spec.Defaults.GroupBy = append(updated.Spec.Defaults.GroupBy, "data")
		actualUpdated, err := adminClient.Update(ctx, updated, resource.UpdateOptions{})
		require.NoError(t, err)
		require.EqualValues(t, updated.Spec, actualUpdated.Spec)
		require.NotEqual(t, updated.ResourceVersion, actualUpdated.ResourceVersion)
	})
	t.Run("should update if version is empty", func(t *testing.T) {
		current, err = adminClient.Get(ctx, defaultTreeIdentifier)
		require.NoError(t, err)
		updated := current.Copy().(*v1beta1.RoutingTree)
		updated.ResourceVersion = ""
		updated.Spec.Routes = append(updated.Spec.Routes, v1beta1.RoutingTreeRoute{Continue: true})

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

	client, err := v1beta1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	receiver := "empty"
	timeInterval := "test-time-interval"
	createRoute := func(t *testing.T, route definitions.Route) {
		t.Helper()
		routeClient, err := v1beta1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
		require.NoError(t, err)
		managedRoute := legacy_storage.NewManagedRoute(v1beta1.UserDefinedRoutingTreeName, &route)
		managedRoute.Version = "" // Avoid version conflict.
		v1Route, err := routingtree.ConvertToK8sResource(helper.Org1.Admin.Identity.GetOrgID(), managedRoute, func(int64) string { return "default" }, nil)
		require.NoError(t, err)
		_, err = routeClient.Update(ctx, v1Route, resource.UpdateOptions{})
		require.NoError(t, err)
	}

	_, err = common.NewTimeIntervalClient(t, helper.Org1.Admin).Create(ctx, &v1beta1.TimeInterval{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v1beta1.TimeIntervalSpec{
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
			expected := []v1beta1.RoutingTreeMatcher{
				{
					Label: "label_match",
					Type:  v1beta1.RoutingTreeMatcherTypeEqual,
					Value: "test-123",
				},
				{
					Label: "label_re",
					Type:  v1beta1.RoutingTreeMatcherTypeEqualRegex,
					Value: ".*",
				},
				{
					Label: "label_matchers",
					Type:  v1beta1.RoutingTreeMatcherTypeEqualRegex,
					Value: "test-321",
				},
				{
					Label: "object-label-matchers",
					Type:  v1beta1.RoutingTreeMatcherTypeNotEqualRegex,
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
		assert.Equal(t, v1beta1.RoutingTreeRouteDefaults{
			Receiver:       receiver,
			GroupBy:        []string{"test-123", "test-456"},
			GroupWait:      util.Pointer("30s"),
			GroupInterval:  util.Pointer("1m"),
			RepeatInterval: util.Pointer("1d"),
		}, tree.Spec.Defaults)
		assert.Len(t, tree.Spec.Routes, 1)
		assert.Equal(t, v1beta1.RoutingTreeRoute{
			Continue:            true,
			Receiver:            util.Pointer(receiver),
			GroupBy:             []string{"test-789"},
			GroupWait:           util.Pointer("2m"),
			GroupInterval:       util.Pointer("5m"),
			RepeatInterval:      util.Pointer("1d6h"),
			MuteTimeIntervals:   []string{timeInterval},
			ActiveTimeIntervals: []string{timeInterval},
			Matchers: []v1beta1.RoutingTreeMatcher{
				{
					Label: "m",
					Type:  v1beta1.RoutingTreeMatcherTypeNotEqual,
					Value: "1",
				},
				{
					Label: "n",
					Type:  v1beta1.RoutingTreeMatcherTypeEqual,
					Value: "1",
				},
				{
					Label: "o",
					Type:  v1beta1.RoutingTreeMatcherTypeEqualRegex,
					Value: "1",
				},
				{
					Label: "p",
					Type:  v1beta1.RoutingTreeMatcherTypeNotEqualRegex,
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
		expected := []v1beta1.RoutingTreeMatcher{
			{Label: "foo🙂", Type: v1beta1.RoutingTreeMatcherTypeEqual, Value: "bar"},
			{Label: "_bar1", Type: v1beta1.RoutingTreeMatcherTypeNotEqual, Value: "baz🙂"},
			{Label: "0baz", Type: v1beta1.RoutingTreeMatcherTypeEqualRegex, Value: "[a-zA-Z0-9]+,?"},
			{Label: "corge", Type: v1beta1.RoutingTreeMatcherTypeNotEqualRegex, Value: "^[0-9]+((,[0-9]{3})*(,[0-9]{0,3})?)?$"},
			{Label: "Προμηθέας", Type: v1beta1.RoutingTreeMatcherTypeEqual, Value: "Prom"},
			{Label: "犬", Type: v1beta1.RoutingTreeMatcherTypeNotEqual, Value: "Shiba Inu"},
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

	client, err := v1beta1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
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
	updated := current.Copy().(*v1beta1.RoutingTree)
	updated.Spec.Routes = append(updated.Spec.Routes, v1beta1.RoutingTreeRoute{
		Matchers: []v1beta1.RoutingTreeMatcher{
			{
				Label: "imported",
				Type:  v1beta1.RoutingTreeMatcherTypeEqual,
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
	helper := getTestHelper(t)

	org1 := helper.Org1
	admin := org1.Admin
	adminClient, err := v1beta1.NewRoutingTreeClientFromGenerator(admin.GetClientRegistry())
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
	require.Equal(t, v1beta1.UserDefinedRoutingTreeName, list.Items[0].Name)

	validateGetErr := func(t *testing.T, name string, expectedErrReason v1.StatusReason) {
		t.Helper()
		_, err := adminClient.Get(ctx, nameToIdentifier(name))
		require.Error(t, err)
		require.Equal(t, expectedErrReason, errors.ReasonForError(err))
	}

	validateGetEqual := func(t *testing.T, name string, expectedRoute *v1beta1.RoutingTree) {
		t.Helper()
		gotRoute, err := adminClient.Get(ctx, nameToIdentifier(name))
		require.NoError(t, err)

		assert.Equal(t, expectedRoute.Spec, gotRoute.Spec)
		assert.Equal(t, expectedRoute.TypeMeta, gotRoute.TypeMeta)
		assert.Equal(t, expectedRoute.Name, gotRoute.Name)
	}

	t.Run("Create", func(t *testing.T) {
		t.Run("Create with invalid name fails", func(t *testing.T) {
			testCases := []struct {
				desc string
				name string
			}{
				{"empty name", ""},
				{"whitespaces name", "  "},
				{"too long", strings.Repeat("1", 41)},
				{"contains colon", "test:route"},
				{"unsupported symbols", "My_Route"},
			}
			for _, tc := range testCases {
				t.Run(tc.desc, func(t *testing.T) {
					_, err := adminClient.Create(ctx, k8sRoute(t, tc.name, policy_exports.Empty()), resource.CreateOptions{})
					require.Truef(t, errors.IsBadRequest(err), "Should get BadRequest error but got: %s. Name: [%s]", err, tc.name)
				})
			}
		})

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
			_, err = adminClient.Create(ctx, k8sRoute(t, v1beta1.UserDefinedRoutingTreeName, &defaultPolicy), resource.CreateOptions{})
			require.Error(t, err)
		})

		t.Run("Get Default Policy", func(t *testing.T) {
			validateGetEqual(t, v1beta1.UserDefinedRoutingTreeName, k8sRoute(t, v1beta1.UserDefinedRoutingTreeName, &defaultPolicy))
		})
	})

	resetPolicies := func(t *testing.T) map[string]*v1beta1.RoutingTree {
		t.Helper()
		// Delete/reset any remaining routes.
		for name := range cfg.ManagedRoutes {
			_ = db.SetProvenance(ctx, legacy_storage.NewManagedRoute(name, &definitions.Route{}), org1.OrgID, "") // Just in case it was provisioned.
			_ = adminClient.Delete(ctx, nameToIdentifier(name), resource.DeleteOptions{})
		}
		_ = db.SetProvenance(ctx, legacy_storage.NewManagedRoute(v1beta1.UserDefinedRoutingTreeName, &definitions.Route{}), org1.OrgID, "")
		_ = adminClient.Delete(ctx, nameToIdentifier(v1beta1.UserDefinedRoutingTreeName), resource.DeleteOptions{})

		// Recreate them.
		created := make(map[string]*v1beta1.RoutingTree, len(cfg.ManagedRoutes))
		for name, route := range cfg.ManagedRoutes {
			c, err := adminClient.Create(ctx, k8sRoute(t, name, route), resource.CreateOptions{})
			require.NoError(t, err)
			created[name] = c
		}
		return created
	}

	t.Run("Provisioned Get should include provenance", func(t *testing.T) {
		allCreatedRoutes := resetPolicies(t)
		allCreatedRoutes[v1beta1.UserDefinedRoutingTreeName] = k8sRoute(t, v1beta1.UserDefinedRoutingTreeName, &defaultPolicy)

		for name, route := range allCreatedRoutes {
			require.NoError(t, db.SetProvenance(ctx, legacy_storage.NewManagedRoute(name, &definitions.Route{}), org1.OrgID, "API"))

			t.Run(fmt.Sprintf("Policy %s", name), func(t *testing.T) {
				got, err := adminClient.Get(ctx, nameToIdentifier(name))
				require.NoError(t, err)
				expected := route.Copy().(*v1beta1.RoutingTree)
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
			expectedRoutes := make([]v1beta1.RoutingTree, 0, len(cfg.ManagedRoutes)+1)
			for _, route := range allCreatedRoutes {
				expectedRoutes = append(expectedRoutes, *route)
			}
			expectedRoutes = append(expectedRoutes, *k8sRoute(t, v1beta1.UserDefinedRoutingTreeName, &defaultPolicy))

			for i := range expectedRoutes {
				expectedRoutes[i].TypeMeta = v1.TypeMeta{
					APIVersion: v1beta1.RoutingTreeKind().GroupVersionKind().GroupVersion().String(),
					Kind:       v1beta1.RoutingTreeKind().Kind(),
				}
			}
			assert.ElementsMatch(t, expectedRoutes, list.Items)
		})
		t.Run("Default policy last", func(t *testing.T) {
			assert.Equal(t, v1beta1.UserDefinedRoutingTreeName, list.Items[len(cfg.ManagedRoutes)].Name)
		})
	})

	t.Run("Update", func(t *testing.T) {
		policies := resetPolicies(t)
		policies[v1beta1.UserDefinedRoutingTreeName] = k8sRoute(t, v1beta1.UserDefinedRoutingTreeName, policy_exports.Legacy())

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
					updatedRoute, err := adminClient.Update(ctx, route.Copy().(*v1beta1.RoutingTree), resource.UpdateOptions{ResourceVersion: currentVersion})
					require.NoError(t, err)
					policies[name] = updatedRoute

					validateGetEqual(t, name, updatedRoute)
				})
			}
		})

		t.Run("Update on provisioned should succeed for admin", func(t *testing.T) {
			for name := range policies {
				t.Run(fmt.Sprintf("Policy %s", name), func(t *testing.T) {
					require.NoError(t, db.SetProvenance(ctx, legacy_storage.NewManagedRoute(name, &definitions.Route{}), org1.OrgID, "API"))

					_, err := adminClient.Update(ctx, k8sRoute(t, name, policy_exports.Empty()), resource.UpdateOptions{ResourceVersion: ""}) // Bypass version check.
					require.NoError(t, err)
				})
			}
		})
	})

	t.Run("Delete", func(t *testing.T) {
		policies := resetPolicies(t)
		policies[v1beta1.UserDefinedRoutingTreeName] = k8sRoute(t, v1beta1.UserDefinedRoutingTreeName, &defaultPolicy)

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
					if name == v1beta1.UserDefinedRoutingTreeName {
						validateGetEqual(t, name, k8sRoute(t, v1beta1.UserDefinedRoutingTreeName, &defaultPolicy)) // Default policy only resets, it doesn't delete.
					} else {
						validateGetErr(t, name, v1.StatusReasonNotFound)
					}
				})

				// Recreate so we can delete again using the empty ResourceVersion.
				_, _ = adminClient.Create(ctx, route, resource.CreateOptions{}) // Not necessary to check error here, downstream will catch.

				t.Run("Empty ResourceVersion should succeed", func(t *testing.T) {
					err := adminClient.Delete(ctx, nameToIdentifier(name), resource.DeleteOptions{Preconditions: resource.DeleteOptionsPreconditions{ResourceVersion: ""}})
					require.NoError(t, err)
					if name == v1beta1.UserDefinedRoutingTreeName {
						validateGetEqual(t, name, k8sRoute(t, v1beta1.UserDefinedRoutingTreeName, &defaultPolicy)) // Default policy only resets, it doesn't delete.
					} else {
						validateGetErr(t, name, v1.StatusReasonNotFound)
					}
				})
			})
		}
	})
}

// TestIntegrationResourcePermissions focuses on testing resource permissions for the alerting route resource. It
// verifies that access is correctly set when creating resources and assigning permissions to users, teams, and roles.
func TestIntegrationResourcePermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)

	org1 := helper.Org1
	noneUser := org1.None

	creator := helper.CreateUser("routeCreator", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions: []string{accesscontrol.ActionAlertingManagedRoutesCreate},
		},
	})

	admin := org1.Admin
	viewer := org1.Viewer
	editor := org1.Editor
	adminClient, err := v1beta1.NewRoutingTreeClientFromGenerator(admin.GetClientRegistry())
	require.NoError(t, err)

	writeACMetadata := []string{"canWrite", "canDelete"}
	allACMetadata := []string{"canWrite", "canDelete", "canAdmin"}

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
		expUpdate     bool
		expDelete     bool
	}{
		// Basic access.
		{
			name:          "Admin creates and has all access",
			creatingUser:  admin,
			testUser:      admin,
			expACMetadata: allACMetadata,
			expRead:       true,
			expUpdate:     true,
			expDelete:     true,
		},
		{
			name:          "Creator creates and has all access",
			creatingUser:  creator,
			testUser:      creator,
			expACMetadata: allACMetadata,
			expRead:       true,
			expUpdate:     true,
			expDelete:     true,
		},
		{
			name:          "Admin creates, noneUser has no access",
			creatingUser:  admin,
			testUser:      noneUser,
			expACMetadata: nil,
		},
		{
			name:          "Admin creates, viewer has read access",
			creatingUser:  admin,
			testUser:      viewer,
			expACMetadata: nil,
			expRead:       true,
		},
		{
			name:          "Admin creates, editor has read and write access",
			creatingUser:  admin,
			testUser:      editor,
			expACMetadata: writeACMetadata,
			expRead:       true,
			expUpdate:     true,
			expDelete:     true,
		},
		// User-based assignments.
		{
			name:          "Admin creates, assigns view, noneUser has read access",
			creatingUser:  admin,
			testUser:      noneUser,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(noneUser), Permission: string(models.PermissionView)}},
			expACMetadata: nil,
			expRead:       true,
		},
		{
			name:          "Admin creates, assigns edit, noneUser has read+write+delete access",
			creatingUser:  admin,
			testUser:      noneUser,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(noneUser), Permission: string(models.PermissionEdit)}},
			expACMetadata: writeACMetadata,
			expRead:       true,
			expUpdate:     true,
			expDelete:     true,
		},
		{
			name:          "Admin creates, assigns admin, noneUser has all access",
			creatingUser:  admin,
			testUser:      noneUser,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(noneUser), Permission: string(models.PermissionAdmin)}},
			expACMetadata: allACMetadata,
			expRead:       true,
			expUpdate:     true,
			expDelete:     true,
		},
		// Role-based access.
		{
			name:          "Admin creates, assigns edit, viewer has read+write+delete access",
			creatingUser:  admin,
			testUser:      viewer,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(viewer), Permission: string(models.PermissionEdit)}},
			expACMetadata: writeACMetadata,
			expRead:       true,
			expUpdate:     true,
			expDelete:     true,
		},
		{
			name:          "Admin creates, assigns admin, viewer has all access",
			creatingUser:  admin,
			testUser:      viewer,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{UserID: mustID(viewer), Permission: string(models.PermissionAdmin)}},
			expACMetadata: allACMetadata,
			expRead:       true,
			expUpdate:     true,
			expDelete:     true,
		},
		// Team-based access. Staff team has editor+admin but not viewer in it.
		{
			name:          "Admin creates, assigns admin to staff, viewer has read access only",
			creatingUser:  admin,
			testUser:      viewer,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{TeamID: org1.Staff.ID, Permission: string(models.PermissionAdmin)}},
			expACMetadata: nil,
			expRead:       true,
		},
		{
			name:          "Admin creates, assigns admin to staff, editor has all access",
			creatingUser:  admin,
			testUser:      editor,
			assignments:   []accesscontrol.SetResourcePermissionCommand{{TeamID: org1.Staff.ID, Permission: string(models.PermissionAdmin)}},
			expACMetadata: allACMetadata,
			expRead:       true,
			expUpdate:     true,
			expDelete:     true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			createClient, err := v1beta1.NewRoutingTreeClientFromGenerator(tc.creatingUser.GetClientRegistry())
			require.NoError(t, err)
			client, err := v1beta1.NewRoutingTreeClientFromGenerator(tc.testUser.GetClientRegistry())
			require.NoError(t, err)

			routeName := fmt.Sprintf("perm-test-%s", util.GenerateShortUID())
			created, err := createClient.Create(ctx, k8sRoute(t, routeName, &defaultPolicy), resource.CreateOptions{})
			require.NoError(t, err)

			defer func() {
				_ = adminClient.Delete(ctx, created.GetStaticMetadata().Identifier(), resource.DeleteOptions{})
			}()

			// Assign resource permissions.
			cliCfg := helper.Org1.Admin.NewRestConfig()
			alertingApi := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)
			for _, permission := range tc.assignments {
				status, body := alertingApi.AssignRoutePermission(t, routeName, permission)
				require.Equalf(t, http.StatusOK, status, "Expected status 200 but got %d: %s", status, body)
			}

			assertACMetadata := func(t *testing.T, annotations map[string]string) {
				t.Helper()
				for _, k := range allACMetadata {
					key := v1beta1.AccessControlAnnotation(k)
					var expected bool
					for _, exp := range tc.expACMetadata {
						if exp == k {
							expected = true
							break
						}
					}
					if expected {
						assert.Equalf(t, "true", annotations[key], "expected annotation %s to be set", key)
					} else {
						_, exists := annotations[key]
						assert.Falsef(t, exists, "expected annotation %s to not be set", key)
					}
				}
			}

			if tc.expRead {
				t.Run("should be able to read route", func(t *testing.T) {
					got, err := client.Get(ctx, created.GetStaticMetadata().Identifier())
					require.NoError(t, err)
					assertACMetadata(t, got.Annotations)
				})

				t.Run("should see route in list with correct metadata", func(t *testing.T) {
					list, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
					require.NoError(t, err)
					var found bool
					for _, item := range list.Items {
						if item.Name == routeName {
							found = true
							assertACMetadata(t, item.Annotations)
							break
						}
					}
					assert.Truef(t, found, "expected route %s to be in list", routeName)
				})
			} else {
				t.Run("should be forbidden to read route", func(t *testing.T) {
					_, err := client.Get(ctx, created.GetStaticMetadata().Identifier())
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
				})
			}

			if tc.expUpdate {
				t.Run("should be able to update route", func(t *testing.T) {
					current, err := adminClient.Get(ctx, created.GetStaticMetadata().Identifier())
					require.NoError(t, err)
					updated := current.Copy().(*v1beta1.RoutingTree)
					updated.Spec.Routes = []v1beta1.RoutingTreeRoute{
						{
							Matchers: []v1beta1.RoutingTreeMatcher{
								{
									Label: "test",
									Type:  v1beta1.RoutingTreeMatcherTypeEqual,
									Value: "test",
								},
							},
						},
					}
					_, err = client.Update(ctx, updated, resource.UpdateOptions{})
					require.NoError(t, err)
				})
			} else {
				t.Run("should be forbidden to update route", func(t *testing.T) {
					current, err := adminClient.Get(ctx, created.GetStaticMetadata().Identifier())
					require.NoError(t, err)
					updated := current.Copy().(*v1beta1.RoutingTree)
					updated.Spec.Routes = []v1beta1.RoutingTreeRoute{
						{
							Matchers: []v1beta1.RoutingTreeMatcher{
								{
									Label: "test",
									Type:  v1beta1.RoutingTreeMatcherTypeEqual,
									Value: "test",
								},
							},
						},
					}
					_, err = client.Update(ctx, updated, resource.UpdateOptions{})
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
				})
			}

			if tc.expDelete {
				t.Run("should be able to delete route", func(t *testing.T) {
					err := client.Delete(ctx, created.GetStaticMetadata().Identifier(), resource.DeleteOptions{})
					require.NoError(t, err)
				})
			} else {
				t.Run("should be forbidden to delete route", func(t *testing.T) {
					err := client.Delete(ctx, created.GetStaticMetadata().Identifier(), resource.DeleteOptions{})
					require.Error(t, err)
					require.Truef(t, errors.IsForbidden(err), "should get Forbidden error but got %s", err)
				})
			}
		})
	}
}

func TestIntegrationMultipleRoutesReferentialIntegrity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)

	org1 := helper.Org1
	admin := org1.Admin
	adminClient, err := v1beta1.NewRoutingTreeClientFromGenerator(admin.GetClientRegistry())
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
	_, err = adminClient.Update(ctx, k8sRoute(t, v1beta1.UserDefinedRoutingTreeName, &routeDef), resource.UpdateOptions{})
	require.NoError(t, err)

	// Named route.
	_, err = adminClient.Create(ctx, k8sRoute(t, "named-route", &routeDef), resource.CreateOptions{})
	require.NoError(t, err)

	// Update the receivers, then ensure the references are updated.
	t.Run("Update receivers references", func(t *testing.T) {
		recvClient, err := v1beta1.NewReceiverClientFromGenerator(admin.GetClientRegistry())
		require.NoError(t, err)
		updatedName := func(name string) string {
			return fmt.Sprintf("%s-updatedbytest", name)
		}
		for oldName, recv := range receivers {
			assert.Equal(t, oldName, recv.Spec.Title)

			cp := recv.Copy().(*v1beta1.Receiver)
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
		timeIntervalClient, err := v1beta1.NewTimeIntervalClientFromGenerator(admin.GetClientRegistry())
		require.NoError(t, err)

		updatedName := func(name string) string {
			return fmt.Sprintf("%s-updatedbytest", name)
		}
		for oldName, ti := range timeIntervals {
			assert.Equal(t, oldName, ti.Spec.Name)

			cp := ti.Copy().(*v1beta1.TimeInterval)
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

func k8sRoute(t *testing.T, name string, r *definitions.Route) *v1beta1.RoutingTree {
	err := r.Validate()
	require.NoError(t, err)
	managedRoute := legacy_storage.NewManagedRoute(name, r)
	allPermissions := models.NewRoutePermissionSet()
	allPermissions.Set(models.RoutePermissionWrite, true)
	allPermissions.Set(models.RoutePermissionDelete, true)
	allPermissions.Set(models.RoutePermissionAdmin, true)
	v1Route, err := routingtree.ConvertToK8sResource(-1, managedRoute, func(int64) string { return apis.DefaultNamespace }, &allPermissions)
	require.NoError(t, err)
	v1Route.TypeMeta = v1.TypeMeta{
		Kind:       v1beta1.RoutingTreeKind().Kind(),
		APIVersion: v1beta1.GroupVersion.Identifier(),
	}
	return v1Route
}

func createReceiverStubs(t *testing.T, user apis.User, receivers []*definitions.PostableApiReceiver) map[string]*v1beta1.Receiver {
	receiverClient, err := v1beta1.NewReceiverClientFromGenerator(user.GetClientRegistry())
	require.NoError(t, err)

	res := make(map[string]*v1beta1.Receiver, len(receivers))
	for _, receiver := range receivers {
		created, err := receiverClient.Create(context.Background(), &v1beta1.Receiver{
			ObjectMeta: v1.ObjectMeta{Namespace: apis.DefaultNamespace},
			Spec:       v1beta1.ReceiverSpec{Title: receiver.Name, Integrations: []v1beta1.ReceiverIntegration{}},
		}, resource.CreateOptions{})
		require.NoError(t, err)
		res[receiver.Name] = created
	}
	return res
}

func createTimeIntervalStubs(t *testing.T, user apis.User, timeIntervals []config.TimeInterval) map[string]*v1beta1.TimeInterval {
	timeIntervalClient, err := v1beta1.NewTimeIntervalClientFromGenerator(user.GetClientRegistry())
	require.NoError(t, err)

	res := make(map[string]*v1beta1.TimeInterval, len(timeIntervals))
	for _, ti := range timeIntervals {
		created, err := timeIntervalClient.Create(context.Background(), &v1beta1.TimeInterval{
			ObjectMeta: v1.ObjectMeta{Namespace: apis.DefaultNamespace},
			Spec:       v1beta1.TimeIntervalSpec{Name: ti.Name},
		}, resource.CreateOptions{})
		require.NoError(t, err)
		res[ti.Name] = created
	}
	return res
}

func createWildcardPermission(actions ...string) resourcepermissions.SetResourcePermissionCommand {
	return resourcepermissions.SetResourcePermissionCommand{
		Actions:           actions,
		Resource:          accesscontrol.AlertingRoutesKind,
		ResourceAttribute: "uid",
		ResourceID:        "*",
	}
}
