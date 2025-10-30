package main

import (
	"log/slog"
	"os"

	"k8s.io/apiserver/pkg/admission"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/client-go/rest"
	"k8s.io/component-base/cli"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/k8s/apiserver/cmd/server"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/advisor/pkg/apis"
	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry/mockchecks"
)

func main() {
	logging.DefaultLogger = logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	provider := simple.NewAppProvider(apis.LocalManifest(), nil, advisorapp.New)
	config := app.Config{
		KubeConfig:   rest.Config{}, // this will be replaced by the apiserver loopback config
		ManifestData: *apis.LocalManifest().ManifestData,
		SpecificConfig: checkregistry.AdvisorAppConfig{
			CheckRegistry: &mockchecks.CheckRegistry{},
			PluginConfig:  map[string]string{},
			StackID:       "1", // Numeric stack ID for standalone mode
			OrgService:    nil, // Not needed when StackID is set
		},
	}
	installer, err := apiserver.NewDefaultAppInstaller(provider, config, &apis.GoTypeAssociator{})
	if err != nil {
		panic(err)
	}
	ctx := genericapiserver.SetupSignalContext()
	opts := apiserver.NewOptions([]apiserver.AppInstaller{installer})
	opts.RecommendedOptions.Authentication = nil
	opts.RecommendedOptions.Authorization = nil
	opts.RecommendedOptions.CoreAPI = nil
	opts.RecommendedOptions.EgressSelector = nil
	opts.RecommendedOptions.Admission.Plugins = admission.NewPlugins()
	opts.RecommendedOptions.Admission.RecommendedPluginOrder = []string{}
	opts.RecommendedOptions.Admission.EnablePlugins = []string{}
	opts.RecommendedOptions.Features.EnablePriorityAndFairness = false
	opts.RecommendedOptions.ExtraAdmissionInitializers = func(_ *genericapiserver.RecommendedConfig) ([]admission.PluginInitializer, error) {
		return nil, nil
	}
	cmd := server.NewCommandStartServer(ctx, opts)
	code := cli.Run(cmd)
	os.Exit(code)
}
