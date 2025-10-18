package folders

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util"
)

// K8S docs say "Almost nobody should use this hook" about the "begin" hooks, but we do because we only need to
// propagate if unistore write is successful.  It also allows us to be a bit smarter about when to propagate, e.g.
// skipping root-level folders, skipping updates that don't change parent, etc.

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

func (b *FolderAPIBuilder) afterDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	ctx := context.Background()
	log := logging.DefaultLogger
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		log.Error("Failed to access deleted folder object metadata", "error", err)
		return
	}

	if b.features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		log.Info("Propagating deleted folder to Zanzana", "folder", meta.GetName(), "parent", meta.GetFolder())
		err = b.permissionStore.DeleteFolderParents(ctx, meta.GetNamespace(), meta.GetName())
		if err != nil {
			log.Warn("failed to propagate folder to zanzana", "err", err)
		}
	}

	if b.resourcePermissionsSvc != nil {
		log.Debug("deleting folder permissions", "uid", meta.GetName(), "namespace", meta.GetNamespace())
		client := (*b.resourcePermissionsSvc).Namespace(meta.GetNamespace())
		err := client.Delete(ctx, fmt.Sprintf("%s-%s-%s", folders.FolderResourceInfo.GroupVersionResource().Group, folders.FolderResourceInfo.GroupVersionResource().Resource, meta.GetName()), metav1.DeleteOptions{})
		if err != nil && !apierrors.IsNotFound(err) {
			log.Error("failed to delete folder permissions", "error", err)
		}
		return
	}

	// TODO: once the feature flag kubernetesAuthzResourcePermissionApis is removed, we should initialize resourcePermissionsSvc
	// in the RegisterAPIService function and the below should be removed
	if !util.IsInterfaceNil(b.folderPermissionsSvc) {
		ns, err := claims.ParseNamespace(meta.GetNamespace())
		if err != nil {
			log.Error("failed to parse namespace", "error", err)
			return
		}
		if accessErr := b.folderPermissionsSvc.DeleteResourcePermissions(ctx, ns.OrgID, meta.GetName()); accessErr != nil {
			log.Warn("failed to delete folder permission after successfully deleting folder resource", "folder", meta.GetName(), "error", accessErr)
		}
	}
}

func (b *FolderAPIBuilder) writeFolderToZanzana(ctx context.Context, folder utils.GrafanaMetaAccessor) {
	err := b.permissionStore.SetFolderParent(ctx, folder.GetNamespace(), folder.GetName(), folder.GetFolder())
	if err != nil {
		logging.FromContext(ctx).Warn("failed to propagate folder to zanzana", "err", err)
	}
}
