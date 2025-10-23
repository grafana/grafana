package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor2/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"

	"github.com/grafana/grafana/apps/advisor2/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor2/pkg/app/checkregistry/mocks"
	"github.com/grafana/grafana/apps/advisor2/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor2/pkg/app/checkscheduler"
	"github.com/grafana/grafana/apps/advisor2/pkg/app/checktyperegisterer"
)

func New(cfg app.Config) (app.App, error) {
	log := logging.DefaultLogger.With("app", "advisor.app")

	// Prepare storage client
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	checksClient, err := clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
	if err != nil {
		return nil, err
	}
	typesClient, err := clientGenerator.ClientFor(advisorv0alpha1.CheckTypeKind())
	if err != nil {
		return nil, err
	}

	checkRegistry := mocks.NewMockCheckRegistry()
	cfg.SpecificConfig = checkregistry.AdvisorAppConfig{
		CheckRegistry: checkRegistry,
	}

	// Initialize checks
	checkMap := map[string]checks.Check{}
	for _, c := range checkRegistry.Checks() {
		checkMap[c.ID()] = c
	}

	simpleConfig := simple.AppConfig{
		Name:       "advisor",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logging.FromContext(ctx).Error("Informer processing error", "error", err)
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: advisorv0alpha1.CheckKind(),
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						// do something here if needed
						return nil
					},
				},
				Watcher: &simple.Watcher{
					AddFunc: func(ctx context.Context, obj resource.Object) error {
						check, err := getCheck(obj, checkMap)
						if err != nil {
							return err
						}
						logger := log.WithContext(ctx).With("check", check.ID())
						logger.Debug("Processing check", "namespace", obj.GetNamespace())
						requester, err := identity.GetRequester(ctx)
						if err != nil {
							logger.Error("Error getting requester, adding service identity", "error", err)
							ctx = identity.WithServiceIdentityContext(context.WithoutCancel(ctx), 1)
							requester, err = identity.GetRequester(ctx)
							if err != nil {
								logger.Error("Error getting requester", "error", err)
								return err
							}
						}
						ctx = identity.WithServiceIdentityContext(context.WithoutCancel(ctx), requester.GetOrgID())
						err = processCheck(ctx, logger, checksClient, typesClient, obj, check)
						if err != nil {
							logger.Error("Error processing check", "error", err)
						}
						return nil
					},
					UpdateFunc: func(ctx context.Context, oldObj, newObj resource.Object) error {
						if !hasRetryAnnotation(newObj) {
							return nil
						}
						check, err := getCheck(newObj, checkMap)
						if err != nil {
							return err
						}
						logger := log.WithContext(ctx).With("check", check.ID())
						logger.Debug("Processing check", "namespace", newObj.GetNamespace())
						requester, err := identity.GetRequester(ctx)
						if err != nil {
							logger.Error("Error getting requester, adding service identity", "error", err)
							ctx = identity.WithServiceIdentityContext(context.WithoutCancel(ctx), 1)
							requester, err = identity.GetRequester(ctx)
							if err != nil {
								logger.Error("Error getting requester", "error", err)
								return err
							}
						}
						ctx = identity.WithServiceIdentityContext(context.WithoutCancel(ctx), requester.GetOrgID())
						err = processCheckRetry(ctx, logger, checksClient, typesClient, newObj, check)
						if err != nil {
							logger.Error("Error processing check retry", "error", err)
						}
						return nil
					},
				},
			},
			{
				Kind: advisorv0alpha1.CheckTypeKind(),
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						// do something here if needed
						return nil
					},
				},
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	// Save check types as resources
	ctr, err := checktyperegisterer.New(cfg, log)
	if err != nil {
		return nil, err
	}
	a.AddRunnable(ctr)

	// Start scheduler
	csch, err := checkscheduler.New(cfg, log)
	if err != nil {
		return nil, err
	}
	a.AddRunnable(csch)

	return a, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   advisorv0alpha1.CheckKind().Group(),
		Version: advisorv0alpha1.CheckKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {advisorv0alpha1.CheckKind()},
	}
}
