package folders

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// "Almost nobody should use this hook" but we do because we need ctx and AfterCreate doesn't have it.
func (b *FolderAPIBuilder) beginCreate(_ context.Context, obj runtime.Object, _ *metav1.CreateOptions) (registry.FinishFunc, error) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}

	if isFolderAtRoot(meta) {
		// Zanzana only cares about parent-child folder relationships; nothing to do if folder is at root.
		return func(ctx context.Context, success bool) {}, nil
	}

	return func(ctx context.Context, success bool) {
		if success {
			b.writeFolderToZanzana(ctx, meta)
		}
	}, nil
}

// "Almost nobody should use this hook" but we do because we need ctx and AfterUpdate doesn't have it.
func (b *FolderAPIBuilder) beginUpdate(_ context.Context, obj runtime.Object, old runtime.Object, _ *metav1.UpdateOptions) (registry.FinishFunc, error) {
	updatedMeta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	oldMeta, err := utils.MetaAccessor(old)
	if err != nil {
		return nil, err
	}

	if updatedMeta.GetFolder() == oldMeta.GetFolder() {
		// No change to parent folder, nothing to do.
		return func(ctx context.Context, success bool) {}, nil
	}

	return func(ctx context.Context, success bool) {
		if success {
			b.writeFolderToZanzana(ctx, updatedMeta)
		}
	}, nil
}

func (b *FolderAPIBuilder) writeFolderToZanzana(ctx context.Context, folder utils.GrafanaMetaAccessor) {
	err := b.permissionStore.SetFolderParent(ctx, folder.GetNamespace(), folder.GetName(), folder.GetFolder())
	if err != nil {
		logging.FromContext(ctx).Warn("failed to propagate folder to zanzana", "err", err)
	}
}

func isFolderAtRoot(folder utils.GrafanaMetaAccessor) bool {
	return folder.GetFolder() == ""
}
