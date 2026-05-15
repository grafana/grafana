package annotation

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"sync"

	authtypes "github.com/grafana/authlib/types"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/annotation/pkg/apis"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	annotationapp "github.com/grafana/grafana/apps/annotation/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apiserverrest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	k8sAdapter    *k8sRESTAdapter
	cleanupCancel context.CancelFunc
	cleanupWg     sync.WaitGroup
	logger        log.Logger
}

// RegisterAppInstaller is the wire entry point for the ST server.
func RegisterAppInstaller(
	cfg *setting.Cfg,
	service annotations.Repository,
	cleaner annotations.Cleaner,
	accessClient authtypes.AccessClient,
) (*AppInstaller, error) {
	return NewAppInstaller(newConfigFromSettings(cfg), service, cleaner, accessClient)
}

// NewAppInstaller Layers (from bottom to top):
//  1. annotations.Repository - old Grafana annotation service
//  2. sqlAdapter - Bridges annotations.Repository → Store interface (apps/annotation/Store), converts ItemDTO ↔ v0alpha1.Annotation
//  3. k8sRESTAdapter - Bridges Store → K8s REST interface, handles K8s API conventions
func NewAppInstaller(
	cfg Config,
	service annotations.Repository,
	cleaner annotations.Cleaner,
	accessClient authtypes.AccessClient,
) (*AppInstaller, error) {
	installer := &AppInstaller{
		logger: log.New("annotation.app"),
	}

	ctx := context.Background()

	// Create the appropriate store backend
	store, err := createStore(ctx, cfg, service, cleaner)
	if err != nil {
		return nil, err
	}

	// Start background cleanup if the store supports lifecycle management
	if lifecycleMgr, ok := store.(LifecycleManager); ok {
		installer.startCleanup(ctx, lifecycleMgr, cfg.RetentionTTL)
	}

	// Create K8s REST adapter
	installer.k8sAdapter = &k8sRESTAdapter{
		store:        store,
		accessClient: accessClient,
		installer:    installer,
	}

	// Create the tags handler
	tagProvider, ok := store.(TagProvider)
	if !ok {
		// We could consider combining the TagProvider with the Store interface to avoid this type assertion?
		return nil, fmt.Errorf("store does not implement TagProvider, cannot serve tags API")
	}
	tagHandler := newTagsHandler(tagProvider)

	// Create the search handler
	searchHandler := newSearchHandler(store, accessClient)

	provider := simple.NewAppProvider(apis.LocalManifest(), nil, annotationapp.New)

	appConfig := app.Config{
		KubeConfig:   restclient.Config{},
		ManifestData: *apis.LocalManifest().ManifestData,
		SpecificConfig: &annotationapp.AnnotationConfig{
			TagHandler:    tagHandler,
			SearchHandler: searchHandler,
		},
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}

// createStore creates the appropriate store backend based on configuration
func createStore(ctx context.Context, cfg Config, service annotations.Repository, cleaner annotations.Cleaner) (Store, error) {
	switch cfg.StoreBackend {
	case "memory":
		return NewMemoryStore(), nil
	case "grpc":
		return newGRPCStore(cfg)
	case "postgres":
		return newPostgresStore(ctx, cfg)
	case "legacy-sql":
		// legacy-sql is the default, but we allow explicitly specifying it for clarity
		fallthrough
	default:
		// Wrap old annotations.Repository with sqlAdapter (implements Store interface)
		return NewSQLAdapter(service, cleaner, cfg.CleanupSettings), nil
	}
}

func newGRPCStore(cfg Config) (Store, error) {
	var dialOpts []grpc.DialOption
	if cfg.GRPCUseTLS {
		tlsConfig, err := loadTLSConfig(cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to load TLS config: %w", err)
		}
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)))
	} else {
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	grpcConn, err := grpc.NewClient(
		cfg.GRPCAddress,
		dialOpts...,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to annotation gRPC server at %s: %w",
			cfg.GRPCAddress, err)
	}
	return NewStoreGRPC(grpcConn), nil
}

func loadTLSConfig(cfg Config) (*tls.Config, error) {
	tlsConfig := &tls.Config{}
	if cfg.GRPCTLSCAFile != "" {
		caCert, err := os.ReadFile(cfg.GRPCTLSCAFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA file: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to append CA certificate")
		}
		tlsConfig.RootCAs = caCertPool
	}

	if cfg.GRPCTLSSkipVerify {
		tlsConfig.InsecureSkipVerify = true
	}

	return tlsConfig, nil
}

func newPostgresStore(ctx context.Context, cfg Config) (Store, error) {
	if len(cfg.PostgresConnStrings) == 0 {
		return nil, fmt.Errorf("at least one postgres connection string is required")
	}

	shardCfg := ShardedStoreConfig{
		ShardConnectionStrings:   cfg.PostgresConnStrings,
		MetadataConnectionString: cfg.PostgresMetadataConnString,
		MaxConnections:           cfg.PostgresMaxConnections,
		MaxIdleConns:             cfg.PostgresMaxIdleConns,
		ConnMaxLifetime:          cfg.PostgresConnMaxLifetime,
		RetentionTTL:             cfg.RetentionTTL,
		TagCacheTTL:              cfg.PostgresTagCacheTTL,
		TagCacheSize:             cfg.PostgresTagCacheSize,
	}

	return NewShardedPostgresStore(ctx, shardCfg)
}

// GetLegacyStorage returns the K8s REST storage implementation for the annotation resource.
// Called by the app platform to get the storage backend.
func (a *AppInstaller) GetLegacyStorage(requested schema.GroupVersionResource) apiserverrest.Storage {
	kind := annotationV0.AnnotationKind()
	gvr := schema.GroupVersionResource{
		Group:    kind.Group(),
		Version:  kind.Version(),
		Resource: kind.Plural(),
	}

	if requested.String() != gvr.String() {
		return nil
	}

	// Set up table converter for kubectl-style output
	a.k8sAdapter.tableConverter = utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Text", Type: "string", Format: "name"},
			},
			Reader: func(obj any) ([]any, error) {
				m, ok := obj.(*annotationV0.Annotation)
				if !ok {
					return nil, fmt.Errorf("expected Annotation")
				}
				return []any{
					m.Spec.Text,
				}, nil
			},
		},
	)

	return a.k8sAdapter
}
