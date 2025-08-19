package reconcilers

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// FolderStore interface for retrieving folder information
type FolderStore interface {
	GetFolderParent(ctx context.Context, namespace, uid string) (string, error)
}

// PermissionStore interface for managing folder permissions
type PermissionStore interface {
	GetFolderParents(ctx context.Context, namespace, folderUID string) ([]string, error)
	SetFolderParent(ctx context.Context, namespace, folderUID, parentUID string) error
	DeleteFolderParents(ctx context.Context, namespace, folderUID string) error
}

// AppConfig represents the app-specific configuration
type AppConfig struct {
	ZanzanaAddr               string
	FolderReconcilerNamespace string
}

type FolderReconciler struct {
	permissionStore PermissionStore
	folderStore     FolderStore
}

func NewFolderReconciler(cfg app.Config) (operator.Reconciler, error) {
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

	folderReconciler := &FolderReconciler{
		permissionStore: permissionStore,
		folderStore:     folderStore,
	}

	reconciler := &operator.TypedReconciler[*foldersKind.Folder]{
		ReconcileFunc: folderReconciler.reconcile,
	}

	return reconciler, nil
}

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

func (r *FolderReconciler) reconcile(ctx context.Context, req operator.TypedReconcileRequest[*foldersKind.Folder]) (operator.ReconcileResult, error) {
	// Add timeout to prevent hanging operations
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	logger := logging.FromContext(ctx)
	logger.Info("Reconciling request", "req", req)

	err := validateFolder(req.Object)
	if err != nil {
		return operator.ReconcileResult{}, err
	}

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

func (r *FolderReconciler) handleUpdateFolder(ctx context.Context, folder *foldersKind.Folder) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)

	folderUID := folder.Name
	namespace := folder.Namespace

	parentUID, err := r.folderStore.GetFolderParent(ctx, namespace, folderUID)
	if err != nil {
		return operator.ReconcileResult{}, err
	}

	parents, err := r.permissionStore.GetFolderParents(ctx, namespace, folderUID)
	if err != nil {
		return operator.ReconcileResult{}, err
	}

	if (len(parents) == 0 && parentUID == "") || (len(parents) == 1 && parents[0] == parentUID) {
		// Folder is already reconciled
		logger.Info("Folder is already reconciled", "folder", folderUID, "parent", parentUID, "namespace", namespace)
		return operator.ReconcileResult{}, nil
	}

	err = r.permissionStore.SetFolderParent(ctx, namespace, folderUID, parentUID)
	if err != nil {
		return operator.ReconcileResult{}, err
	}

	logger.Info("Folder parent set in permission store", "folder", folderUID, "parent", parentUID, "namespace", namespace)

	return operator.ReconcileResult{}, nil
}

func (r *FolderReconciler) handleDeleteFolder(ctx context.Context, folder *foldersKind.Folder) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)

	namespace := folder.Namespace
	folderUID := folder.Name

	err := r.permissionStore.DeleteFolderParents(ctx, namespace, folderUID)
	if err != nil {
		return operator.ReconcileResult{}, err
	}

	logger.Info("Folder deleted from permission store", "folder", folderUID, "namespace", namespace)

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
