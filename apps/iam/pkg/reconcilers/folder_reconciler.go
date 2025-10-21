package reconcilers

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/authz"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// PermissionStore interface for managing folder permissions
type PermissionStore interface {
	GetFolderParents(ctx context.Context, namespace, folderUID string) ([]string, error)
	SetFolderParent(ctx context.Context, namespace, folderUID, parentUID string) error
	DeleteFolderParents(ctx context.Context, namespace, folderUID string) error
}

// ReconcilerConfig represents the app-specific configuration
type ReconcilerConfig struct {
	ZanzanaCfg authz.ZanzanaClientConfig
	Metrics    *ReconcilerMetrics
}

type FolderReconciler struct {
	permissionStore PermissionStore
	metrics         *ReconcilerMetrics
}

func NewFolderReconciler(cfg ReconcilerConfig) (operator.Reconciler, error) {
	// Create Zanzana client
	zanzanaClient, err := authz.NewZanzanaClient("*", cfg.ZanzanaCfg)

	if err != nil {
		return nil, fmt.Errorf("unable to create zanzana client: %w", err)
	}

	// Create dependencies
	permissionStore := NewZanzanaPermissionStore(zanzanaClient)

	folderReconciler := &FolderReconciler{
		permissionStore: permissionStore,
		metrics:         cfg.Metrics,
	}

	reconciler := &operator.TypedReconciler[*foldersKind.Folder]{
		ReconcileFunc: folderReconciler.reconcile,
	}

	return reconciler, nil
}

// actionToString converts a ReconcileAction to a human-readable string
func actionToString(action operator.ReconcileAction) string {
	switch action {
	case operator.ReconcileActionCreated:
		return "create"
	case operator.ReconcileActionUpdated:
		return "update"
	case operator.ReconcileActionDeleted:
		return "delete"
	default:
		return "unknown"
	}
}

func (r *FolderReconciler) reconcile(ctx context.Context, req operator.TypedReconcileRequest[*foldersKind.Folder]) (operator.ReconcileResult, error) {
	// Create root span for the entire reconciliation process
	tracer := otel.GetTracerProvider().Tracer("iam-folder-reconciler")
	ctx, span := tracer.Start(ctx, "folder.reconcile",
		trace.WithAttributes(
			attribute.String("action", actionToString(req.Action)),
			attribute.String("folder.uid", req.Object.Name),
			attribute.String("namespace", req.Object.Namespace),
		),
	)
	defer span.End()

	// Add timeout to prevent hanging operations
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	action := actionToString(req.Action)

	err := validateFolder(req.Object)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "validation failed")
		if r.metrics != nil {
			r.metrics.RecordReconcileFailure(action, "informer")
		}
		return operator.ReconcileResult{}, err
	}

	var result operator.ReconcileResult
	switch req.Action {
	case operator.ReconcileActionCreated:
		result, err = r.handleUpdateFolder(ctx, req.Object, action)
	case operator.ReconcileActionUpdated:
		result, err = r.handleUpdateFolder(ctx, req.Object, action)
	case operator.ReconcileActionDeleted:
		result, err = r.handleDeleteFolder(ctx, req.Object, action)
	default:
		if r.metrics != nil {
			r.metrics.RecordReconcileSuccess(action, "no_changes_needed")
		}
		return operator.ReconcileResult{}, nil
	}

	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "reconciliation failed")
	}

	return result, err
}

func (r *FolderReconciler) handleUpdateFolder(ctx context.Context, folder *foldersKind.Folder, action string) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)

	folderUID := folder.Name
	namespace := folder.Namespace

	parentUID, err := getFolderParent(ctx, folder)
	if err != nil {
		logger.Error("Error getting folder parent", "error", err)
		if r.metrics != nil {
			r.metrics.RecordReconcileFailure(action, "failure_informer")
		}
		return operator.ReconcileResult{}, err
	}

	parents, err := r.permissionStore.GetFolderParents(ctx, namespace, folderUID)
	if err != nil {
		logger.Error("Error getting folder parents", "error", err)
		if r.metrics != nil {
			r.metrics.RecordReconcileFailure(action, "permission_store")
		}
		return operator.ReconcileResult{}, err
	}

	if (len(parents) == 0 && parentUID == "") || (len(parents) == 1 && parents[0] == parentUID) {
		logger.Info("Folder is already reconciled", "folder", folderUID, "parent", parentUID, "namespace", namespace)
		if r.metrics != nil {
			r.metrics.RecordReconcileSuccess(action, "no_changes_needed")
		}
		return operator.ReconcileResult{}, nil
	}

	err = r.permissionStore.SetFolderParent(ctx, namespace, folderUID, parentUID)
	if err != nil {
		logger.Error("Error setting folder parent", "error", err)
		if r.metrics != nil {
			r.metrics.RecordReconcileFailure(action, "permission_store")
		}
		return operator.ReconcileResult{}, err
	}

	logger.Info("Folder parent set in permission store", "folder", folderUID, "parent", parentUID, "namespace", namespace)

	if r.metrics != nil {
		r.metrics.RecordReconcileSuccess(action, "changes_made")
	}

	return operator.ReconcileResult{}, nil
}

func (r *FolderReconciler) handleDeleteFolder(ctx context.Context, folder *foldersKind.Folder, action string) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)

	namespace := folder.Namespace
	folderUID := folder.Name

	err := r.permissionStore.DeleteFolderParents(ctx, namespace, folderUID)
	if err != nil {
		logger.Error("Error deleting folder parents", "error", err)
		if r.metrics != nil {
			r.metrics.RecordReconcileFailure(action, "permission_store")
		}
		return operator.ReconcileResult{}, err
	}

	logger.Info("Folder deleted from permission store", "folder", folderUID, "namespace", namespace)

	if r.metrics != nil {
		r.metrics.RecordReconcileSuccess(action, "changes_made")
	}

	return operator.ReconcileResult{}, nil
}

func validateFolder(folder *foldersKind.Folder) error {
	if folder == nil {
		return fmt.Errorf("folder is nil")
	}
	if folder.Name == "" {
		return fmt.Errorf("folder UID (ObjectMeta.Name) is empty")
	}
	if folder.Namespace == "" {
		return fmt.Errorf("folder namespace is empty")
	}
	return nil
}

func getFolderParent(ctx context.Context, folder *foldersKind.Folder) (string, error) {
	tracer := otel.GetTracerProvider().Tracer("iam-folder-reconciler")
	_, span := tracer.Start(ctx, "get-folder-parent",
		trace.WithAttributes(
			attribute.String("folder.uid", folder.Name),
		),
	)
	defer span.End()

	folderMeta, err := utils.MetaAccessor(folder)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get folder meta accessor")
		return "", err
	}
	return folderMeta.GetFolder(), nil
}
