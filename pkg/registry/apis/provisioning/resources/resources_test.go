package resources

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	grafanautils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
)

// Use a GVR not in SupportsFolderAnnotation to avoid FolderManager dependency
// in tests that go through WriteResourceFromFile.
var (
	replaceTestGVK = schema.GroupVersionKind{Group: "alerting.grafana.app", Version: "v0alpha1", Kind: "AlertRule"}
	replaceTestGVR = schema.GroupVersionResource{Group: "alerting.grafana.app", Resource: "alertrules"}
)

func replaceRepoConfig() *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: testRepoName, Namespace: "default"},
	}
}

func mustBuildParsedResource(name string, client *MockDynamicResourceInterface) *ParsedResource {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "alerting.grafana.app/v0alpha1",
		"kind":       "AlertRule",
		"metadata":   map[string]any{"name": name},
	}}
	meta, err := grafanautils.MetaAccessor(obj)
	if err != nil {
		panic(err)
	}
	return &ParsedResource{
		Obj:    obj,
		Meta:   meta,
		GVK:    replaceTestGVK,
		GVR:    replaceTestGVR,
		Client: client,
		Repo:   testRepoInfo(),
	}
}

// newWritableParsedResource builds a ParsedResource whose client is set up to
// handle the Get+Update/Create upsert that WriteResourceFromFile→Run() performs.
func newWritableParsedResource(name string) (*ParsedResource, *MockDynamicResourceInterface) {
	client := &MockDynamicResourceInterface{}
	client.On("Get", mock.Anything, name, metav1.GetOptions{}, mock.Anything).
		Return(nil, apierrors.NewNotFound(schema.GroupResource{}, name))
	client.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, apierrors.NewNotFound(schema.GroupResource{}, name))
	client.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(&unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": name},
		}}, nil)

	return mustBuildParsedResource(name, client), client
}

func TestReplaceResourceFromFile(t *testing.T) {
	t.Run("name unchanged skips delete", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		fileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "alerts/rule.json"}
		repo.On("Read", mock.Anything, "alerts/rule.json", "").Return(fileInfo, nil)
		parsed, _ := newWritableParsedResource("same-uid")
		mockParser.On("Parse", mock.Anything, fileInfo).Return(parsed, nil)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		name, gvk, err := mgr.ReplaceResourceFromFile(context.Background(), "alerts/rule.json", "", "same-uid", replaceTestGVR)

		require.NoError(t, err)
		require.Equal(t, "same-uid", name)
		require.Equal(t, replaceTestGVK, gvk)
	})

	t.Run("empty oldName skips delete", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		fileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "alerts/rule.json"}
		repo.On("Read", mock.Anything, "alerts/rule.json", "").Return(fileInfo, nil)
		parsed, _ := newWritableParsedResource("new-uid")
		mockParser.On("Parse", mock.Anything, fileInfo).Return(parsed, nil)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		name, gvk, err := mgr.ReplaceResourceFromFile(context.Background(), "alerts/rule.json", "", "", replaceTestGVR)

		require.NoError(t, err)
		require.Equal(t, "new-uid", name)
		require.Equal(t, replaceTestGVK, gvk)
	})

	t.Run("name changed deletes old resource", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClients := NewMockResourceClients(t)
		deleteClient := &MockDynamicResourceInterface{}

		fileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "alerts/rule.json"}
		repo.On("Read", mock.Anything, "alerts/rule.json", "").Return(fileInfo, nil)
		repo.On("Config").Return(replaceRepoConfig())
		parsed, _ := newWritableParsedResource("new-uid")
		mockParser.On("Parse", mock.Anything, fileInfo).Return(parsed, nil)
		mockClients.On("ForResource", mock.Anything, replaceTestGVR).Return(deleteClient, replaceTestGVK, nil)

		grafanaObj := managedGrafanaObj("old-uid", "default", nil)
		deleteClient.On("Get", mock.Anything, "old-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		deleteClient.On("Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything).Return(nil)

		mgr := NewResourcesManager(repo, nil, mockParser, mockClients)
		name, gvk, err := mgr.ReplaceResourceFromFile(context.Background(), "alerts/rule.json", "", "old-uid", replaceTestGVR)

		require.NoError(t, err)
		require.Equal(t, "new-uid", name)
		require.Equal(t, replaceTestGVK, gvk)
		deleteClient.AssertCalled(t, "Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything)
	})

	t.Run("write failure propagated without delete attempt", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		repo.On("Read", mock.Anything, "alerts/rule.json", "").
			Return((*repository.FileInfo)(nil), fmt.Errorf("file not found"))

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, _, err := mgr.ReplaceResourceFromFile(context.Background(), "alerts/rule.json", "", "old-uid", replaceTestGVR)

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to read file")
	})

	t.Run("delete failure returns error with new name", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClients := NewMockResourceClients(t)
		deleteClient := &MockDynamicResourceInterface{}

		fileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "alerts/rule.json"}
		repo.On("Read", mock.Anything, "alerts/rule.json", "").Return(fileInfo, nil)
		repo.On("Config").Return(replaceRepoConfig())
		parsed, _ := newWritableParsedResource("new-uid")
		mockParser.On("Parse", mock.Anything, fileInfo).Return(parsed, nil)
		mockClients.On("ForResource", mock.Anything, replaceTestGVR).Return(deleteClient, replaceTestGVK, nil)

		grafanaObj := managedGrafanaObj("old-uid", "default", nil)
		deleteClient.On("Get", mock.Anything, "old-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		deleteClient.On("Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything).
			Return(fmt.Errorf("forbidden"))

		mgr := NewResourcesManager(repo, nil, mockParser, mockClients)
		name, gvk, err := mgr.ReplaceResourceFromFile(context.Background(), "alerts/rule.json", "", "old-uid", replaceTestGVR)

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to delete old resource old-uid")
		require.Equal(t, "new-uid", name)
		require.Equal(t, replaceTestGVK, gvk)
	})

	t.Run("ForResource error is propagated", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClients := NewMockResourceClients(t)

		fileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "alerts/rule.json"}
		repo.On("Read", mock.Anything, "alerts/rule.json", "").Return(fileInfo, nil)
		parsed, _ := newWritableParsedResource("new-uid")
		mockParser.On("Parse", mock.Anything, fileInfo).Return(parsed, nil)
		mockClients.On("ForResource", mock.Anything, replaceTestGVR).
			Return(nil, schema.GroupVersionKind{}, fmt.Errorf("unknown resource"))

		mgr := NewResourcesManager(repo, nil, mockParser, mockClients)
		name, _, err := mgr.ReplaceResourceFromFile(context.Background(), "alerts/rule.json", "", "old-uid", replaceTestGVR)

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to delete old resource old-uid")
		require.Equal(t, "new-uid", name)
	})
}

