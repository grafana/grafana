package dashboard

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	requestcontext "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestLibraryPanelAccessStorageMaterializesAndAuthorizesUpdate(t *testing.T) {
	oldPanel := testLibraryPanel("panel-a", "source")
	backend := &recordingLibraryPanelStorage{object: oldPanel}

	var authorizedOld, authorizedNew runtime.Object
	var authorizedNamespace string
	storage := newLibraryPanelAccessStorage(
		backend,
		func(context.Context, runtime.Object, string, string) error { return nil },
		func(_ context.Context, oldObj, newObj runtime.Object, namespace string) error {
			authorizedOld = oldObj
			authorizedNew = newObj
			authorizedNamespace = namespace
			return nil
		},
		func(context.Context, string, string) error { return nil },
		func(context.Context, runtime.Object) error { return nil },
	)

	patchInfo := rest.DefaultUpdatedObjectInfo(nil, func(_ context.Context, _ runtime.Object, oldObj runtime.Object) (runtime.Object, error) {
		require.NotSame(t, oldPanel, oldObj, "PATCH must not mutate the authorization source object")
		updated := oldObj.(*unstructured.Unstructured)
		updated.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "destination"})
		require.NoError(t, unstructured.SetNestedField(updated.Object, "patched", "spec", "description"))
		return updated, nil
	})

	ctx := requestcontext.WithNamespace(context.Background(), "stacks-1")
	updated, created, err := storage.Update(ctx, oldPanel.GetName(), patchInfo, nil, nil, false, &metav1.UpdateOptions{})
	require.NoError(t, err)
	require.False(t, created)
	require.True(t, backend.updateCalled)
	require.Same(t, oldPanel, authorizedOld)
	require.Equal(t, "source", authorizedOld.(*unstructured.Unstructured).GetAnnotations()[utils.AnnoKeyFolder])
	require.Equal(t, "destination", authorizedNew.(*unstructured.Unstructured).GetAnnotations()[utils.AnnoKeyFolder])
	require.Equal(t, "stacks-1", authorizedNamespace)
	description, found, err := unstructured.NestedString(updated.(*unstructured.Unstructured).Object, "spec", "description")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "patched", description)
}

func TestLibraryPanelAccessStorageRejectsDeniedUpdateAndDelete(t *testing.T) {
	panel := testLibraryPanel("panel-a", "general")
	backend := &recordingLibraryPanelStorage{object: panel}
	denied := apierrors.NewForbidden(
		schema.GroupResource{Group: "dashboard.grafana.app", Resource: "librarypanels"},
		panel.GetName(),
		errors.New("access denied"),
	)
	storage := newLibraryPanelAccessStorage(
		backend,
		func(_ context.Context, _ runtime.Object, verb, _ string) error {
			if verb == utils.VerbDelete {
				return denied
			}
			return nil
		},
		func(context.Context, runtime.Object, runtime.Object, string) error { return denied },
		func(context.Context, string, string) error { return nil },
		func(context.Context, runtime.Object) error { return nil },
	)

	_, _, err := storage.Update(context.Background(), panel.GetName(), rest.DefaultUpdatedObjectInfo(panel.DeepCopy()), nil, nil, false, &metav1.UpdateOptions{})
	require.ErrorIs(t, err, denied)
	require.False(t, backend.updateCalled)

	_, _, err = storage.Delete(context.Background(), panel.GetName(), nil, &metav1.DeleteOptions{})
	require.ErrorIs(t, err, denied)
	require.False(t, backend.deleteCalled)
}

func TestLibraryPanelAccessStorageRejectsConnectedDelete(t *testing.T) {
	panel := testLibraryPanel("panel-a", "general")
	backend := &recordingLibraryPanelStorage{object: panel}
	connected := apierrors.NewForbidden(
		schema.GroupResource{Group: "dashboard.grafana.app", Resource: "librarypanels"},
		panel.GetName(),
		errors.New("the library element has connections"),
	)
	var validatedName, validatedNamespace string
	storage := newLibraryPanelAccessStorage(
		backend,
		func(context.Context, runtime.Object, string, string) error { return nil },
		func(context.Context, runtime.Object, runtime.Object, string) error { return nil },
		func(_ context.Context, name, namespace string) error {
			validatedName = name
			validatedNamespace = namespace
			return connected
		},
		func(context.Context, runtime.Object) error { return nil },
	)

	ctx := requestcontext.WithNamespace(context.Background(), "stacks-1")
	_, _, err := storage.Delete(ctx, panel.GetName(), nil, &metav1.DeleteOptions{})
	require.ErrorIs(t, err, connected)
	require.Equal(t, panel.GetName(), validatedName)
	require.Equal(t, "stacks-1", validatedNamespace)
	require.False(t, backend.deleteCalled)
}

func TestLibraryPanelAccessStorageValidatesDestinationFolder(t *testing.T) {
	oldPanel := testLibraryPanel("panel-a", "source")
	backend := &recordingLibraryPanelStorage{object: oldPanel}
	folderErr := apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, "missing")
	validated := 0
	storage := newLibraryPanelAccessStorage(
		backend,
		func(context.Context, runtime.Object, string, string) error { return nil },
		func(context.Context, runtime.Object, runtime.Object, string) error { return nil },
		func(context.Context, string, string) error { return nil },
		func(_ context.Context, obj runtime.Object) error {
			validated++
			_, folder, err := libraryPanelAuthorizationTarget(obj)
			require.NoError(t, err)
			if folder == "missing" {
				return folderErr
			}
			return nil
		},
	)

	_, err := storage.Create(context.Background(), testLibraryPanel("new-panel", "missing"), nil, &metav1.CreateOptions{})
	require.ErrorIs(t, err, folderErr)

	patchInfo := rest.DefaultUpdatedObjectInfo(testLibraryPanel("panel-a", "missing"))
	_, _, err = storage.Update(context.Background(), oldPanel.GetName(), patchInfo, nil, nil, false, &metav1.UpdateOptions{})
	require.ErrorIs(t, err, folderErr)
	require.Equal(t, 2, validated)
	require.False(t, backend.updateCalled)
}

type recordingLibraryPanelStorage struct {
	rest.StandardStorage
	object       runtime.Object
	updateCalled bool
	deleteCalled bool
}

func (s *recordingLibraryPanelStorage) Get(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
	return s.object, nil
}

func (s *recordingLibraryPanelStorage) Update(ctx context.Context, _ string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	s.updateCalled = true
	updated, err := objInfo.UpdatedObject(ctx, s.object)
	return updated, false, err
}

func (s *recordingLibraryPanelStorage) Delete(context.Context, string, rest.ValidateObjectFunc, *metav1.DeleteOptions) (runtime.Object, bool, error) {
	s.deleteCalled = true
	return nil, true, nil
}

func testLibraryPanel(name, folder string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "dashboard.grafana.app/v0alpha1",
		"kind":       "LibraryPanel",
		"metadata": map[string]interface{}{
			"name": name,
			"annotations": map[string]interface{}{
				utils.AnnoKeyFolder: folder,
			},
		},
		"spec": map[string]interface{}{
			"type":        "text",
			"title":       "Panel",
			"panelTitle":  "Panel",
			"options":     map[string]interface{}{},
			"fieldConfig": map[string]interface{}{},
		},
	}}
}
