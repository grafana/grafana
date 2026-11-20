package collections

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	collections "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationStars(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// routed runs the same checks with the router serving stars from the
	// collections app.
	for _, routed := range []bool{false, true} {
		var flags []string
		if routed {
			flags = append(flags,
				featuremgmt.FlagGrafanaUseRouterMiddleware,
				featuremgmt.FlagRouterRegisterCoreAPIs,
				featuremgmt.FlagApppluginsLoadAppManifest,
			)
		}

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false, // required for experimental APIs
			DisableAnonymous:     true,
			LocalPluginAPI:       routed,
			EnableFeatureToggles: flags,
			Provisioning:         testinfra.FeatureEnabled,
		})

		t.Run(fmt.Sprintf("test stars (routed:%t)", routed), func(t *testing.T) {
			ctx := context.Background()
			starsClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  collections.StarsResourceInfo.GroupVersionResource(),
			})
			starsClientViewer := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Viewer,
				GVR:  collections.StarsResourceInfo.GroupVersionResource(),
			})
			dashboardClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  dashboardV1.DashboardResourceInfo.GroupVersionResource(),
			})

			adminStarName := "user-" + starsClient.Args.User.Identity.GetIdentifier()
			client := helper.Org1.Admin.RESTClient(t, &collections.GroupVersion)

			// Without dual write the legacy API no longer reaches this storage.
			setStar := func(uid string, remove bool) {
				t.Helper()
				if routed {
					req := client.Put()
					if remove {
						req = client.Delete()
					}
					res := req.AbsPath("apis", "collections.grafana.app", "v1alpha1",
						"namespaces", "default", "stars", adminStarName,
						"update", "dashboard.grafana.app", "Dashboard", uid).Do(ctx)
					require.NoError(t, res.Error(), "star %s (remove:%t)", uid, remove)
					return
				}
				method := http.MethodPost
				if remove {
					method = http.MethodDelete
				}
				raw := make(map[string]any)
				legacyResponse := apis.DoRequest(helper, apis.RequestParams{
					User:   starsClient.Args.User,
					Method: method,
					Path:   "/api/user/stars/dashboard/uid/" + uid,
				}, &raw)
				require.Equal(t, http.StatusOK, legacyResponse.Response.StatusCode, "star %s (remove:%t)", uid, remove)
			}

			// Create 5 dashboards
			for i := range 5 {
				_, err := dashboardClient.Resource.Create(context.Background(), &unstructured.Unstructured{
					Object: map[string]any{
						"apiVersion": dashboardV1.DashboardResourceInfo.GroupVersion().String(),
						"kind":       "Dashboard",
						"metadata": map[string]any{
							"name": fmt.Sprintf("test-%d", i),
						},
						"spec": map[string]any{
							"title":         fmt.Sprintf("test %d", i),
							"schemaVersion": 42, // not really!
							"panels":        []any{},
						},
					},
				}, metav1.CreateOptions{})
				require.NoError(t, err)
			}
			found, err := dashboardClient.Resource.List(context.Background(), metav1.ListOptions{})
			require.NoError(t, err)
			require.Len(t, found.Items, 5, "should be 5 dashboards")

			// List is empty when we start
			rsp, err := starsClient.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Empty(t, rsp.Items, "no stars saved yet")

			setStar("test-2", false)
			setStar("test-3", false)

			// List values and compare results
			rsp, err = starsClient.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			stars := typed(t, rsp, &collections.StarsList{})

			require.Len(t, stars.Items, 1, "user stars should exist")
			require.Equal(t, "user-"+starsClient.Args.User.Identity.GetIdentifier(),
				stars.Items[0].GetName(), "star resource for user")
			resources := stars.Items[0].Spec.Resource
			require.Len(t, resources, 1)
			require.Equal(t, "dashboard.grafana.app", resources[0].Group)
			require.Equal(t, "Dashboard", resources[0].Kind)
			require.ElementsMatch(t, []string{"test-2", "test-3"}, resources[0].Names)

			// Remove one star
			setStar("test-3", true)

			rspObj, err := starsClient.Resource.Get(ctx, adminStarName, metav1.GetOptions{})
			require.NoError(t, err)

			after := typed(t, rspObj, &collections.Stars{})
			resources = after.Spec.Resource
			require.Len(t, resources, 1)
			require.Equal(t, "dashboard.grafana.app", resources[0].Group)
			require.Equal(t, "Dashboard", resources[0].Kind)
			require.Equal(t, []string{"test-2"}, resources[0].Names)

			// Change stars via k8s update
			rspObj, err = starsClient.Resource.Update(ctx, &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": collections.GroupVersion.String(),
					"kind":       "Stars",
					"metadata": map[string]any{
						"name":      adminStarName,
						"namespace": "default",
					},
					"spec": map[string]any{
						"resource": []map[string]any{
							{
								"group": "dashboard.grafana.app",
								"kind":  "Dashboard",
								"names": []string{"test-2", "aaa", "aaa", "bbb"},
							},
						},
					},
				},
			}, metav1.UpdateOptions{})
			require.NoError(t, err)

			after = typed(t, rspObj, &collections.Stars{})
			resources = after.Spec.Resource
			require.Len(t, resources, 1)
			require.Equal(t, "dashboard.grafana.app", resources[0].Group)
			require.Equal(t, "Dashboard", resources[0].Kind)
			require.ElementsMatch(t,
				[]string{"test-2", "aaa", "bbb"}, // keeps the requested order, removing duplicates
				resources[0].Names)

			// Now add a star with the sub-resource route used by the UI
			res := client.Put().AbsPath("apis", "collections.grafana.app", "v1alpha1",
				"namespaces", "default",
				"stars", adminStarName,
				"update", "dashboard.grafana.app", "Dashboard", "xxx").Do(ctx)
			require.NoError(t, res.Error())

			rspObj, err = starsClient.Resource.Get(ctx, adminStarName, metav1.GetOptions{})
			require.NoError(t, err)

			after = typed(t, rspObj, &collections.Stars{})

			// FIXME: when we remove legacy support this should not sort!
			slices.Sort(after.Spec.Resource[0].Names)

			jj, err := json.MarshalIndent(after.Spec, "", "  ")
			require.NoError(t, err)
			require.JSONEq(t, `{
					"resource": [
						{
							"group": "dashboard.grafana.app",
							"kind": "Dashboard",
							"names": [
								"aaa",
								"bbb",
								"test-2",
								"xxx"
							]
						}
					]
				}`, string(jj))

			// Viewer does not have any stars
			rsp, err = starsClientViewer.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Empty(t, rsp.Items, "expect empty list")

			// Not allowed to see another user's stars
			rspObj, err = starsClientViewer.Resource.Get(ctx, "user-"+starsClient.Args.User.Identity.GetIdentifier(), metav1.GetOptions{})
			require.Error(t, err)
			require.Nil(t, rspObj)

			// An org admin can star a dashboard on behalf of another user
			viewerStarName := "user-" + starsClientViewer.Args.User.Identity.GetIdentifier()
			res = client.Put().AbsPath("apis", "collections.grafana.app", "v1alpha1",
				"namespaces", "default",
				"stars", viewerStarName,
				"update", "dashboard.grafana.app", "Dashboard", "test-2").Do(ctx)
			require.NoError(t, res.Error(), "org admin can star for another user")

			// The star landed on the target user's stars object, not the admin's
			rspObj, err = starsClientViewer.Resource.Get(ctx, viewerStarName, metav1.GetOptions{})
			require.NoError(t, err)
			viewerStars := typed(t, rspObj, &collections.Stars{})
			require.Len(t, viewerStars.Spec.Resource, 1)
			require.Contains(t, viewerStars.Spec.Resource[0].Names, "test-2")

			// A non-admin still cannot star on behalf of another user
			viewerClient := helper.Org1.Viewer.RESTClient(t, &collections.GroupVersion)
			res = viewerClient.Put().AbsPath("apis", "collections.grafana.app", "v1alpha1",
				"namespaces", "default",
				"stars", adminStarName,
				"update", "dashboard.grafana.app", "Dashboard", "test-2").Do(ctx)
			require.Error(t, res.Error(), "viewer cannot star for another user")

			// Use the API to star a non-dashboard resource
			res = client.Put().AbsPath("apis", "collections.grafana.app", "v1alpha1",
				"namespaces", "default",
				"stars", adminStarName,
				"update", "servicemodel.ext.grafana.com", "Component", "xxx").Do(ctx)
			require.NoError(t, res.Error())
		})
	}
}

