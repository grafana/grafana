package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/iam/pkg/apis"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/apps/iam/pkg/reconcilers"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"k8s.io/client-go/rest"
)

type AppConfig struct {
	ZanzanaClient ZanzanaClientConfig
}

type ZanzanaClientConfig struct {
	Addr string
}

func Provider(appCfg AppConfig) app.Provider {
	return simple.NewAppProvider(apis.LocalManifest(), appCfg, New)
}

func getPatchClient(restConfig rest.Config, kind resource.Kind) (operator.PatchClient, error) {
	clientGenerator := k8s.NewClientRegistry(restConfig, k8s.ClientConfig{})
	return clientGenerator.ClientFor(kind)
}

func getZanzanaClient(cfg app.SpecificConfig) (zanzana.Client, error) {
	appCfg, ok := cfg.(AppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type: expected AppConfig, got %T", cfg)
	}

	transportCredentials := insecure.NewCredentials()

	dialOptions := []grpc.DialOption{
		grpc.WithTransportCredentials(transportCredentials),
	}

	conn, err := grpc.NewClient(appCfg.ZanzanaClient.Addr, dialOptions...)
	if err != nil {
		return nil, fmt.Errorf("failed to create zanzana client to remote server: %w", err)
	}

	client, err := zanzana.NewClient(conn)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize zanzana client: %w", err)
	}

	return client, nil
}

func New(cfg app.Config) (app.App, error) {
	patchClient, err := getPatchClient(cfg.KubeConfig, foldersKind.FolderKind())
	if err != nil {
		return nil, fmt.Errorf("unable to create patch client for FolderReconciler: %w", err)
	}

	zanzanaClient, err := getZanzanaClient(cfg.SpecificConfig)
	if err != nil {
		logging.DefaultLogger.With("error", err).Error("Unable to create zanzana client")
		panic(err)
	}

	logging.DefaultLogger.Info("Zanzana client created")
	folderReconciler, err := reconcilers.NewFolderReconciler(patchClient, zanzanaClient)
	if err != nil {
		return nil, fmt.Errorf("unable to create FolderReconciler: %w", err)
	}

	config := simple.AppConfig{
		Name:       cfg.ManifestData.AppName,
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				// FIXME: add your own error handling here
				logging.FromContext(ctx).With("error", err).Error("Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: v0alpha1.GlobalRoleKind(),
			},
			{
				Kind: v0alpha1.GlobalRoleBindingKind(),
			},
			{
				Kind: v0alpha1.CoreRoleKind(),
			},
			{
				Kind: v0alpha1.RoleKind(),
			},
			{
				Kind: v0alpha1.RoleBindingKind(),
			},
			{
				Kind: v0alpha1.ResourcePermissionKind(),
			},
			{
				Kind: v0alpha1.UserKind(),
			},
			{
				Kind: v0alpha1.TeamKind(),
			},
			{
				Kind: v0alpha1.TeamBindingKind(),
			},
			{
				Kind: v0alpha1.ServiceAccountKind(),
			},
		},
		UnmanagedKinds: []simple.AppUnmanagedKind{
			{
				Kind:       foldersKind.FolderKind(),
				Reconciler: folderReconciler,
			},
		},
	}

	// Create the App
	a, err := simple.NewApp(config)
	if err != nil {
		return nil, err
	}

	// Validate the capabilities against the provided manifest to make sure there isn't a mismatch
	err = a.ValidateManifest(cfg.ManifestData)

	return a, err
}
