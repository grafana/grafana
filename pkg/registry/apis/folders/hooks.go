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
func (b *FolderAPIBuilder) beginCreate(ctx context.Context, obj runtime.Object, _ *metav1.CreateOptions) (registry.FinishFunc, error) {
	log := logging.FromContext(ctx)
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		log.Error("Failed to access new folder object metadata", "error", err)
		return nil, err
	}

	if meta.GetFolder() == "" {
		// Zanzana only cares about parent-child folder relationships; nothing to do if folder is at root.
		log.Info("Skipping Zanzana folder propagation for new root-level folder", "folder", meta.GetName())
		return func(ctx context.Context, success bool) {}, nil
	}

	return func(ctx context.Context, success bool) {
		if success {
			log.Info("Propagating new folder to Zanzana", "folder", meta.GetName(), "parent", meta.GetFolder())
			b.writeFolderToZanzana(ctx, meta)
		} else {
			log.Info("Got success=false in folder create hook", "folder", meta.GetName())
		}
	}, nil
}

// "Almost nobody should use this hook" but we do because we need ctx and AfterUpdate doesn't have it.
func (b *FolderAPIBuilder) beginUpdate(ctx context.Context, obj runtime.Object, old runtime.Object, _ *metav1.UpdateOptions) (registry.FinishFunc, error) {
	log := logging.FromContext(ctx)
	updatedMeta, err := utils.MetaAccessor(obj)
	if err != nil {
		log.Error("Failed to access updated folder object metadata", "error", err)
		return nil, err
	}
	oldMeta, err := utils.MetaAccessor(old)
	if err != nil {
		log.Error("Failed to access existing folder object metadata", "error", err)
		return nil, err
	}

	if updatedMeta.GetFolder() == oldMeta.GetFolder() {
		// No change to parent folder, nothing to do.
		log.Info("Skipping Zanzana folder propagation; no change in parent", "folder", oldMeta.GetName())
		return func(ctx context.Context, success bool) {}, nil
	}

	return func(ctx context.Context, success bool) {
		if success {
			log.Info("Propagating updated folder to Zanzana", "folder", oldMeta.GetName(), "oldParent", oldMeta.GetFolder(), "newParent", updatedMeta.GetFolder())
			b.writeFolderToZanzana(ctx, updatedMeta)
		} else {
			log.Info("Got success=false in folder update hook", "folder", oldMeta.GetName())
		}
	}, nil
}

func (b *FolderAPIBuilder) writeFolderToZanzana(ctx context.Context, folder utils.GrafanaMetaAccessor) {
	err := b.permissionStore.SetFolderParent(ctx, folder.GetNamespace(), folder.GetName(), folder.GetFolder())
	if err != nil {
		logging.FromContext(ctx).Warn("failed to propagate folder to zanzana", "err", err)
	}
}