func TestReplaceResourceFromFileByRef(t *testing.T) {
	t.Run("name unchanged skips delete", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		oldFileInfo := &repository.FileInfo{Data: []byte(`{"old": true}`), Path: "alerts/rule.json"}
		newFileInfo := &repository.FileInfo{Data: []byte(`{"new": true}`), Path: "alerts/rule.json"}
		repo.On("Read", mock.Anything, "alerts/rule.json", "old-ref").Return(oldFileInfo, nil)
		repo.On("Read", mock.Anything, "alerts/rule.json", "new-ref").Return(newFileInfo, nil)

		oldParsed := mustBuildParsedResource("same-uid", nil)
		newParsed, _ := newWritableParsedResource("same-uid")
		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(oldParsed, nil)
		mockParser.On("Parse", mock.Anything, newFileInfo).Return(newParsed, nil)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		name, gvk, err := mgr.ReplaceResourceFromFileByRef(context.Background(), "alerts/rule.json", "new-ref", "old-ref")

		require.NoError(t, err)
		require.Equal(t, "same-uid", name)
		require.Equal(t, replaceTestGVK, gvk)
	})

	t.Run("name changed deletes old resource", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClients := NewMockResourceClients(t)
		deleteClient := &MockDynamicResourceInterface{}

		oldFileInfo := &repository.FileInfo{Data: []byte(`{"old": true}`), Path: "alerts/rule.json"}
		newFileInfo := &repository.FileInfo{Data: []byte(`{"new": true}`), Path: "alerts/rule.json"}
		repo.On("Read", mock.Anything, "alerts/rule.json", "old-ref").Return(oldFileInfo, nil)
		repo.On("Read", mock.Anything, "alerts/rule.json", "new-ref").Return(newFileInfo, nil)
		repo.On("Config").Return(replaceRepoConfig())

		oldParsed := mustBuildParsedResource("old-uid", nil)
		newParsed, _ := newWritableParsedResource("new-uid")
		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(oldParsed, nil)
		mockParser.On("Parse", mock.Anything, newFileInfo).Return(newParsed, nil)
		mockClients.On("ForResource", mock.Anything, replaceTestGVR).Return(deleteClient, replaceTestGVK, nil)

		grafanaObj := managedGrafanaObj("old-uid", "default", nil)
		deleteClient.On("Get", mock.Anything, "old-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		deleteClient.On("Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything).Return(nil)

		mgr := NewResourcesManager(repo, nil, mockParser, mockClients)
		name, gvk, err := mgr.ReplaceResourceFromFileByRef(context.Background(), "alerts/rule.json", "new-ref", "old-ref")

		require.NoError(t, err)
		require.Equal(t, "new-uid", name)
		require.Equal(t, replaceTestGVK, gvk)
		deleteClient.AssertCalled(t, "Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything)
	})

	t.Run("previous file read error is propagated", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		repo.On("Read", mock.Anything, "alerts/rule.json", "old-ref").
			Return((*repository.FileInfo)(nil), fmt.Errorf("ref not found"))

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, _, err := mgr.ReplaceResourceFromFileByRef(context.Background(), "alerts/rule.json", "new-ref", "old-ref")

		require.Error(t, err)
		require.Contains(t, err.Error(), "reading previous file")
	})

	t.Run("previous file parse error is propagated", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		oldFileInfo := &repository.FileInfo{Data: []byte(`not-json`), Path: "alerts/rule.json"}
		repo.On("Read", mock.Anything, "alerts/rule.json", "old-ref").Return(oldFileInfo, nil)
		mockParser.On("Parse", mock.Anything, oldFileInfo).
			Return(nil, fmt.Errorf("invalid JSON"))

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, _, err := mgr.ReplaceResourceFromFileByRef(context.Background(), "alerts/rule.json", "new-ref", "old-ref")

		require.Error(t, err)
		require.Contains(t, err.Error(), "parsing previous file")
	})

	t.Run("write failure propagated without delete attempt", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		oldFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "alerts/rule.json"}
		repo.On("Read", mock.Anything, "alerts/rule.json", "old-ref").Return(oldFileInfo, nil)
		repo.On("Read", mock.Anything, "alerts/rule.json", "new-ref").
			Return((*repository.FileInfo)(nil), fmt.Errorf("file not found"))

		oldParsed := mustBuildParsedResource("old-uid", nil)
		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(oldParsed, nil)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, _, err := mgr.ReplaceResourceFromFileByRef(context.Background(), "alerts/rule.json", "new-ref", "old-ref")

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to read file")
	})

	t.Run("delete failure returns error with new name", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClients := NewMockResourceClients(t)
		deleteClient := &MockDynamicResourceInterface{}

		oldFileInfo := &repository.FileInfo{Data: []byte(`{"old": true}`), Path: "alerts/rule.json"}
		newFileInfo := &repository.FileInfo{Data: []byte(`{"new": true}`), Path: "alerts/rule.json"}
		repo.On("Read", mock.Anything, "alerts/rule.json", "old-ref").Return(oldFileInfo, nil)
		repo.On("Read", mock.Anything, "alerts/rule.json", "new-ref").Return(newFileInfo, nil)
		repo.On("Config").Return(replaceRepoConfig())

		oldParsed := mustBuildParsedResource("old-uid", nil)
		newParsed, _ := newWritableParsedResource("new-uid")
		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(oldParsed, nil)
		mockParser.On("Parse", mock.Anything, newFileInfo).Return(newParsed, nil)
		mockClients.On("ForResource", mock.Anything, replaceTestGVR).Return(deleteClient, replaceTestGVK, nil)

		grafanaObj := managedGrafanaObj("old-uid", "default", nil)
		deleteClient.On("Get", mock.Anything, "old-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		deleteClient.On("Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything).
			Return(fmt.Errorf("forbidden"))

		mgr := NewResourcesManager(repo, nil, mockParser, mockClients)
		name, gvk, err := mgr.ReplaceResourceFromFileByRef(context.Background(), "alerts/rule.json", "new-ref", "old-ref")

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to delete old resource old-uid")
		require.Equal(t, "new-uid", name)
		require.Equal(t, replaceTestGVK, gvk)
	})

	t.Run("old name empty skips delete", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		oldFileInfo := &repository.FileInfo{Data: []byte(`{"old": true}`), Path: "alerts/rule.json"}
		newFileInfo := &repository.FileInfo{Data: []byte(`{"new": true}`), Path: "alerts/rule.json"}
		repo.On("Read", mock.Anything, "alerts/rule.json", "old-ref").Return(oldFileInfo, nil)
		repo.On("Read", mock.Anything, "alerts/rule.json", "new-ref").Return(newFileInfo, nil)

		oldParsed := mustBuildParsedResource("", nil)
		newParsed, _ := newWritableParsedResource("new-uid")
		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(oldParsed, nil)
		mockParser.On("Parse", mock.Anything, newFileInfo).Return(newParsed, nil)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		name, _, err := mgr.ReplaceResourceFromFileByRef(context.Background(), "alerts/rule.json", "new-ref", "old-ref")

		require.NoError(t, err)
		require.Equal(t, "new-uid", name)
	})
}

