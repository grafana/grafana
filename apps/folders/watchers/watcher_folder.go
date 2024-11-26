package watchers

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/resource"
	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	meta "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/klog/v2"
)

type FolderWatcher struct {
	storage grafanarest.Storage
}

func NewFolderWatcher(s grafanarest.Storage) (*FolderWatcher, error) {
	return &FolderWatcher{
		storage: s,
	}, nil
}

// Delete handles delete events for folder.Folder resources.
func (w *FolderWatcher) Delete(ctx context.Context, rObj resource.Object) error {
	metadata := rObj.GetStaticMetadata()
	if metadata.Kind != folder.RESOURCE {
		return fmt.Errorf("provided object is not of type *folder.Folder (name=%s, namespace=%s, kind=%s)",
			metadata.Name, metadata.Namespace, metadata.Kind)
	}

	// find all children of the object that just got deleted
	parent := rObj.GetName()
	namespace := rObj.GetNamespace()
	matched, err := w.storage.List(ctx, &internalversion.ListOptions{TypeMeta: meta.TypeMeta{Kind: folder.RESOURCE}, FieldSelector: fields.AndSelectors(
		fields.OneTermEqualSelector("metadata.annotations.grafana.app/folder", parent),
		fields.OneTermEqualSelector("metadata.namespace", namespace),
	)})
	if err != nil {
		klog.InfoS("could not list resources", "error", err)
	}

	obj, ok := matched.(resource.Object)
	if !ok {
		return err
	}

	name := obj.GetName()
	if err != nil {
		klog.Error("could not access metadata", "error", err)
		return err
	}

	if _, _, err := w.storage.Delete(ctx, name, func(context.Context, runtime.Object) error { return nil }, &meta.DeleteOptions{}); err != nil {
		klog.Error("could not delete folder child", "error", err)
		return err
	}

	return nil
}
