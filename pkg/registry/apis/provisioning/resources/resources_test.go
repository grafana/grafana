package resources

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	grafanautils "github.com/grafana/grafana/pkg/apimachinery/utils"
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