func TestDeleteOldResource(t *testing.T) {
	t.Run("successful delete", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockClients := NewMockResourceClients(t)
		mockClient := &MockDynamicResourceInterface{}

		repo.On("Config").Return(replaceRepoConfig())
		mockClients.On("ForResource", mock.Anything, replaceTestGVR).Return(mockClient, replaceTestGVK, nil)

		grafanaObj := managedGrafanaObj("old-uid", "default", map[string]any{
			grafanautils.AnnoKeySourcePath: "alerts/rule.json",
		})
		mockClient.On("Get", mock.Anything, "old-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		mockClient.On("Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything).Return(nil)

		mgr := NewResourcesManager(repo, nil, nil, mockClients)
		err := mgr.deleteOldResource(context.Background(), "alerts/rule.json", "old-uid", replaceTestGVR, "new-uid")

		require.NoError(t, err)
		mockClient.AssertCalled(t, "Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything)
	})

	t.Run("ForResource error is propagated", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockClients := NewMockResourceClients(t)

		mockClients.On("ForResource", mock.Anything, replaceTestGVR).
			Return(nil, schema.GroupVersionKind{}, fmt.Errorf("unknown resource"))

		mgr := NewResourcesManager(repo, nil, nil, mockClients)
		err := mgr.deleteOldResource(context.Background(), "alerts/rule.json", "old-uid", replaceTestGVR, "new-uid")

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to delete old resource old-uid")
		require.Contains(t, err.Error(), "unknown resource")
	})

	t.Run("sets correct namespace from repo config", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockClients := NewMockResourceClients(t)
		mockClient := &MockDynamicResourceInterface{}

		cfg := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: testRepoName, Namespace: "custom-ns"},
		}
		repo.On("Config").Return(cfg)
		mockClients.On("ForResource", mock.Anything, replaceTestGVR).Return(mockClient, replaceTestGVK, nil)

		grafanaObj := managedGrafanaObj("old-uid", "custom-ns", map[string]any{
			grafanautils.AnnoKeySourcePath: "alerts/rule.json",
		})
		mockClient.On("Get", mock.Anything, "old-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		mockClient.On("Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything).Return(nil)

		mgr := NewResourcesManager(repo, nil, nil, mockClients)
		err := mgr.deleteOldResource(context.Background(), "alerts/rule.json", "old-uid", replaceTestGVR, "new-uid")

		require.NoError(t, err)
	})

	t.Run("ownership check failure wraps error", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockClients := NewMockResourceClients(t)
		mockClient := &MockDynamicResourceInterface{}

		repo.On("Config").Return(replaceRepoConfig())
		mockClients.On("ForResource", mock.Anything, replaceTestGVR).Return(mockClient, replaceTestGVK, nil)

		unownedObj := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name":      "old-uid",
				"namespace": "default",
				"annotations": map[string]any{
					grafanautils.AnnoKeyManagerKind:     string(grafanautils.ManagerKindRepo),
					grafanautils.AnnoKeyManagerIdentity: "different-repo",
					grafanautils.AnnoKeySourcePath:      "alerts/rule.json",
				},
			},
		}}
		mockClient.On("Get", mock.Anything, "old-uid", metav1.GetOptions{}, mock.Anything).Return(unownedObj, nil)

		mgr := NewResourcesManager(repo, nil, nil, mockClients)
		err := mgr.deleteOldResource(context.Background(), "alerts/rule.json", "old-uid", replaceTestGVR, "new-uid")

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to delete old resource old-uid")
	})

	t.Run("skips delete when sourcePath points to a different file", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockClients := NewMockResourceClients(t)
		mockClient := &MockDynamicResourceInterface{}

		repo.On("Config").Return(replaceRepoConfig())
		mockClients.On("ForResource", mock.Anything, replaceTestGVR).Return(mockClient, replaceTestGVK, nil)

		grafanaObj := managedGrafanaObj("old-uid", "default", map[string]any{
			grafanautils.AnnoKeySourcePath: "alerts/other-file.json",
		})
		mockClient.On("Get", mock.Anything, "old-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)

		mgr := NewResourcesManager(repo, nil, nil, mockClients)
		err := mgr.deleteOldResource(context.Background(), "alerts/rule.json", "old-uid", replaceTestGVR, "new-uid")

		require.Error(t, err)
		require.Contains(t, err.Error(), "skipping delete of old resource old-uid")
		require.Contains(t, err.Error(), "alerts/other-file.json")
		mockClient.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("proceeds with delete when sourcePath is empty", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockClients := NewMockResourceClients(t)
		mockClient := &MockDynamicResourceInterface{}

		repo.On("Config").Return(replaceRepoConfig())
		mockClients.On("ForResource", mock.Anything, replaceTestGVR).Return(mockClient, replaceTestGVK, nil)

		grafanaObj := managedGrafanaObj("old-uid", "default", nil)
		mockClient.On("Get", mock.Anything, "old-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		mockClient.On("Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything).Return(nil)

		mgr := NewResourcesManager(repo, nil, nil, mockClients)
		err := mgr.deleteOldResource(context.Background(), "alerts/rule.json", "old-uid", replaceTestGVR, "new-uid")

		require.NoError(t, err)
		mockClient.AssertCalled(t, "Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything)
	})
}

// TestWrapAsValidationErrorIfNeeded pins the classification that decides
// whether an error produced while writing a resource becomes a job-level
// warning (non-fatal, the sync continues) or a hard error (fails the sync).
// Anything wrapped as *ResourceValidationError is later surfaced as a warning
// by jobs.classifyWarning.
func TestWrapAsValidationErrorIfNeeded(t *testing.T) {
	dashboardGK := schema.GroupKind{Group: "dashboard.grafana.app", Kind: "Dashboard"}

	t.Run("nil passes through", func(t *testing.T) {
		require.NoError(t, wrapAsValidationErrorIfNeeded(nil))
	})

	t.Run("already a ResourceValidationError is returned unchanged", func(t *testing.T) {
		original := NewResourceValidationError(errors.New("boom"))
		got := wrapAsValidationErrorIfNeeded(original)
		require.Same(t, original, got, "should return the same instance, not rewrap")
	})

	t.Run("field.Error is wrapped as a warning", func(t *testing.T) {
		fieldErr := field.Required(field.NewPath("metadata", "name"), "missing name")
		got := wrapAsValidationErrorIfNeeded(fieldErr)
		requireWrappedAsValidation(t, got)
	})

	t.Run("apierrors BadRequest is wrapped as a warning", func(t *testing.T) {
		badReq := apierrors.NewBadRequest("bad payload")
		got := wrapAsValidationErrorIfNeeded(badReq)
		requireWrappedAsValidation(t, got)
	})

	t.Run("apierrors Invalid (schema type mismatch) is wrapped as a warning", func(t *testing.T) {
		// Mirrors the dashboard apiserver's strict validation path, which
		// returns StatusReasonInvalid for CUE "conflicting values" failures.
		invalid := apierrors.NewInvalid(dashboardGK, "AWSLambda", field.ErrorList{
			field.Invalid(
				field.NewPath("spec", "refresh"),
				field.OmitValueType{},
				`conflicting values false and string (mismatched types bool and string)`,
			),
		})
		got := wrapAsValidationErrorIfNeeded(invalid)
		requireWrappedAsValidation(t, got)
		// The warning message should preserve the apiserver details so
		// operators can locate the offending field in the file.
		require.Contains(t, got.Error(), `Dashboard.dashboard.grafana.app "AWSLambda" is invalid`)
		require.Contains(t, got.Error(), "spec.refresh")
	})

	t.Run("apierrors Invalid (immutable metadata.name) is wrapped as a warning", func(t *testing.T) {
		// metadata.name immutability is enforced by apimachinery and returned
		// as StatusReasonInvalid. This is the "field is immutable" variant
		// seen when a file changes the name of an existing resource.
		invalid := apierrors.NewInvalid(dashboardGK, "API-initiation-monitor", field.ErrorList{
			field.Invalid(
				field.NewPath("metadata", "name"),
				"API-initiation-monitor",
				"field is immutable",
			),
		})
		got := wrapAsValidationErrorIfNeeded(invalid)
		requireWrappedAsValidation(t, got)
		require.Contains(t, got.Error(), "metadata.name")
		require.Contains(t, got.Error(), "field is immutable")
	})

	t.Run("apierrors Invalid wrapped with fmt.Errorf is still wrapped as a warning", func(t *testing.T) {
		// The sync path wraps the raw apiserver error with fmt.Errorf(%w).
		// errors.As / IsInvalid must still traverse the chain.
		invalid := apierrors.NewInvalid(dashboardGK, "dash", field.ErrorList{
			field.Invalid(field.NewPath("spec", "refresh"), field.OmitValueType{}, "mismatched types"),
		})
		wrapped := fmt.Errorf("writing resource: %w", invalid)
		got := wrapAsValidationErrorIfNeeded(wrapped)
		requireWrappedAsValidation(t, got)
	})

	t.Run("DashboardErr is wrapped as a warning", func(t *testing.T) {
		dErr := dashboardaccess.DashboardErr{
			StatusCode: 400,
			Status:     "bad-request",
			Reason:     "Dashboard refresh interval is too low",
		}
		got := wrapAsValidationErrorIfNeeded(dErr)
		requireWrappedAsValidation(t, got)
	})

	t.Run("ErrDuplicateName is wrapped as a warning", func(t *testing.T) {
		got := wrapAsValidationErrorIfNeeded(fmt.Errorf("dup: %w", ErrDuplicateName))
		requireWrappedAsValidation(t, got)
	})

	t.Run("ErrAlreadyInRepository is wrapped as a warning", func(t *testing.T) {
		got := wrapAsValidationErrorIfNeeded(fmt.Errorf("dup: %w", ErrAlreadyInRepository))
		requireWrappedAsValidation(t, got)
	})

	// The following are explicitly NOT wrapped: they represent transient or
	// authorization issues, or internal failures, where the whole sync should
	// surface as an error rather than being quietly downgraded to a warning.
	t.Run("apierrors Forbidden is not wrapped", func(t *testing.T) {
		forbidden := apierrors.NewForbidden(schema.GroupResource{Group: "g", Resource: "r"}, "foo", errors.New("nope"))
		got := wrapAsValidationErrorIfNeeded(forbidden)
		requireNotWrapped(t, got, forbidden)
	})

	t.Run("apierrors Conflict is not wrapped", func(t *testing.T) {
		conflict := apierrors.NewConflict(schema.GroupResource{Group: "g", Resource: "r"}, "foo", errors.New("version mismatch"))
		got := wrapAsValidationErrorIfNeeded(conflict)
		requireNotWrapped(t, got, conflict)
	})

	t.Run("apierrors InternalError is not wrapped", func(t *testing.T) {
		internal := apierrors.NewInternalError(errors.New("kaboom"))
		got := wrapAsValidationErrorIfNeeded(internal)
		requireNotWrapped(t, got, internal)
	})

	t.Run("arbitrary non-apimachinery errors are not wrapped", func(t *testing.T) {
		plain := errors.New("network timeout")
		got := wrapAsValidationErrorIfNeeded(plain)
		requireNotWrapped(t, got, plain)
	})
}

func requireWrappedAsValidation(t *testing.T, err error) {
	t.Helper()
	require.Error(t, err)
	var validationErr *ResourceValidationError
	require.True(t, errors.As(err, &validationErr),
		"error %q should be wrapped as *ResourceValidationError to become a job warning", err)
}

func requireNotWrapped(t *testing.T, got, original error) {
	t.Helper()
	require.Error(t, got)
	var validationErr *ResourceValidationError
	require.False(t, errors.As(got, &validationErr),
		"error %q should NOT be wrapped as *ResourceValidationError (would incorrectly become a warning)", got)
	require.Same(t, original, got, "non-wrapped errors should be returned unchanged")
}
