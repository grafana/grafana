package folders

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Almost nobody should use this style hook.
func (b *FolderAPIBuilder) beginCreate(ctx context.Context, obj runtime.Object, options *metav1.CreateOptions) (registry.FinishFunc, error) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	fmt.Printf("before create folder: %s, parent: %s\n", meta.GetName(), meta.GetFolder())
	return func(ctx context.Context, success bool) {
		fmt.Printf("created folder: %s: success: %v\n", meta.GetName(), success)
	}, nil
}

// Almost nobody should use this style hook.
func (b *FolderAPIBuilder) beginUpdate(ctx context.Context, obj, old runtime.Object, options *metav1.UpdateOptions) (registry.FinishFunc, error) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	fmt.Printf("before update folder: %s, parent: %s\n", meta.GetName(), meta.GetFolder())
	return func(ctx context.Context, success bool) {
		fmt.Printf("updated folder: %s: success: %v\n", meta.GetName(), success)
	}, nil
}

// no context????
func (b *FolderAPIBuilder) afterDelete(obj runtime.Object, options *metav1.DeleteOptions) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return // ????
	}
	fmt.Printf("after delete folder: %s, parent: %s\n", meta.GetName(), meta.GetFolder())
}
