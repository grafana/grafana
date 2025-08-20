package reconcilers

import (
	"context"
	"fmt"

	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

var _ FolderStore = (*APIFolderStore)(nil)

func NewAPIFolderStore(config *rest.Config) FolderStore {
	return &APIFolderStore{config}
}

type APIFolderStore struct {
	config *rest.Config
}

func (s *APIFolderStore) GetFolderParent(ctx context.Context, namespace, uid string) (string, error) {
	client, err := s.client(namespace)
	if err != nil {
		return "", fmt.Errorf("create resource client: %w", err)
	}

	// Get the folder by UID
	unstructuredObj, err := client.Get(ctx, uid, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("get folder %s: %w", uid, err)
	}

	object, err := utils.MetaAccessor(unstructuredObj)
	if err != nil {
		return "", fmt.Errorf("get meta accessor: %w", err)
	}

	return object.GetFolder(), nil
}

func (s *APIFolderStore) client(namespace string) (dynamic.ResourceInterface, error) {
	client, err := dynamic.NewForConfig(s.config)
	if err != nil {
		return nil, err
	}
	return client.Resource(foldersKind.FolderResourceInfo.GroupVersionResource()).Namespace(namespace), nil
}
