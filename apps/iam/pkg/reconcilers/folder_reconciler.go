package reconcilers

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
)

func reconcile(ctx context.Context, req operator.TypedReconcileRequest[*foldersKind.Folder]) (operator.ReconcileResult, error) {
	logging.FromContext(ctx).Info("Reconciling folder", "name", req.Object.GetName(), "title", req.Object.Spec.Title)
	return operator.ReconcileResult{}, nil
}

func NewFolderReconciler(patchClient operator.PatchClient) (operator.Reconciler, error) {
	reconciler, err := operator.NewOpinionatedReconciler(patchClient, "folder-iam-finalizer")

	if err != nil {
		return nil, err
	}

	reconciler.Reconciler = &operator.TypedReconciler[*foldersKind.Folder]{
		ReconcileFunc: reconcile,
	}

	return reconciler, err
}
