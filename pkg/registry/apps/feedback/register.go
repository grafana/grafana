package feedback

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/feedback/pkg/apis"
	feedbackv0alpha1 "github.com/grafana/grafana/apps/feedback/pkg/apis/feedback/v0alpha1"
	feedbackapp "github.com/grafana/grafana/apps/feedback/pkg/app"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type FeedbackAppProvider struct {
	app.Provider
}

func RegisterApp(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
) *FeedbackAppProvider {
	provider := &FeedbackAppProvider{}

	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter: feedbackv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:     feedbackapp.GetKinds(),
	}

	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, feedbackapp.New)

	return provider
}
