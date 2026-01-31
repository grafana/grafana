package dashboards

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
)

func TestIntegrationSnapshotDualWrite(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	type testCase struct {
		name        string
		dualWrite   grafanarest.DualWriterMode
		features    []string
		description string
	}

	testCases := []testCase{
		{
			name:        "mode 0 - legacy only",
			dualWrite:   grafanarest.Mode0,
			features:    []string{featuremgmt.FlagKubernetesSnapshots},
			description: "In mode 0, all operations go through legacy storage only",
		},
		{
			name:        "mode 5 - unified storage read-write",
			dualWrite:   grafanarest.Mode5,
			features:    []string{featuremgmt.FlagKubernetesSnapshots},
			description: "In mode 5, all operations go through unified storage only",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				EnableFeatureToggles: tc.features,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					dashv0.SnapshotResourceInfo.GroupResource().String(): {
						DualWriterMode: tc.dualWrite,
					},
				},
			})

			// Use the default org namespace
			client := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  dashv0.SnapshotResourceInfo.GroupVersionResource(),
			})
			ns := client.Args.Namespace

			t.Log("Testing:", tc.description)

			t.Run("create and get snapshot", func(t *testing.T) {
				// Create a snapshot via K8s API
				snapshotName := "test-" + util.GenerateShortUID()
				snapshot := createTestSnapshot(snapshotName, ns)

				unstructuredSnapshot, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&snapshot)
				require.NoError(t, err)

				u := &unstructured.Unstructured{
					Object: unstructuredSnapshot,
				}

				// Create snapshot
				created, err := client.Resource.Create(context.Background(), u, metav1.CreateOptions{})

				// Both modes should support creation
				require.NoError(t, err, "Failed to create snapshot in mode %d", tc.dualWrite)
				require.NotNil(t, created)

				createdName := created.GetName()
				require.NotEmpty(t, createdName)

				// Verify created snapshot has expected fields
				spec, found, err := unstructured.NestedMap(created.Object, "spec")
				require.NoError(t, err)
				require.True(t, found, "spec should be present in created snapshot")

				// Assert title matches
				title, found, err := unstructured.NestedString(spec, "title")
				require.NoError(t, err)
				require.True(t, found, "title should be present")
				assert.Equal(t, *snapshot.Spec.Title, title, "title should match")

				// Assert expires field
				_, found, err = unstructured.NestedInt64(spec, "expires")
				require.NoError(t, err)
				require.True(t, found, "expires should be present")

				// Try to get the snapshot
				got, err := client.Resource.Get(context.Background(), createdName, metav1.GetOptions{})
				require.NoError(t, err, "Failed to get snapshot in mode %d", tc.dualWrite)
				require.NotNil(t, got)
				assert.Equal(t, createdName, got.GetName())

				// Verify retrieved snapshot also has the same fields
				gotSpec, found, err := unstructured.NestedMap(got.Object, "spec")
				require.NoError(t, err)
				require.True(t, found, "spec should be present in retrieved snapshot")

				// Dashboard data should not be returned directly in spec
				dashboard, found, err := unstructured.NestedMap(gotSpec, "dashboard")
				require.NoError(t, err)

				if tc.dualWrite == grafanarest.Mode0 {
					require.True(t, found, "dashboard data should be present")
					require.NotNil(t, dashboard, "dashboard should not be nil")
					// Verify title in retrieved snapshot
					gotTitle, found, err := unstructured.NestedString(gotSpec, "title")
					require.NoError(t, err)
					require.True(t, found, "title should be present in retrieved snapshot")
					assert.Equal(t, *snapshot.Spec.Title, gotTitle, "retrieved snapshot title should match")
				}

				//TODO: the dashboard data shouldn't be returned when implementing sub resource dashboard blob storage
				//else { // Mode5
				//	require.False(t, found, "dashboard data should not be present")
				//	require.Nil(t, dashboard, "dashboard should be nil")
				//}
			})

			t.Run("list snapshots", func(t *testing.T) {
				// Create multiple snapshots
				createdSnapshots := []string{}
				for i := 0; i < 3; i++ {
					snapshotName := fmt.Sprintf("list-test-%d-%s", i, util.GenerateShortUID())
					snapshot := createTestSnapshot(snapshotName, ns)
					snapshot.Spec.Title = toPtr(fmt.Sprintf("Test Snapshot %d", i))

					unstructuredSnapshot, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&snapshot)
					require.NoError(t, err)

					u := &unstructured.Unstructured{
						Object: unstructuredSnapshot,
					}

					created, err := client.Resource.Create(context.Background(), u, metav1.CreateOptions{})

					require.NoError(t, err)
					createdSnapshots = append(createdSnapshots, created.GetName())
				}

				// List snapshots
				list, err := client.Resource.List(context.Background(), metav1.ListOptions{})

				require.NoError(t, err)
				require.NotNil(t, list)

				items := list.Items
				assert.GreaterOrEqual(t, len(items), 3, "should have at least 3 snapshots")

				// Verify our created snapshots are in the list
				foundCount := 0
				for _, item := range items {
					for _, created := range createdSnapshots {
						if item.GetName() == created {
							foundCount++
							break
						}
					}
				}
				assert.Equal(t, 3, foundCount, "should find all 3 created snapshots")
			})

			t.Run("delete snapshot", func(t *testing.T) {
				// Create a snapshot
				snapshotName := "delete-test-" + util.GenerateShortUID()
				snapshot := createTestSnapshot(snapshotName, ns)

				unstructuredSnapshot, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&snapshot)
				require.NoError(t, err)

				u := &unstructured.Unstructured{
					Object: unstructuredSnapshot,
				}

				created, err := client.Resource.Create(context.Background(), u, metav1.CreateOptions{})

				require.NoError(t, err)
				createdName := created.GetName()

				// Delete the snapshot
				err = client.Resource.Delete(context.Background(), createdName, metav1.DeleteOptions{})

				// Both modes should support deletion
				require.NoError(t, err)

				// Verify it's deleted
				_, err = client.Resource.Get(context.Background(), createdName, metav1.GetOptions{})

				require.Error(t, err, "snapshot should be deleted")
			})
		})
	}
}

// Helper functions

func createTestSnapshot(name, namespace string) dashv0.Snapshot {
	deleteKey := util.GenerateShortUID()
	title := "Test Snapshot"
	external := false
	expires := int64(3600)

	return dashv0.Snapshot{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "dashboard.grafana.app/v0alpha1",
			Kind:       "Snapshot",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: dashv0.SnapshotSpec{
			Title:     &title,
			External:  &external,
			Expires:   &expires,
			DeleteKey: &deleteKey,
			Dashboard: map[string]interface{}{
				"title":         "Test Dashboard",
				"panels":        []interface{}{},
				"schemaVersion": 39,
				"time": map[string]interface{}{
					"from": "now-6h",
					"to":   "now",
				},
			},
		},
	}
}

// Helper for commented tests
func toPtr[T any](v T) *T {
	return &v
}
