package cascadedelete

import (
	"context"
	"fmt"
	"time"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"
)

var pendingGVR = foldersv1.PendingFolderDeletionResourceInfo.GroupVersionResource()

// PendingStore keeps recovery state independent of the folder's lifetime.
type PendingStore interface {
	Get(ctx context.Context, namespace, name string) (*foldersv1.PendingFolderDeletion, error)
	List(ctx context.Context, namespace, continuation string) (*foldersv1.PendingFolderDeletionList, error)
	Capture(ctx context.Context, entry *foldersv1.PendingFolderDeletion, timestamp metav1.Time) error
	Remove(ctx context.Context, entry *foldersv1.PendingFolderDeletion) error
}

type PendingClient struct {
	client dynamic.Interface
}

func NewPendingClient(client dynamic.Interface) *PendingClient {
	return &PendingClient{client: client}
}

func (p *PendingClient) Get(ctx context.Context, namespace, name string) (*foldersv1.PendingFolderDeletion, error) {
	u, err := p.client.Resource(pendingGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	entry := &foldersv1.PendingFolderDeletion{}
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, entry)
	return entry, err
}

func (p *PendingClient) List(ctx context.Context, namespace, continuation string) (*foldersv1.PendingFolderDeletionList, error) {
	u, err := p.client.Resource(pendingGVR).Namespace(namespace).List(ctx, metav1.ListOptions{Limit: 100, Continue: continuation})
	if err != nil {
		return nil, err
	}
	list := &foldersv1.PendingFolderDeletionList{}
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(u.UnstructuredContent(), list)
	return list, err
}

func (p *PendingClient) Capture(ctx context.Context, entry *foldersv1.PendingFolderDeletion, timestamp metav1.Time) error {
	if entry.Spec.DeletionTimestamp != nil {
		return nil
	}
	updated := entry.DeepCopy()
	value := timestamp.UTC().Format(time.RFC3339Nano)
	updated.Spec.DeletionTimestamp = &value
	u, err := runtime.DefaultUnstructuredConverter.ToUnstructured(updated)
	if err != nil {
		return err
	}
	_, err = p.client.Resource(pendingGVR).Namespace(entry.Namespace).Update(ctx, &unstructured.Unstructured{Object: u}, metav1.UpdateOptions{})
	return err
}

func (p *PendingClient) Remove(ctx context.Context, entry *foldersv1.PendingFolderDeletion) error {
	if entry.UID == "" || entry.ResourceVersion == "" {
		return fmt.Errorf("cannot remove pending deletion without UID and resource version")
	}
	return p.client.Resource(pendingGVR).Namespace(entry.Namespace).Delete(ctx, entry.Name, metav1.DeleteOptions{
		Preconditions: &metav1.Preconditions{UID: &entry.UID, ResourceVersion: &entry.ResourceVersion},
	})
}
