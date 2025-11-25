package app

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/example/pkg/apis/example/v1alpha1"
	quotasv0alpha1 "github.com/grafana/grafana/apps/quotas/pkg/apis/quotas/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// GetSomethingHandler handles requests for the GET /something resource route
func GetSomethingHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	message := "This is a namespaced route"
	if request.URL.Query().Has("message") {
		message = request.URL.Query().Get("message")
	}
	return json.NewEncoder(writer).Encode(v1alpha1.GetSomething{
		TypeMeta: metav1.TypeMeta{
			APIVersion: fmt.Sprintf("%s/%s", v1alpha1.APIGroup, v1alpha1.APIVersion),
		},
		GetSomethingBody: v1alpha1.GetSomethingBody{
			Namespace: request.ResourceIdentifier.Namespace,
			Message:   message,
		},
	})
}

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "correlation",
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
				Kind: quotasv0alpha1.QuotaKind(),
			},
		},
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v0alpha1": {
				{
					Namespaced: true,
					Path:       "something",
					Method:     "GET",
				}: GetSomethingHandler,
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

	return a, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   quotasv0alpha1.QuotaKind().Group(),
		Version: quotasv0alpha1.QuotaKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {quotasv0alpha1.QuotaKind()},
	}
}
