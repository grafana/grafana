package reconcilers

import (
	"context"
	"fmt"

	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
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
	tracer := otel.GetTracerProvider().Tracer("iam-folder-reconciler")
	ctx, span := tracer.Start(ctx, "APIFolderStore.GetFolderParent",
		trace.WithAttributes(
			attribute.String("folder.uid", uid),
			attribute.String("folder.namespace", namespace),
		),
	)
	defer span.End()

	client, err := s.client(namespace)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create kubernetes client")
		return "", fmt.Errorf("create resource client: %w", err)
	}

	// Get the folder by UID
	unstructuredObj, err := client.Get(ctx, uid, metav1.GetOptions{})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get folder from kubernetes API")
		return "", fmt.Errorf("get folder %s: %w", uid, err)
	}

	object, err := utils.MetaAccessor(unstructuredObj)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get meta accessor from folder object")
		return "", fmt.Errorf("get meta accessor: %w", err)
	}

	parentUID := object.GetFolder()
	span.SetAttributes(attribute.String("folder.parent_uid", parentUID))
	span.SetStatus(codes.Ok, "successfully retrieved folder parent")
	span.AddEvent("folder.parent.retrieved", trace.WithAttributes(
		attribute.String("parent.uid", parentUID),
	))

	return parentUID, nil
}

func (s *APIFolderStore) client(namespace string) (dynamic.ResourceInterface, error) {
	client, err := dynamic.NewForConfig(s.config)
	if err != nil {
		return nil, err
	}
	return client.Resource(foldersKind.FolderResourceInfo.GroupVersionResource()).Namespace(namespace), nil
}