// TestIntegrationStarsUpsert checks that a user who is not an org admin can
// create their own stars object by writing to its name, with no separate create
// step. A collection-level create may only use the user's own name.
func TestIntegrationStarsUpsert(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, routed := range []bool{false, true} {
		var flags []string
		if routed {
			flags = append(flags,
				featuremgmt.FlagGrafanaUseRouterMiddleware,
				featuremgmt.FlagRouterRegisterCoreAPIs,
				featuremgmt.FlagApppluginsLoadAppManifest,
			)
		}
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			LocalPluginAPI:       routed,
			EnableFeatureToggles: flags,
			Provisioning:         testinfra.FeatureEnabled,
		})

		t.Run(fmt.Sprintf("upsert stars (routed:%t)", routed), func(t *testing.T) {
			ctx := context.Background()
			gvr := collections.StarsResourceInfo.GroupVersionResource()
			viewer := helper.Org1.Viewer
			editor := helper.Org1.Editor
			viewerStars := helper.GetResourceClient(apis.ResourceClientArgs{User: viewer, GVR: gvr})
			editorStars := helper.GetResourceClient(apis.ResourceClientArgs{User: editor, GVR: gvr})
			viewerName := "user-" + viewer.Identity.GetIdentifier()
			editorName := "user-" + editor.Identity.GetIdentifier()
			viewerREST := viewer.RESTClient(t, &collections.GroupVersion)

			starPath := func(name, op, uid string) []string {
				return []string{"apis", "collections.grafana.app", "v1alpha1", "namespaces", "default",
					"stars", name, "update", "dashboard.grafana.app", "Dashboard", uid}
			}
			names := func(t *testing.T, c *apis.K8sResourceClient, name string) []string {
				t.Helper()
				obj, err := c.Resource.Get(ctx, name, metav1.GetOptions{})
				require.NoError(t, err)
				stars := typed(t, obj, &collections.Stars{})
				if len(stars.Spec.Resource) == 0 {
					return nil
				}
				return stars.Spec.Resource[0].Names
			}

			t.Run("a viewer's first star creates their object", func(t *testing.T) {
				_, err := viewerStars.Resource.Get(ctx, viewerName, metav1.GetOptions{})
				require.Error(t, err, "nothing stored yet")

				res := viewerREST.Put().AbsPath(starPath(viewerName, "update", "first")...).Do(ctx)
				require.NoError(t, res.Error())
				require.Equal(t, []string{"first"}, names(t, viewerStars, viewerName))

				res = viewerREST.Put().AbsPath(starPath(viewerName, "update", "second")...).Do(ctx)
				require.NoError(t, res.Error())
				require.ElementsMatch(t, []string{"first", "second"}, names(t, viewerStars, viewerName))
			})

			t.Run("removing the last star deletes the object, and the next one creates it again", func(t *testing.T) {
				for _, uid := range []string{"first", "second"} {
					res := viewerREST.Delete().AbsPath(starPath(viewerName, "update", uid)...).Do(ctx)
					require.NoError(t, res.Error())
				}
				_, err := viewerStars.Resource.Get(ctx, viewerName, metav1.GetOptions{})
				require.Error(t, err, "object is gone")

				res := viewerREST.Put().AbsPath(starPath(viewerName, "update", "again")...).Do(ctx)
				require.NoError(t, res.Error())
				require.Equal(t, []string{"again"}, names(t, viewerStars, viewerName))
			})

			t.Run("a plain PUT of the owner's own name creates it without a resource version", func(t *testing.T) {
				if !routed {
					t.Skip("upsert on write is served by the router's owner-scoped store")
				}
				obj := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": collections.GroupVersion.String(),
					"kind":       "Stars",
					"metadata":   map[string]any{"name": editorName, "namespace": "default"},
					"spec": map[string]any{"resource": []map[string]any{
						{"group": "dashboard.grafana.app", "kind": "Dashboard", "names": []string{"a", "b"}},
					}},
				}}
				_, err := editorStars.Resource.Update(ctx, obj, metav1.UpdateOptions{})
				require.NoError(t, err)
				require.Equal(t, []string{"a", "b"}, names(t, editorStars, editorName))

				// Replacing it again, still without a resource version
				obj.Object["spec"] = map[string]any{"resource": []map[string]any{
					{"group": "dashboard.grafana.app", "kind": "Dashboard", "names": []string{"c"}},
				}}
				_, err = editorStars.Resource.Update(ctx, obj, metav1.UpdateOptions{})
				require.NoError(t, err)
				require.Equal(t, []string{"c"}, names(t, editorStars, editorName))
			})

			t.Run("a PUT to another user's name is forbidden and creates nothing", func(t *testing.T) {
				other := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": collections.GroupVersion.String(),
					"kind":       "Stars",
					"metadata":   map[string]any{"name": "user-someone-else", "namespace": "default"},
					"spec": map[string]any{"resource": []map[string]any{
						{"group": "dashboard.grafana.app", "kind": "Dashboard", "names": []string{"a"}},
					}},
				}}
				_, err := viewerStars.Resource.Update(ctx, other, metav1.UpdateOptions{})
				require.Error(t, err)
				require.True(t, apierrors.IsForbidden(err), "got %v", err)

				adminStars := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvr})
				_, err = adminStars.Resource.Get(ctx, "user-someone-else", metav1.GetOptions{})
				require.True(t, apierrors.IsNotFound(err), "got %v", err)
			})

			t.Run("a collection-level create checks the name in the object", func(t *testing.T) {
				if !routed {
					t.Skip("the router's owner authorizer applies to the routed API")
				}
				starsNamed := func(name string) *unstructured.Unstructured {
					return &unstructured.Unstructured{Object: map[string]any{
						"apiVersion": collections.GroupVersion.String(),
						"kind":       "Stars",
						"metadata":   map[string]any{"name": name, "namespace": "default"},
						"spec": map[string]any{"resource": []any{map[string]any{
							"group": "dashboard.grafana.app", "kind": "Dashboard", "names": []any{"posted"},
						}}},
					}}
				}

				_, err := viewerStars.Resource.Create(ctx, starsNamed("user-someone-else"), metav1.CreateOptions{})
				require.True(t, apierrors.IsInvalid(err), "got %v", err)

				// A generated name is only made after the name is checked.
				generated := starsNamed("")
				generated.SetGenerateName("user-")
				_, err = viewerStars.Resource.Create(ctx, generated, metav1.CreateOptions{})
				require.True(t, apierrors.IsInvalid(err), "got %v", err)

				require.NoError(t, viewerStars.Resource.Delete(ctx, viewerName, metav1.DeleteOptions{}))
				_, err = viewerStars.Resource.Create(ctx, starsNamed(viewerName), metav1.CreateOptions{})
				require.NoError(t, err)
				require.Equal(t, []string{"posted"}, names(t, viewerStars, viewerName))
			})
		})
	}
}

func typed[T any](t *testing.T, obj any, out T) T {
	jj, err := json.Marshal(obj)
	require.NoError(t, err)
	err = json.Unmarshal(jj, out)
	require.NoError(t, err)
	return out
}
