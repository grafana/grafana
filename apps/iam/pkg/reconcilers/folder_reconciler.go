package reconcilers

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"k8s.io/client-go/rest"
)

// FolderStore interface for retrieving folder information
type FolderStore interface {
	GetFolderParent(ctx context.Context, namespace, uid string) (string, error)
}

// PermissionStore interface for managing folder permissions
type PermissionStore interface {
	SetFolderParent(ctx context.Context, namespace, folderUID, parentUID string) error
	GetFolderParents(ctx context.Context, namespace, folderUID string) ([]string, error)
	DeleteFolder(ctx context.Context, namespace, folderUID string) error
}

// AppConfig represents the app-specific configuration
type AppConfig struct {
	ZanzanaAddr string
}

type FolderReconciler struct {
	permissionStore PermissionStore
	folderStore     FolderStore
}

func (r *FolderReconciler) handleUpdateFolder(ctx context.Context, folder *foldersKind.Folder) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)

	folderUID := folder.ObjectMeta.Name
	namespace := folder.Namespace

	parentUID, err := r.folderStore.GetFolderParent(ctx, namespace, folderUID)
	if err != nil {
		logger.Error("Error getting parent UID from store", "error", err)
		return operator.ReconcileResult{}, err
	}

	parents, err := r.permissionStore.GetFolderParents(ctx, namespace, folderUID)
	if err != nil {
		logger.Error("Error getting parents from permission store", "error", err)
		return operator.ReconcileResult{}, err
	}

	if (len(parents) == 0 && parentUID == "") || (len(parents) == 1 && parents[0] == parentUID) {
		// Folder is already reconciled
		logger.Info("Folder is already reconciled", "folder", folderUID, "parent", parentUID, "namespace", namespace)
		return operator.ReconcileResult{}, nil
	}

	err = r.permissionStore.SetFolderParent(ctx, namespace, folderUID, parentUID)
	if err != nil {
		logger.Error("Error setting parent in permission store", "error", err)
		return operator.ReconcileResult{}, err
	}

	logger.Info("Folder parent set in permission store", "folder", folderUID, "parent", parentUID, "namespace", namespace)

	return operator.ReconcileResult{}, nil
}

func (r *FolderReconciler) handleDeleteFolder(ctx context.Context, folder *foldersKind.Folder) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)

	namespace := folder.Namespace
	folderUID := folder.Spec.Title

	err := r.permissionStore.DeleteFolder(ctx, namespace, folderUID)
	if err != nil {
		logger.Error("Error deleting folder from permission store", "error", err)
		return operator.ReconcileResult{}, err
	}

	logger.Info("Folder deleted from permission store", "folder", folderUID, "namespace", namespace)

	return operator.ReconcileResult{}, nil
}

func (r *FolderReconciler) reconcile(ctx context.Context, req operator.TypedReconcileRequest[*foldersKind.Folder]) (operator.ReconcileResult, error) {
	switch req.Action {
	case operator.ReconcileActionCreated:
		return r.handleUpdateFolder(ctx, req.Object)
	case operator.ReconcileActionUpdated:
		return r.handleUpdateFolder(ctx, req.Object)
	case operator.ReconcileActionDeleted:
		return r.handleDeleteFolder(ctx, req.Object)
	default:
		return operator.ReconcileResult{}, nil
	}
}

// getPatchClient creates a patch client for the folder kind
func getPatchClient(restConfig rest.Config, kind resource.Kind) (operator.PatchClient, error) {
	clientGenerator := k8s.NewClientRegistry(restConfig, k8s.ClientConfig{})
	return clientGenerator.ClientFor(kind)
}

// getZanzanaClient creates a Zanzana client from the given address
func getZanzanaClient(addr string) (zanzana.Client, error) {
	transportCredentials := insecure.NewCredentials()

	dialOptions := []grpc.DialOption{
		grpc.WithTransportCredentials(transportCredentials),
	}

	conn, err := grpc.NewClient(addr, dialOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create zanzana client to remote server: %w", err)
	}

	client, err := zanzana.NewClient(conn)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize zanzana client: %w", err)
	}

	return client, nil
}

func NewFolderReconciler(cfg app.Config) (operator.Reconciler, error) {
	// Create patch client
	patchClient, err := getPatchClient(cfg.KubeConfig, foldersKind.FolderKind())
	if err != nil {
		return nil, fmt.Errorf("unable to create patch client for FolderReconciler: %w", err)
	}

	// Extract Zanzana address from config
	appCfg, ok := cfg.SpecificConfig.(AppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type: expected AppConfig, got %T", cfg.SpecificConfig)
	}

	// Create Zanzana client
	zanzanaClient, err := getZanzanaClient(appCfg.ZanzanaAddr)
	if err != nil {
		return nil, fmt.Errorf("unable to create zanzana client: %w", err)
	}

	// Create dependencies
	folderStore := NewAPIFolderStore(&cfg.KubeConfig)
	permissionStore := NewZanzanaPermissionStore(zanzanaClient)

	// Create the reconciler
	reconciler, err := operator.NewOpinionatedReconciler(patchClient, "folder-iam-finalizer")
	if err != nil {
		return nil, err
	}

	folderReconciler := &FolderReconciler{
		permissionStore: permissionStore,
		folderStore:     folderStore,
	}

	reconciler.Reconciler = &operator.TypedReconciler[*foldersKind.Folder]{
		ReconcileFunc: folderReconciler.reconcile,
	}

	return reconciler, nil
}
