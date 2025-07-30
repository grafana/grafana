package appinstaller

import (
	"context"
	"fmt"
	"maps"
	"time"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	grafanaapiserveroptions "github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
)

type LegacyStorageGetterFunc func(schema.GroupVersionResource) grafanarest.Storage

type LegacyStorageProvider interface {
	GetLegacyStorage(schema.GroupVersionResource) grafanarest.Storage
}

type AuthorizerProvider interface {
	GetAuthorizer() authorizer.Authorizer
}

type APIEnablementProvider interface {
	// Do not implement this unless you have special circumstances! This is a list of resources that are allowed to be accessed in v0alpha1,
	// to prevent accidental exposure of experimental APIs. While developing, use the feature flag `grafanaAPIServerWithExperimentalAPIs`.
	// And then, when you're ready to expose this to the end user, go to v1beta1 instead.
	GetAllowedV0Alpha1Resources() []string
}

type AppInstallerConfig struct {
	CustomConfig             any
	AllowedV0Alpha1Resources []string
}

// serverLock interface defines a lock mechanism for executing actions with a timeout
type serverLock interface {
	LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

// AddToScheme adds app installer schemas to the runtime scheme
func AddToScheme(
	appInstallers []appsdkapiserver.AppInstaller,
	scheme *runtime.Scheme,
) ([]schema.GroupVersion, error) {
	var additionalGroupVersions []schema.GroupVersion
	for _, installer := range appInstallers {
		if err := installer.AddToScheme(scheme); err != nil {
			return nil, fmt.Errorf("failed to add app installer scheme: %w", err)
		}
		additionalGroupVersions = append(additionalGroupVersions, installer.GroupVersions()...)
	}
	return additionalGroupVersions, nil
}

// RegisterAdmissionPlugins registers admission plugins for app installers
func RegisterAdmissionPlugins(
	ctx context.Context,
	appInstallers []appsdkapiserver.AppInstaller,
	options *grafanaapiserveroptions.Options,
) error {
	logger := logging.FromContext(ctx)

	for _, installer := range appInstallers {
		plugin := installer.AdmissionPlugin()
		if plugin != nil {
			md := installer.ManifestData()
			if md == nil {
				return fmt.Errorf("manifest is not initialized for installer for GroupVersions %v", installer.GroupVersions())
			}
			pluginName := md.AppName + " admission"
			options.RecommendedOptions.Admission.Plugins.Register(pluginName, plugin)
			logger.Info("Registered admission plugin", "app", md.AppName)
		}
	}
	return nil
}

type AuthorizerRegistrar interface {
	Register(gv schema.GroupVersion, authorizer authorizer.Authorizer)
}

func RegisterAuthorizers(
	ctx context.Context,
	appInstallers []appsdkapiserver.AppInstaller,
	registrar AuthorizerRegistrar,
) {
	logger := logging.FromContext(ctx)
	for _, installer := range appInstallers {
		if authorizerProvider, ok := installer.(AuthorizerProvider); ok {
			authorizer := authorizerProvider.GetAuthorizer()
			for _, gv := range installer.GroupVersions() {
				registrar.Register(gv, authorizer)
				logger.Debug("Registered authorizer", "group", gv.Group, "version", gv.Version, "app")
			}
		}
	}
}

func BuildOpenAPIDefGetter(
	appInstallers []appsdkapiserver.AppInstaller,
) func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		defs := make(map[string]common.OpenAPIDefinition)
		maps.Copy(defs, appsdkapiserver.GetCommonOpenAPIDefinitions(ref))
		for _, installer := range appInstallers {
			maps.Copy(defs, installer.GetOpenAPIDefinitions(ref))
		}
		return defs
	}
}

func InstallAPIs(
	ctx context.Context,
	appInstallers []appsdkapiserver.AppInstaller,
	server *genericapiserver.GenericAPIServer,
	restOpsGetter generic.RESTOptionsGetter,
	storageOpts *grafanaapiserveroptions.StorageOptions,
	kvStore grafanarest.NamespacedKVStore,
	lock serverLock,
	namespaceMapper request.NamespaceMapper,
	dualWriteService dualwrite.Service,
	dualWriterMetrics *grafanarest.DualWriterMetrics,
	builderMetrics *builder.BuilderMetrics,
) error {
	logger := logging.FromContext(ctx)
	for _, installer := range appInstallers {
		logger.Debug("Installing APIs for app installer", "app", installer.ManifestData().AppName)
		wrapper := &serverWrapper{
			ctx:               ctx,
			GenericAPIServer:  server,
			installer:         installer,
			storageOpts:       storageOpts,
			restOptionsGetter: restOpsGetter,
			kvStore:           kvStore,
			lock:              lock,
			namespaceMapper:   namespaceMapper,
			dualWriteService:  dualWriteService,
			dualWriterMetrics: dualWriterMetrics,
			builderMetrics:    builderMetrics,
		}
		if err := installer.InstallAPIs(wrapper, restOpsGetter); err != nil {
			return fmt.Errorf("failed to install APIs for app %s: %w", installer.ManifestData().AppName, err)
		}
		logger.Info("Installed APIs for app", "app", installer.ManifestData().AppName)
	}
	return nil
}

// RegisterPostStartHooks registers individual post start hooks for each app installer
func RegisterPostStartHooks(
	appInstallers []appsdkapiserver.AppInstaller,
	serverConfig *genericapiserver.RecommendedConfig,
) error {
	for _, installer := range appInstallers {
		md := installer.ManifestData()
		if md == nil {
			return fmt.Errorf("app installer has nil manifest data: %T", installer)
		}
		hook := createPostStartHook(installer)
		if err := serverConfig.AddPostStartHook(md.AppName, hook); err != nil {
			return fmt.Errorf("failed to register post start hook for app %s: %w", md.AppName, err)
		}
	}
	return nil
}

func createPostStartHook(
	installer appsdkapiserver.AppInstaller,
) genericapiserver.PostStartHookFunc {
	return func(hookContext genericapiserver.PostStartHookContext) error {
		logger := logging.FromContext(hookContext.Context)
		logger.Debug("Initializing app", "app", installer.ManifestData().AppName)

		if err := installer.InitializeApp(*hookContext.LoopbackClientConfig); err != nil {
			logger.Error("Failed to initialize app", "app", installer.ManifestData().AppName, "error", err)
			return fmt.Errorf("failed to initialize app %s: %w", installer.ManifestData().AppName, err)
		}

		logger.Info("App initialized", "app", installer.ManifestData().AppName)
		app, err := installer.App()
		if err != nil {
			logger.Error("Failed to initialize app", "app", installer.ManifestData().AppName, "error", err)
			return fmt.Errorf("failed to get app from installer %s: %w", installer.ManifestData().AppName, err)
		}
		return app.Runner().Run(hookContext.Context)
	}
}
