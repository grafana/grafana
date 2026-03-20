package collab

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"
)

var testGVR = schema.GroupVersionResource{
	Group:    "dashboard.grafana.app",
	Version:  "v2alpha1",
	Resource: "dashboards",
}

func newTestDashboard(namespace, name, rv string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v2alpha1",
			"kind":       "Dashboard",
			"metadata": map[string]any{
				"name":            name,
				"namespace":       namespace,
				"resourceVersion": rv,
			},
			"spec": map[string]any{
				"title": "Test Dashboard",
			},
		},
	}
}

func setupK8sSaver(t *testing.T, objects ...runtime.Object) (*K8sDashboardSaver, *SessionManager, *dynamicfake.FakeDynamicClient) {
	t.Helper()
	sm := NewSessionManager()
	scheme := runtime.NewScheme()
	client := dynamicfake.NewSimpleDynamicClient(scheme, objects...)
	saver := NewK8sDashboardSaver(K8sDashboardSaverConfig{
		Client:   client,
		GVR:      testGVR,
		Sessions: sm,
	})
	return saver, sm, client
}

func TestK8sSaverSavesWithVersionTypeAnnotation(t *testing.T) {
	dash := newTestDashboard("default", "dash-1", "100")
	saver, sm, client := setupK8sSaver(t, dash)

	// Create session (no previous resourceVersion)
	sm.GetOrCreate("default", "dash-1")

	err := saver.Save(context.Background(), "default", "dash-1", "auto")
	require.NoError(t, err)

	// Verify the update was called with the version_type annotation.
	actions := client.Actions()
	var updateAction k8stesting.UpdateAction
	for _, a := range actions {
		if ua, ok := a.(k8stesting.UpdateAction); ok {
			updateAction = ua
			break
		}
	}
	require.NotNil(t, updateAction, "expected an update action")

	updatedObj := updateAction.GetObject().(*unstructured.Unstructured)
	annotations := updatedObj.GetAnnotations()
	require.Equal(t, "auto", annotations[AnnoKeyVersionType])
}

func TestK8sSaverUpdatesSessionResourceVersion(t *testing.T) {
	dash := newTestDashboard("default", "dash-1", "100")
	saver, sm, client := setupK8sSaver(t, dash)

	session := sm.GetOrCreate("default", "dash-1")

	// The fake client returns the object as-is on update. Prepend a reactor to
	// set a new resourceVersion on the response.
	client.PrependReactor("update", "dashboards", func(action k8stesting.Action) (bool, runtime.Object, error) {
		ua := action.(k8stesting.UpdateAction)
		obj := ua.GetObject().(*unstructured.Unstructured).DeepCopy()
		obj.SetResourceVersion("101")
		return true, obj, nil
	})

	err := saver.Save(context.Background(), "default", "dash-1", "auto")
	require.NoError(t, err)

	// Session should have updated resourceVersion.
	require.Equal(t, "101", session.GetResourceVersion())
}

func TestK8sSaverResourceVersionMismatchReturnsError(t *testing.T) {
	dash := newTestDashboard("default", "dash-1", "200")
	saver, sm, _ := setupK8sSaver(t, dash)

	// Session has a stale resourceVersion.
	session := sm.GetOrCreate("default", "dash-1")
	session.SetResourceVersion("100")

	err := saver.Save(context.Background(), "default", "dash-1", "auto")
	require.Error(t, err)
	require.Contains(t, err.Error(), "resource version mismatch")
}

func TestK8sSaverConflictErrorReturnsError(t *testing.T) {
	dash := newTestDashboard("default", "dash-1", "100")
	saver, sm, client := setupK8sSaver(t, dash)

	sm.GetOrCreate("default", "dash-1")

	// Simulate a 409 Conflict on update.
	client.PrependReactor("update", "dashboards", func(action k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewConflict(
			schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"},
			"dash-1",
			nil,
		)
	})

	err := saver.Save(context.Background(), "default", "dash-1", "auto")
	require.Error(t, err)
	require.Contains(t, err.Error(), "version conflict")
}

func TestK8sSaverGetNotFoundReturnsError(t *testing.T) {
	// No dashboard objects in the fake client.
	saver, sm, _ := setupK8sSaver(t)
	sm.GetOrCreate("default", "dash-1")

	err := saver.Save(context.Background(), "default", "dash-1", "auto")
	require.Error(t, err)
	require.Contains(t, err.Error(), "get dashboard")
}

func TestK8sSaverManualVersionType(t *testing.T) {
	dash := newTestDashboard("default", "dash-1", "100")
	saver, sm, client := setupK8sSaver(t, dash)

	sm.GetOrCreate("default", "dash-1")

	err := saver.Save(context.Background(), "default", "dash-1", "manual")
	require.NoError(t, err)

	// Verify manual version type annotation.
	actions := client.Actions()
	var updateAction k8stesting.UpdateAction
	for _, a := range actions {
		if ua, ok := a.(k8stesting.UpdateAction); ok {
			updateAction = ua
			break
		}
	}
	require.NotNil(t, updateAction)

	updatedObj := updateAction.GetObject().(*unstructured.Unstructured)
	annotations := updatedObj.GetAnnotations()
	require.Equal(t, "manual", annotations[AnnoKeyVersionType])
}

func TestK8sSaverMatchingResourceVersionSucceeds(t *testing.T) {
	dash := newTestDashboard("default", "dash-1", "100")
	saver, sm, client := setupK8sSaver(t, dash)

	// Session resourceVersion matches current — should proceed.
	session := sm.GetOrCreate("default", "dash-1")
	session.SetResourceVersion("100")

	client.PrependReactor("update", "dashboards", func(action k8stesting.Action) (bool, runtime.Object, error) {
		ua := action.(k8stesting.UpdateAction)
		obj := ua.GetObject().(*unstructured.Unstructured).DeepCopy()
		obj.SetResourceVersion("101")
		return true, obj, nil
	})

	err := saver.Save(context.Background(), "default", "dash-1", "auto")
	require.NoError(t, err)
	require.Equal(t, "101", session.GetResourceVersion())
}

func TestK8sSaverPreservesExistingAnnotations(t *testing.T) {
	dash := newTestDashboard("default", "dash-1", "100")
	// Add existing annotations.
	annotations := dash.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}
	annotations["grafana.app/folder"] = "my-folder"
	dash.SetAnnotations(annotations)

	saver, sm, client := setupK8sSaver(t, dash)
	sm.GetOrCreate("default", "dash-1")

	// Use a reactor to capture what was sent.
	var capturedAnnotations map[string]string
	client.PrependReactor("update", "dashboards", func(action k8stesting.Action) (bool, runtime.Object, error) {
		ua := action.(k8stesting.UpdateAction)
		obj := ua.GetObject().(*unstructured.Unstructured)
		capturedAnnotations = obj.GetAnnotations()
		result := obj.DeepCopy()
		result.SetResourceVersion("101")
		return true, result, nil
	})

	err := saver.Save(context.Background(), "default", "dash-1", "auto")
	require.NoError(t, err)

	require.Equal(t, "auto", capturedAnnotations[AnnoKeyVersionType])
	require.Equal(t, "my-folder", capturedAnnotations["grafana.app/folder"])
}

// Verify that K8sDashboardSaver satisfies the DashboardSaver interface.
var _ DashboardSaver = (*K8sDashboardSaver)(nil)
