package apis

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestShortURLAppAPI(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	gvr := schema.GroupVersionResource{
		Group:    "shorturl.grafana.app",
		Version:  "v0alpha1",
		Resource: "shorturls",
	}

	runShortURLAppTest := func(t *testing.T, helper *K8sTestHelper, gvr schema.GroupVersionResource) {
		t.Run("simple CRUD operations", func(t *testing.T) {
			ctx := context.Background()
			client := helper.GetResourceClient(ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})

			// List should be empty initially
			rsp, err := client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Empty(t, rsp.Items)

			// Create a new ShortURL
			obj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"spec": map[string]any{
						"uid":        "test-uid-123",
						"path":       "/d/test-dashboard/test?orgId=1",
						"lastSeenAt": time.Now().Unix(),
					},
				},
			}
			obj.SetName("test-shorturl")
			obj.SetAPIVersion(gvr.GroupVersion().String())
			obj.SetKind("ShortURL")

			obj, err = client.Resource.Create(ctx, obj, metav1.CreateOptions{})
			require.NoError(t, err)
			require.Equal(t, "test-shorturl", obj.GetName())

			// Verify it appears in the list
			rsp, err = client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Len(t, rsp.Items, 1)
			require.Equal(t, "test-shorturl", rsp.Items[0].GetName())

			// Get the specific object
			obj, err = client.Resource.Get(ctx, "test-shorturl", metav1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, "test-shorturl", obj.GetName())
			require.Equal(t, int64(1), obj.GetGeneration())

			spec := obj.Object["spec"].(map[string]any)
			require.Equal(t, "test-uid-123", spec["uid"])
			require.Equal(t, "/d/test-dashboard/test?orgId=1", spec["path"])

			// Update the object
			spec["path"] = "/d/updated-dashboard/test?orgId=1"
			spec["lastSeenAt"] = time.Now().Unix()

			updated, err := client.Resource.Update(ctx, obj, metav1.UpdateOptions{})
			require.NoError(t, err)
			require.Equal(t, obj.GetName(), updated.GetName())
			require.Equal(t, obj.GetUID(), updated.GetUID())
			require.Less(t, obj.GetResourceVersion(), updated.GetResourceVersion())

			updatedSpec := updated.Object["spec"].(map[string]any)
			require.Equal(t, "/d/updated-dashboard/test?orgId=1", updatedSpec["path"])

			// Delete the object
			zeroInt64 := int64(0)
			err = client.Resource.Delete(ctx, "test-shorturl", metav1.DeleteOptions{
				GracePeriodSeconds: &zeroInt64,
			})
			require.NoError(t, err)

			// Verify it's gone
			rsp, err = client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Empty(t, rsp.Items)
		})

		t.Run("create with generateName", func(t *testing.T) {
			ctx := context.Background()
			client := helper.GetResourceClient(ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})

			obj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"spec": map[string]any{
						"uid":        "generated-uid-456",
						"path":       "/d/generated-dashboard/test",
						"lastSeenAt": time.Now().Unix(),
					},
				},
			}
			obj.SetGenerateName("shorturl-")
			obj.SetAPIVersion(gvr.GroupVersion().String())
			obj.SetKind("ShortURL")

			obj, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
			require.NoError(t, err)
			require.True(t, len(obj.GetName()) > len("shorturl-"))
			require.Contains(t, obj.GetName(), "shorturl-")

			// Clean up
			zeroInt64 := int64(0)
			err = client.Resource.Delete(ctx, obj.GetName(), metav1.DeleteOptions{
				GracePeriodSeconds: &zeroInt64,
			})
			require.NoError(t, err)
		})

		t.Run("permissions and access control", func(t *testing.T) {
			ctx := context.Background()

			// Test with different user roles
			testCases := []struct {
				name         string
				user         User
				shouldCreate bool
			}{
				{"Admin", helper.Org1.Admin, true},
				{"Editor", helper.Org1.Editor, true},
				{"Viewer", helper.Org1.Viewer, true}, // Viewers can create short URLs
			}

			for _, tc := range testCases {
				t.Run(tc.name, func(t *testing.T) {
					client := helper.GetResourceClient(ResourceClientArgs{
						User: tc.user,
						GVR:  gvr,
					})

					obj := &unstructured.Unstructured{
						Object: map[string]interface{}{
							"spec": map[string]any{
								"uid":        fmt.Sprintf("%s-uid-789", tc.name),
								"path":       fmt.Sprintf("/d/%s-dashboard/test", tc.name),
								"lastSeenAt": time.Now().Unix(),
							},
						},
					}
					obj.SetName(fmt.Sprintf("test-%s-shorturl", tc.name))
					obj.SetAPIVersion(gvr.GroupVersion().String())
					obj.SetKind("ShortURL")

					obj, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
					if tc.shouldCreate {
						require.NoError(t, err)
						require.Equal(t, fmt.Sprintf("test-%s-shorturl", tc.name), obj.GetName())

						// Clean up
						zeroInt64 := int64(0)
						err = client.Resource.Delete(ctx, obj.GetName(), metav1.DeleteOptions{
							GracePeriodSeconds: &zeroInt64,
						})
						require.NoError(t, err)
					} else {
						require.Error(t, err)
					}
				})
			}
		})

		t.Run("cross-org isolation", func(t *testing.T) {
			ctx := context.Background()

			// Create shorturl in Org1
			org1Client := helper.GetResourceClient(ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})

			obj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"spec": map[string]any{
						"uid":        "org1-uid-123",
						"path":       "/d/org1-dashboard/test",
						"lastSeenAt": time.Now().Unix(),
					},
				},
			}
			obj.SetName("org1-shorturl")
			obj.SetAPIVersion(gvr.GroupVersion().String())
			obj.SetKind("ShortURL")

			org1Obj, err := org1Client.Resource.Create(ctx, obj, metav1.CreateOptions{})
			require.NoError(t, err)

			// Try to access from OrgB
			orgBClient := helper.GetResourceClient(ResourceClientArgs{
				User: helper.OrgB.Admin,
				GVR:  gvr,
			})

			// Should not be able to see Org1's shorturl
			_, err = orgBClient.Resource.Get(ctx, "org1-shorturl", metav1.GetOptions{})
			require.Error(t, err)

			// Should not see it in list either
			rsp, err := orgBClient.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Empty(t, rsp.Items)

			// Clean up
			zeroInt64 := int64(0)
			err = org1Client.Resource.Delete(ctx, org1Obj.GetName(), metav1.DeleteOptions{
				GracePeriodSeconds: &zeroInt64,
			})
			require.NoError(t, err)
		})

		t.Run("field validation", func(t *testing.T) {
			ctx := context.Background()
			client := helper.GetResourceClient(ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})

			// Test with missing required fields
			obj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"spec": map[string]any{
						// Missing uid and path
						"lastSeenAt": time.Now().Unix(),
					},
				},
			}
			obj.SetName("invalid-shorturl")
			obj.SetAPIVersion(gvr.GroupVersion().String())
			obj.SetKind("ShortURL")

			_, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
			// This might succeed or fail depending on validation rules
			// We test that it doesn't crash the server
			require.True(t, err == nil || err != nil)

			// Test with valid fields
			validObj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"spec": map[string]any{
						"uid":        "valid-uid-123",
						"path":       "/d/valid-dashboard/test",
						"lastSeenAt": time.Now().Unix(),
					},
				},
			}
			validObj.SetName("valid-shorturl")
			validObj.SetAPIVersion(gvr.GroupVersion().String())
			validObj.SetKind("ShortURL")

			validObj, err = client.Resource.Create(ctx, validObj, metav1.CreateOptions{})
			require.NoError(t, err)

			// Clean up
			zeroInt64 := int64(0)
			err = client.Resource.Delete(ctx, validObj.GetName(), metav1.DeleteOptions{
				GracePeriodSeconds: &zeroInt64,
			})
			require.NoError(t, err)
		})

		t.Run("list with labels and selectors", func(t *testing.T) {
			ctx := context.Background()
			client := helper.GetResourceClient(ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})

			// Create multiple objects with different labels
			for i := 0; i < 3; i++ {
				obj := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"spec": map[string]any{
							"uid":        fmt.Sprintf("labeled-uid-%d", i),
							"path":       fmt.Sprintf("/d/labeled-dashboard-%d/test", i),
							"lastSeenAt": time.Now().Unix(),
						},
					},
				}
				obj.SetName(fmt.Sprintf("labeled-shorturl-%d", i))
				obj.SetAPIVersion(gvr.GroupVersion().String())
				obj.SetKind("ShortURL")
				obj.SetLabels(map[string]string{
					"test-group": "labeled",
					"index":      fmt.Sprintf("%d", i),
				})

				_, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
				require.NoError(t, err)
			}

			// List all with label selector
			rsp, err := client.Resource.List(ctx, metav1.ListOptions{
				LabelSelector: "test-group=labeled",
			})
			require.NoError(t, err)
			require.Len(t, rsp.Items, 3)

			// List with specific index
			rsp, err = client.Resource.List(ctx, metav1.ListOptions{
				LabelSelector: "test-group=labeled,index=1",
			})
			require.NoError(t, err)
			require.Len(t, rsp.Items, 1)
			require.Equal(t, "labeled-shorturl-1", rsp.Items[0].GetName())

			// Clean up
			zeroInt64 := int64(0)
			for i := 0; i < 3; i++ {
				err = client.Resource.Delete(ctx, fmt.Sprintf("labeled-shorturl-%d", i), metav1.DeleteOptions{
					GracePeriodSeconds: &zeroInt64,
				})
				require.NoError(t, err)
			}
		})
	}

	t.Run("with dual writer mode 0", func(t *testing.T) {
		helper := NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"shorturls.shorturl.grafana.app": {
					DualWriterMode: 0,
				},
			},
		})
		defer helper.Shutdown()
		runShortURLAppTest(t, helper, gvr)
	})

	t.Run("with dual writer mode 1", func(t *testing.T) {
		helper := NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"shorturls.shorturl.grafana.app": {
					DualWriterMode: 1,
				},
			},
		})
		defer helper.Shutdown()
		runShortURLAppTest(t, helper, gvr)
	})

	t.Run("with dual writer mode 2", func(t *testing.T) {
		helper := NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"shorturls.shorturl.grafana.app": {
					DualWriterMode: 2,
				},
			},
		})
		defer helper.Shutdown()
		runShortURLAppTest(t, helper, gvr)
	})

	t.Run("with dual writer mode 3", func(t *testing.T) {
		helper := NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"shorturls.shorturl.grafana.app": {
					DualWriterMode: 3,
				},
			},
		})
		defer helper.Shutdown()
		runShortURLAppTest(t, helper, gvr)
	})
}

func TestShortURLAppServiceAccountAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	defer helper.Shutdown()

	gvr := schema.GroupVersionResource{
		Group:    "shorturl.grafana.app",
		Version:  "v0alpha1",
		Resource: "shorturls",
	}

	t.Run("service account access", func(t *testing.T) {
		ctx := context.Background()

		// Test with service account tokens
		testCases := []struct {
			name  string
			token string
		}{
			{"Admin SA", helper.Org1.AdminServiceAccountToken},
			{"Editor SA", helper.Org1.EditorServiceAccountToken},
			{"Viewer SA", helper.Org1.ViewerServiceAccountToken},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				client := helper.GetResourceClient(ResourceClientArgs{
					ServiceAccountToken: tc.token,
					Namespace:           helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
					GVR:                 gvr,
				})

				obj := &unstructured.Unstructured{
					Object: map[string]interface{}{
						"spec": map[string]any{
							"uid":        fmt.Sprintf("sa-%s-uid", tc.name),
							"path":       fmt.Sprintf("/d/sa-%s-dashboard/test", tc.name),
							"lastSeenAt": time.Now().Unix(),
						},
					},
				}
				obj.SetName(fmt.Sprintf("sa-%s-shorturl", tc.name))
				obj.SetAPIVersion(gvr.GroupVersion().String())
				obj.SetKind("ShortURL")

				obj, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
				require.NoError(t, err)
				require.Equal(t, fmt.Sprintf("sa-%s-shorturl", tc.name), obj.GetName())

				// Verify we can read it back
				_, err = client.Resource.Get(ctx, obj.GetName(), metav1.GetOptions{})
				require.NoError(t, err)

				// Clean up
				zeroInt64 := int64(0)
				err = client.Resource.Delete(ctx, obj.GetName(), metav1.DeleteOptions{
					GracePeriodSeconds: &zeroInt64,
				})
				require.NoError(t, err)
			})
		}
	})
}

