package example

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resourcebus"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/example/pkg/apis/example/v1alpha1"
	"github.com/grafana/grafana/apps/example/pkg/apis/manifestdata"
	exampleapp "github.com/grafana/grafana/apps/example/pkg/app"
	appsdkapiserver "github.com/grafana/grafana/pkg/apiserver/appsdk"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/services/apiserver/keys/keyslister"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg *setting.Cfg
}

func (e AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return exampleapp.GetAuthorizer()
}

// RegisterAppInstaller builds the installer without a delta source, leaving the app's reconciler on the kubernetes
// watch. It is the signature out-of-tree callers already use; wire uses ProvideAppInstaller.
func RegisterAppInstaller(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*AppInstaller, error) {
	return ProvideAppInstaller(cfg, features, nil, nil)
}

// ProvideAppInstaller builds the installer, taking the resource change bus and the storage client the keys-only
// re-list reads through. A nil resourceBus selects the kubernetes watch.
func ProvideAppInstaller(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	resourceBus resourcebus.Subscriber,
	unified resource.ResourceClient,
) (*AppInstaller, error) {
	installer := &AppInstaller{
		cfg: cfg,
	}
	// Config specific to the app. This can pull from feature flags or setting.Cfg.
	specificConfig := &exampleapp.ExampleConfig{
		EnableSomeFeature: true,
		// An app-sdk interface value, so the app depends on neither the bus nor the keys client below. A nil
		// subscriber selects the kubernetes watch, which is what an instance with NATS off gets.
		ResourceBus: resourceBus,
		// The spec registered in watch_metadata.go only reaches the wire when the publisher was configured to send
		// metadata at all, so the app is told what this deployment actually announces, not what it asked for.
		BusAnnouncesMetadata: cfg.NATS.NotificationMetadata,
	}
	if keyslister.Enabled(cfg) {
		specificConfig.BusKeyLister = keyslister.Factory(func(gvr schema.GroupVersionResource) keysapi.Lister {
			return keysapi.NewGRPCLister(unified, gvr)
		})
	}

	// Set specificConfig.EnableReconciler to true IFF the v1alpha1 API is enabled in the runtime config.
	// This is example-app-specific, as the version the reconciler uses is not served by default and must be enabled via an override.
	apiserverRuntimeCfg := cfg.SectionWithEnvOverrides("grafana-apiserver").Key("runtime_config").String()
	for s := range strings.SplitSeq(apiserverRuntimeCfg, ",") {
		if len(s) == 0 {
			continue
		}
		arr := strings.SplitN(s, "=", 2)
		if len(arr) == 2 {
			if arr[0] == fmt.Sprintf("%s/%s", v1alpha1.APIGroup, v1alpha1.APIVersion) {
				specificConfig.EnableReconciler = strings.EqualFold("true", arr[1])
				break
			}
		}
	}

	// Provider is the app provider, which contains the AppManifest, app-specific-config, and the New function for the app
	provider := simple.NewAppProvider(manifestdata.LocalManifest(), specificConfig, exampleapp.New)

	// appConfig is used alongside the provider for registrion.
	// Most of the data is redunant, this may be more optimized in the future.
	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *manifestdata.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	// NewDefaultInstaller gets us the installer we need to underly the AppInstaller type.
	// It does all the hard work of installing our app to the grafana API server
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, manifestdata.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}
