package options

import (
	"github.com/grafana/grafana-app-sdk/apiserver"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilerrors "k8s.io/apimachinery/pkg/util/errors"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/admission"
	genericoptions "k8s.io/apiserver/pkg/server/options"

	"github.com/grafana/grafana/pkg/apiserver/server"
)

const defaultEtcdPathPrefix = "/registry/grafana.app"

type Options struct {
	*genericoptions.RecommendedOptions

	config *server.Config
}

func NewOptions(groups []*apiserver.ResourceGroup) *Options {
	serverConfig := server.NewConfig(groups)

	gvs := []schema.GroupVersion{}
	for _, g := range groups {
		for _, r := range g.Resources {
			gv := schema.GroupVersion{
				Group:   r.Kind.Group(),
				Version: r.Kind.Version(),
			}
			gvs = append(gvs, gv)
		}
	}

	o := &Options{
		RecommendedOptions: genericoptions.NewRecommendedOptions(
			defaultEtcdPathPrefix,
			serverConfig.ExtraConfig.Codecs.LegacyCodec(gvs...),
		),
		config: serverConfig,
	}

	o.RecommendedOptions.Admission.Plugins = admission.NewPlugins()
	for i := 0; i < len(groups); i++ {
		groups[i].RegisterAdmissionPlugins(o.RecommendedOptions.Admission.Plugins)
	}

	o.RecommendedOptions.Admission.RecommendedPluginOrder = o.RecommendedOptions.Admission.Plugins.Registered()
	o.RecommendedOptions.Admission.EnablePlugins = o.RecommendedOptions.Admission.Plugins.Registered()
	o.RecommendedOptions.Admission.DisablePlugins = []string{}
	o.RecommendedOptions.Admission.DefaultOffPlugins = sets.NewString()
	return o
}

func (o *Options) Validate(args []string) error {
	errors := []error{}
	errors = append(errors, o.RecommendedOptions.Validate()...)
	return utilerrors.NewAggregate(errors)
}

func (o *Options) Config() (*server.Config, error) {
	groups := []apiserver.ResourceGroup{}
	for _, g := range o.config.ExtraConfig.ResourceGroups {
		groups = append(groups, *g)
	}
	o.config.RecommendedConfig.AddPostStartHook("start-resource-informers", apiserver.ReconcilersPostStartHook(nil, groups...))
	return o.config, nil
}