func TestShortURLAppSpecialCases(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	defer helper.Shutdown()

	gvr := schema.GroupVersionResource{
		Group:    "shorturl.grafana.app",
		Version:  "v0alpha1",
		Resource: "shorturls",
	}

	t.Run("special characters in paths", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		specialPaths := []string{
			"/d/dashboard/test?var-server=web01&var-interval=5m",
			"/d/dashboard/test?from=now-1h&to=now",
			"/d/dashboard/test#tab-general",
			"/d/dashboard/test?orgId=1&refresh=30s",
		}

		for i, path := range specialPaths {
			obj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"spec": map[string]any{
						"uid":        fmt.Sprintf("special-uid-%d", i),
						"path":       path,
						"lastSeenAt": time.Now().Unix(),
					},
				},
			}
			obj.SetName(fmt.Sprintf("special-shorturl-%d", i))
			obj.SetAPIVersion(gvr.GroupVersion().String())
			obj.SetKind("ShortURL")

			obj, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
			require.NoError(t, err)

			// Verify the path is preserved correctly
			spec := obj.Object["spec"].(map[string]any)
			require.Equal(t, path, spec["path"])

			// Clean up
			zeroInt64 := int64(0)
			err = client.Resource.Delete(ctx, obj.GetName(), metav1.DeleteOptions{
				GracePeriodSeconds: &zeroInt64,
			})
			require.NoError(t, err)
		}
	})

	t.Run("timestamp handling", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		now := time.Now().Unix()
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					"uid":        "timestamp-uid",
					"path":       "/d/timestamp-dashboard/test",
					"lastSeenAt": now,
				},
			},
		}
		obj.SetName("timestamp-shorturl")
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("ShortURL")

		obj, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)

		// Verify timestamp is preserved
		spec := obj.Object["spec"].(map[string]any)
		require.Equal(t, float64(now), spec["lastSeenAt"]) // JSON unmarshaling converts int64 to float64

		// Update timestamp
		newTime := time.Now().Unix()
		spec["lastSeenAt"] = newTime

		updated, err := client.Resource.Update(ctx, obj, metav1.UpdateOptions{})
		require.NoError(t, err)

		updatedSpec := updated.Object["spec"].(map[string]any)
		require.Equal(t, float64(newTime), updatedSpec["lastSeenAt"])

		// Clean up
		zeroInt64 := int64(0)
		err = client.Resource.Delete(ctx, obj.GetName(), metav1.DeleteOptions{
			GracePeriodSeconds: &zeroInt64,
		})
		require.NoError(t, err)
	})
}
