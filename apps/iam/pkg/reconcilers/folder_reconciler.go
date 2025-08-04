package reconcilers

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

type FolderReconciler struct {
	zanzanaClient zanzana.Client
}

// logRequestDetails is a helper function to log all request details automatically
func logRequestDetails(logger logging.Logger, req operator.TypedReconcileRequest[*foldersKind.Folder]) {
	// JSON marshaling provides the cleanest, most readable output
	if reqJSON, err := json.MarshalIndent(req, "", "  "); err == nil {
		logger.Info("Full request details", "request_json", string(reqJSON))
	} else {
		// Fallback to Go's built-in formatting if JSON marshaling fails
		logger.Info("Full request details", "request", fmt.Sprintf("%+v", req))
	}
}

func (r *FolderReconciler) Reconcile(ctx context.Context, req operator.TypedReconcileRequest[*foldersKind.Folder]) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)

	logRequestDetails(logger, req)

	return operator.ReconcileResult{}, nil
}

func NewFolderReconciler(patchClient operator.PatchClient, zanzanaClient zanzana.Client) (operator.Reconciler, error) {
	reconciler, err := operator.NewOpinionatedReconciler(patchClient, "folder-iam-finalizer")

	if err != nil {
		return nil, err
	}

	folderReconciler := &FolderReconciler{
		zanzanaClient: zanzanaClient,
	}

	reconciler.Reconciler = &operator.TypedReconciler[*foldersKind.Folder]{
		ReconcileFunc: folderReconciler.Reconcile,
	}

	return reconciler, err
}
