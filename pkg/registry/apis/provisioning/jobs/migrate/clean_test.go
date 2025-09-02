package migrate

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type mockClients struct {
	mock.Mock
}

func (m *mockClients) ForResource(gvr schema.GroupVersionResource) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
	args := m.Called(gvr)
	var ri dynamic.ResourceInterface
	if args.Get(0) != nil {
		ri = args.Get(0).(dynamic.ResourceInterface)
	}
	return ri, args.Get(1).(schema.GroupVersionKind), args.Error(2)
}

func (m *mockClients) ForKind(gvk schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error) {
	args := m.Called(gvk)
	var ri dynamic.ResourceInterface
	if args.Get(0) != nil {
		ri = args.Get(0).(dynamic.ResourceInterface)
	}
	return ri, args.Get(1).(schema.GroupVersionResource), args.Error(2)
}

func (m *mockClients) Folder() (dynamic.ResourceInterface, error) {
	args := m.Called()
	var ri dynamic.ResourceInterface
	if args.Get(0) != nil {
		ri = args.Get(0).(dynamic.ResourceInterface)
	}
	return ri, args.Error(1)
}

func (m *mockClients) User() (dynamic.ResourceInterface, error) {
	args := m.Called()
	var ri dynamic.ResourceInterface
	if args.Get(0) != nil {
		ri = args.Get(0).(dynamic.ResourceInterface)
	}
	return ri, args.Error(1)
}

