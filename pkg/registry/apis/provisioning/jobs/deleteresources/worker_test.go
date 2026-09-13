package deleteresources

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

var _ dynamic.ResourceInterface = (*fakeDynamicClient)(nil)

type fakeDynamicClient struct {
	deleteCalls []string
	deleteErr   error
}

func (f *fakeDynamicClient) Create(context.Context, *unstructured.Unstructured, metav1.CreateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("unexpected")
}
func (f *fakeDynamicClient) Update(context.Context, *unstructured.Unstructured, metav1.UpdateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("unexpected")
}
func (f *fakeDynamicClient) UpdateStatus(context.Context, *unstructured.Unstructured, metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	panic("unexpected")
}
func (f *fakeDynamicClient) Delete(_ context.Context, name string, _ metav1.DeleteOptions, _ ...string) error {
	f.deleteCalls = append(f.deleteCalls, name)
	return f.deleteErr
}
func (f *fakeDynamicClient) DeleteCollection(context.Context, metav1.DeleteOptions, metav1.ListOptions) error {
	panic("unexpected")
}
func (f *fakeDynamicClient) Get(context.Context, string, metav1.GetOptions, ...string) (*unstructured.Unstructured, error) {
	panic("unexpected")
}
func (f *fakeDynamicClient) List(context.Context, metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	panic("unexpected")
}
func (f *fakeDynamicClient) Watch(context.Context, metav1.ListOptions) (watch.Interface, error) {
	panic("unexpected")
}
func (f *fakeDynamicClient) Patch(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*unstructured.Unstructured, error) {
	panic("unexpected")
}
func (f *fakeDynamicClient) Apply(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions, ...string) (*unstructured.Unstructured, error) {
	panic("unexpected")
}
func (f *fakeDynamicClient) ApplyStatus(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("unexpected")
}

func TestWorker_IsSupported(t *testing.T) {
	w := NewWorker(nil, nil, 1)

	tests := []struct {
		name     string
		action   provisioning.JobAction
		expected bool
	}{
		{"deleteResources is supported", provisioning.JobActionDeleteResources, true},
		{"releaseResources is not supported", provisioning.JobActionReleaseResources, false},
		{"pull is not supported", provisioning.JobActionPull, false},
		{"push is not supported", provisioning.JobActionPush, false},
		{"delete is not supported", provisioning.JobActionDelete, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := provisioning.Job{Spec: provisioning.JobSpec{Action: tt.action}}
			require.Equal(t, tt.expected, w.IsSupported(context.Background(), job))
		})
	}
}

func TestWorker_Process(t *testing.T) {
	ctx := context.Background()
	lister := resources.NewMockResourceLister(t)
	clientFactory := resources.NewMockClientFactory(t)
	mockClients := resources.NewMockResourceClients(t)
	fakeClient := &fakeDynamicClient{}

	w := NewWorker(lister, clientFactory, 1)

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "default"},
		Spec: provisioning.JobSpec{
			Action:     provisioning.JobActionDeleteResources,
			Repository: "my-repo",
		},
	}

	items := &provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Name: "dash-1", Group: "dashboard.grafana.app", Resource: "dashboards"},
			{Name: "folder-1", Group: "folder.grafana.app", Resource: "folders"},
		},
	}

	lister.EXPECT().List(mock.Anything, "default", "my-repo").Return(items, nil)
	clientFactory.EXPECT().Clients(mock.Anything, "default").Return(mockClients, nil)
	mockClients.EXPECT().ForResource(mock.Anything, mock.Anything).Return(fakeClient, schema.GroupVersionKind{}, nil)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetTotal", mock.Anything, 2).Return()
	progress.On("SetMessage", mock.Anything, mock.Anything).Return()
	progress.On("Record", mock.Anything, mock.Anything).Return()
	progress.On("TooManyErrors").Return(nil)

	err := w.Process(ctx, nil, job, progress)
	require.NoError(t, err)
	require.Equal(t, []string{"dash-1", "folder-1"}, fakeClient.deleteCalls)
}

func TestWorker_Process_EmptyResourceList(t *testing.T) {
	ctx := context.Background()
	lister := resources.NewMockResourceLister(t)
	w := NewWorker(lister, nil, 1)

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "default"},
		Spec: provisioning.JobSpec{
			Action:     provisioning.JobActionDeleteResources,
			Repository: "my-repo",
		},
	}

	lister.EXPECT().List(mock.Anything, "default", "my-repo").Return(&provisioning.ResourceList{}, nil)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, mock.Anything).Return()
	progress.On("SetTotal", mock.Anything, 0).Return()

	err := w.Process(ctx, nil, job, progress)
	require.NoError(t, err)
}

func TestWorker_Process_ListError(t *testing.T) {
	ctx := context.Background()
	lister := resources.NewMockResourceLister(t)
	w := NewWorker(lister, nil, 1)

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "default"},
		Spec: provisioning.JobSpec{
			Action:     provisioning.JobActionDeleteResources,
			Repository: "gone-repo",
		},
	}

	lister.EXPECT().List(mock.Anything, "default", "gone-repo").Return(nil, errors.New("storage error"))

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetMessage", mock.Anything, mock.Anything).Return()

	err := w.Process(ctx, nil, job, progress)
	require.ErrorContains(t, err, "list managed resources")
}

func TestWorker_Process_HealthyRepoRejected(t *testing.T) {
	w := NewWorker(nil, nil, 1)

	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "healthy-repo"},
	})

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "default"},
		Spec: provisioning.JobSpec{
			Action:     provisioning.JobActionDeleteResources,
			Repository: "healthy-repo",
		},
	}

	progress := jobs.NewMockJobProgressRecorder(t)

	err := w.Process(context.Background(), mockRepo, job, progress)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "was recreated")
}

func TestWorker_Process_NotFoundResourceSkipped(t *testing.T) {
	ctx := context.Background()
	lister := resources.NewMockResourceLister(t)
	clientFactory := resources.NewMockClientFactory(t)
	mockClients := resources.NewMockResourceClients(t)

	notFoundErr := apierrors.NewNotFound(schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}, "dash-1")
	fakeClient := &fakeDynamicClient{deleteErr: notFoundErr}

	w := NewWorker(lister, clientFactory, 1)

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Namespace: "default"},
		Spec: provisioning.JobSpec{
			Action:     provisioning.JobActionDeleteResources,
			Repository: "my-repo",
		},
	}

	items := &provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Name: "dash-1", Group: "dashboard.grafana.app", Resource: "dashboards"},
		},
	}

	lister.EXPECT().List(mock.Anything, "default", "my-repo").Return(items, nil)
	clientFactory.EXPECT().Clients(mock.Anything, "default").Return(mockClients, nil)
	mockClients.EXPECT().ForResource(mock.Anything, mock.Anything).Return(fakeClient, schema.GroupVersionKind{}, nil)

	progress := jobs.NewMockJobProgressRecorder(t)
	progress.On("SetTotal", mock.Anything, 1).Return()
	progress.On("SetMessage", mock.Anything, mock.Anything).Return()
	progress.On("Record", mock.Anything, mock.Anything).Return()
	progress.On("TooManyErrors").Return(nil)

	err := w.Process(ctx, nil, job, progress)
	require.NoError(t, err)
}
