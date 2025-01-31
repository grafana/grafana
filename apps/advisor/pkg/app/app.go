package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"
)

const (
	typeLabel        = "advisor.grafana.app/type"
	statusAnnotation = "advisor.grafana.app/status"
)

func New(cfg app.Config) (app.App, error) {
	// Read config
	checkRegistry, ok := cfg.SpecificConfig.(checkregistry.CheckService)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}

	// Prepare storage client
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	client, err := clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
	if err != nil {
		return nil, err
	}
	typesClient, err := clientGenerator.ClientFor(advisorv0alpha1.CheckTypeKind())
	if err != nil {
		return nil, err
	}

	// Initialize checks
	checkMap := map[string]checks.Check{}
	types := []string{}
	for _, c := range checkRegistry.Checks() {
		checkMap[c.Type()] = c
		types = append(types, c.Type())
	}

	simpleConfig := simple.AppConfig{
		Name:       "advisor",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				klog.ErrorS(err, "Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: advisorv0alpha1.CheckKind(),
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						if req.Object != nil {
							_, err := getCheck(req.Object, checkMap)
							return err
						}
						return nil
					},
				},
				Watcher: &simple.Watcher{
					AddFunc: func(ctx context.Context, obj resource.Object) error {
						check, err := getCheck(obj, checkMap)
						if err != nil {
							return err
						}
						return processCheck(ctx, client, obj, check)
					},
				},
				// This does not expose an HTTP endpoint so we cannot use it from the frontend
				// CustomRoutes: simple.AppCustomRouteHandlers{
				// 	simple.AppCustomRoute{Method: "GET", Path: "types"}: func(ctx context.Context, req *app.ResourceCustomRouteRequest) (*app.ResourceCustomRouteResponse, error) {
				// 		typesBytes, err := json.Marshal(types)
				// 		if err != nil {
				// 			return nil, err
				// 		}
				// 		return &app.ResourceCustomRouteResponse{
				// 			Headers:    map[string][]string{"Content-Type": {"application/json"}},
				// 			Body:       typesBytes,
				// 			StatusCode: http.StatusOK,
				// 		}, nil
				// 	},
				// },
			},
			{
				Kind: advisorv0alpha1.CheckTypeKind(),
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

	pr := &postRun{
		types:       types,
		typesClient: typesClient,
	}
	a.AddRunnable(pr)

	return a, nil
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

type postRun struct {
	types       []string
	typesClient resource.Client
}

func (r *postRun) Run(ctx context.Context) error {
	for _, t := range r.types {
		obj := &advisorv0alpha1.CheckType{
			ObjectMeta: metav1.ObjectMeta{Name: t, Namespace: metav1.NamespaceDefault},
			Spec:       advisorv0alpha1.CheckTypeSpec{Name: t},
		}
		id := obj.GetStaticMetadata().Identifier()
		_, err := r.typesClient.Create(ctx, id, obj, resource.CreateOptions{})
		if err != nil {
			if errors.IsAlreadyExists(err) {
				// Already exists, ignore
				continue
			}
			return err
		}
	}
	return nil
}