func TestNamespaceCleaner_Clean(t *testing.T) {
	t.Run("should fail when getting clients fails", func(t *testing.T) {
		mockClientFactory := resources.NewMockClientFactory(t)
		mockClientFactory.On("Clients", mock.Anything, "test-namespace").
			Return(nil, errors.New("failed to get clients"))

		cleaner := NewNamespaceCleaner(mockClientFactory)
		progress := jobs.NewMockJobProgressRecorder(t)

		err := cleaner.Clean(context.Background(), "test-namespace", progress)
		require.Error(t, err)
		require.Contains(t, err.Error(), "get clients: failed to get clients")

		mockClientFactory.AssertExpectations(t)
	})

	t.Run("should fail when getting resource client fails", func(t *testing.T) {
		clients := &mockClients{}
		clients.On("ForResource", resources.SupportedProvisioningResources[0]).
			Return(nil, schema.GroupVersionKind{}, errors.New("failed to get resource client"))

		mockClientFactory := resources.NewMockClientFactory(t)
		mockClientFactory.On("Clients", mock.Anything, "test-namespace").
			Return(clients, nil)

		cleaner := NewNamespaceCleaner(mockClientFactory)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()

		err := cleaner.Clean(context.Background(), "test-namespace", progress)
		require.Error(t, err)
		require.Contains(t, err.Error(), "get resource client: failed to get resource client")

		mockClientFactory.AssertExpectations(t)
		clients.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should fail when delete operation fails", func(t *testing.T) {
		// Create a mock dynamic client that returns a list with one item
		mockDynamicClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"apiVersion": "folder.grafana.app/v1alpha1",
						"kind":       "Folder",
						"metadata": map[string]interface{}{
							"name": "test-folder",
						},
					},
				},
			},
			deleteError: errors.New("delete failed"),
		}

		clients := &mockClients{}
		clients.On("ForResource", mock.Anything).
			Return(mockDynamicClient, schema.GroupVersionKind{}, nil)

		mockClientFactory := resources.NewMockClientFactory(t)
		mockClientFactory.On("Clients", mock.Anything, "test-namespace").
			Return(clients, nil)

		cleaner := NewNamespaceCleaner(mockClientFactory)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionDeleted &&
				result.Name == "test-folder" &&
				result.Error != nil &&
				result.Error.Error() == "deleting resource folder.grafana.app/Folder test-folder: delete failed"
		})).Return()

		err := cleaner.Clean(context.Background(), "test-namespace", progress)
		require.Error(t, err)
		require.Contains(t, err.Error(), "delete resource: delete failed")

		mockClientFactory.AssertExpectations(t)
		clients.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should only delete unprovisioned resources", func(t *testing.T) {
		// Create a mock dynamic client that returns a list with mixed provisioned and unprovisioned items
		mockDynamicClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"apiVersion": "folder.grafana.app/v1alpha1",
						"kind":       "Folder",
						"metadata": map[string]interface{}{
							"name": "unprovisioned-folder",
							// No manager annotations - this is unprovisioned
						},
					},
				},
				{
					Object: map[string]interface{}{
						"apiVersion": "dashboard.grafana.app/v1alpha1",
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "provisioned-dashboard",
							"annotations": map[string]interface{}{
								"grafana.app/managerKind": "repo",
								"grafana.app/managerId":   "test-repo",
							},
						},
					},
				},
				{
					Object: map[string]interface{}{
						"apiVersion": "dashboard.grafana.app/v1alpha1",
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "unprovisioned-dashboard",
							// No manager annotations - this is unprovisioned
						},
					},
				},
			},
		}

		clients := &mockClients{}
		clients.On("ForResource", mock.Anything).
			Return(mockDynamicClient, schema.GroupVersionKind{}, nil)

		mockClientFactory := resources.NewMockClientFactory(t)
		mockClientFactory.On("Clients", mock.Anything, "test-namespace").
			Return(clients, nil)

		cleaner := NewNamespaceCleaner(mockClientFactory)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, "remove unprovisioned folders").Return()
		progress.On("SetMessage", mock.Anything, "remove unprovisioned dashboards").Return()

		// Expect only unprovisioned resources to be deleted (2 deletions)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionDeleted &&
				result.Name == "unprovisioned-folder" &&
				result.Error == nil
		})).Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionDeleted &&
				result.Name == "unprovisioned-dashboard" &&
				result.Error == nil
		})).Return()

		// Expect provisioned resource to be ignored (1 ignore)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionIgnored &&
				result.Name == "provisioned-dashboard" &&
				result.Error == nil
		})).Return()

		err := cleaner.Clean(context.Background(), "test-namespace", progress)
		require.NoError(t, err)

		mockClientFactory.AssertExpectations(t)
		clients.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should skip all provisioned resources", func(t *testing.T) {
		// Create a mock dynamic client with only provisioned resources
		mockDynamicClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{
				{
					Object: map[string]interface{}{
						"apiVersion": "dashboard.grafana.app/v1alpha1",
						"kind":       "Dashboard",
						"metadata": map[string]interface{}{
							"name": "repo-managed-dashboard",
							"annotations": map[string]interface{}{
								"grafana.app/managerKind": "repo",
								"grafana.app/managerId":   "my-repo",
							},
						},
					},
				},
				{
					Object: map[string]interface{}{
						"apiVersion": "folder.grafana.app/v1alpha1",
						"kind":       "Folder",
						"metadata": map[string]interface{}{
							"name": "file-provisioned-folder",
							"annotations": map[string]interface{}{
								"grafana.app/managerKind": "classic-file-provisioning",
								"grafana.app/managerId":   "file-provisioner",
							},
						},
					},
				},
			},
		}

		clients := &mockClients{}
		clients.On("ForResource", mock.Anything).
			Return(mockDynamicClient, schema.GroupVersionKind{}, nil)

		mockClientFactory := resources.NewMockClientFactory(t)
		mockClientFactory.On("Clients", mock.Anything, "test-namespace").
			Return(clients, nil)

		cleaner := NewNamespaceCleaner(mockClientFactory)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, "remove unprovisioned folders").Return()
		progress.On("SetMessage", mock.Anything, "remove unprovisioned dashboards").Return()

		// Expect both resources to be ignored (no deletions)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionIgnored &&
				result.Name == "repo-managed-dashboard" &&
				result.Error == nil
		})).Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionIgnored &&
				result.Name == "file-provisioned-folder" &&
				result.Error == nil
		})).Return()

		err := cleaner.Clean(context.Background(), "test-namespace", progress)
		require.NoError(t, err)

		mockClientFactory.AssertExpectations(t)
		clients.AssertExpectations(t)
		progress.AssertExpectations(t)
	})
}

// mockDynamicInterface implements a simplified version of the dynamic.ResourceInterface
type mockDynamicInterface struct {
	dynamic.ResourceInterface
	items       []unstructured.Unstructured
	deleteError error
}

func (m *mockDynamicInterface) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return &unstructured.UnstructuredList{
		Items: m.items,
	}, nil
}

func (m *mockDynamicInterface) Delete(ctx context.Context, name string, opts metav1.DeleteOptions, subresources ...string) error {
	return m.deleteError
}
