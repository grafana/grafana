package appinstaller

import (
	"context"
	"fmt"
	"time"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
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

// SetupOpenAPIDefinitions sets up OpenAPI definitions for app installers
func SetupOpenAPIDefinitions(
	appInstallers []appsdkapiserver.AppInstaller,
	existingGetter func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition,
) func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		defs := existingGetter(ref)

		// add common OpenAPI definitions
		commonDefs := appsdkapiserver.GetCommonOpenAPIDefinitions(ref)
		for k, v := range commonDefs {
			defs[k] = v
		}

		// add AppInstaller definitions
		for _, installer := range appInstallers {
			md := installer.ManifestData()
			if md != nil {
				// Note: logging context not available in this function
				installerDefs := installer.GetOpenAPIDefinitions(ref)
				for k, v := range installerDefs {
					defs[k] = v
				}
			}
		}
		return defs
	}
}

func InstallAPIs(
	ctx context.Context,
	appInstallers []appsdkapiserver.AppInstaller,
	server *genericapiserver.GenericAPIServer,
	storage generic.RESTOptionsGetter,
	storageOpts *grafanaapiserveroptions.StorageOptions,
	kvStore grafanarest.NamespacedKVStore,
	lock serverLock,
	namespaceMapper request.NamespaceMapper,
	dualWriteService dualwrite.Service,
	dualWriterMetrics *grafanarest.DualWriterMetrics,
) error {
	logger := logging.FromContext(ctx)

	for _, installer := range appInstallers {
		logger.Debug("Installing APIs for app installer", "app", installer.ManifestData().AppName)
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
			return fmt.Errorf("failed to initialize app %s: %w", installer.ManifestData().AppName, err)
		}

		logger.Info("App initialized", "app", installer.ManifestData().AppName)
		app, err := installer.App()
		if err != nil {
			return fmt.Errorf("failed to get app from installer %s: %w", installer.ManifestData().AppName, err)
		}
		return app.Runner().Run(hookContext.Context)
	}
}
