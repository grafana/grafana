package app

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkscheduler"
	"github.com/grafana/grafana/pkg/infra/log"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type advisorApp struct {
	log          log.Logger
	checkMap     map[string]checks.Check
	client       resource.Client
	namespace    string
	simpleConfig simple.AppConfig
	customRoutes map[app.CustomRouteIdentifier]app.CustomRouteHandler
}

func (a *advisorApp) CustomRoutes() map[app.CustomRouteIdentifier]app.CustomRouteHandler {
	return a.customRoutes
}

func (a *advisorApp) Start(ctx context.Context) error {
	return nil
}

func (a *advisorApp) Stop(ctx context.Context) error {
	return nil
}

func (a *advisorApp) ValidateManifest(manifest []byte) error {
	return nil
}

func (a *advisorApp) GetKinds() map[schema.GroupVersion][]resource.Kind {
	return nil
}

func New(cfg app.Config) (app.App, error) {
	// Read config
	specificConfig, ok := cfg.SpecificConfig.(checkregistry.AdvisorAppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}
	checkRegistry := specificConfig.CheckRegistry
	stackID := specificConfig.StackID
	namespace, err := checks.GetNamespace(stackID)
	if err != nil {
		return nil, err
	}
	log := log.New("advisor.app")

	// Prepare storage client
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	client, err := clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
	if err != nil {
		return nil, err
	}

	// Initialize checks
	checkMap := map[string]checks.Check{}
	for _, c := range checkRegistry.Checks() {
		checkMap[c.ID()] = c
	}

	simpleConfig := simple.AppConfig{
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:      advisorv0alpha1.CheckKind(),
				Validator: checks.ValidateCheck,
				Watcher:   checkscheduler.NewCheckWatcher(client, checkMap, namespace),
			},
		},
	}

	app := &advisorApp{
		log:          log,
		checkMap:     checkMap,
		client:       client,
		namespace:    namespace,
		simpleConfig: simpleConfig,
		customRoutes: map[app.CustomRouteIdentifier]app.CustomRouteHandler{
			{
				ResourceIdentifier: schema.GroupVersionResource{
					Group:    advisorv0alpha1.CheckKind().Group(),
					Version:  advisorv0alpha1.CheckKind().Version(),
					Resource: advisorv0alpha1.CheckKind().Plural(),
				},
				Method:          "GET",
				SubresourcePath: "metadata",
			}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
				return &app.ResourceCustomRouteResponse{
					Body:       []byte("{}"),
					StatusCode: http.StatusOK,
				}, nil
			},
		},
	}

	return app, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		// Group and version are the same for all checks
		Group:   advisorv0alpha1.CheckKind().Group(),
		Version: advisorv0alpha1.CheckKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {
			advisorv0alpha1.CheckKind(),
			advisorv0alpha1.CheckTypeKind(),
		},
	}
}
