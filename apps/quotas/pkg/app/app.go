package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	unifiedStorage "github.com/grafana/grafana/pkg/storage/unified/resource"

	"github.com/grafana/grafana-app-sdk/simple"
	quotasv0alpha1 "github.com/grafana/grafana/apps/quotas/pkg/apis/quotas/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type QuotasAppConfig struct {
	ResourceClient unifiedStorage.ResourceClient
}

type QuotasHandler struct {
	ResourceClient unifiedStorage.ResourceClient
}

func NewQuotasHandler(cfg *QuotasAppConfig) *QuotasHandler {
	return &QuotasHandler{
		ResourceClient: cfg.ResourceClient,
	}
}

// GetQuota handles requests for the GET /usage resource route
func (h *QuotasHandler) GetQuota(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	if !request.URL.Query().Has("group") {
		// TODO its returning a 500 instead of 400 bad request
		writer.WriteHeader(http.StatusBadRequest)
		return fmt.Errorf("missing required query parameters: group")
	}
	if !request.URL.Query().Has("resource") {
		writer.WriteHeader(http.StatusBadRequest)
		return fmt.Errorf("missing required query parameters: resource")
	}
	group := request.URL.Query().Get("group")
	res := request.URL.Query().Get("resource")

	quotaReq := &resourcepb.QuotaUsageRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: request.ResourceIdentifier.Namespace,
			Group:     group,
			Resource:  res,
		},
	}
	quota, err := h.ResourceClient.GetQuotaUsage(ctx, quotaReq)
	if err != nil {
		return err
	}

	writer.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(writer).Encode(quotasv0alpha1.GetUsage{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "quotas.grafana.com/v0alpha1",
			Kind:       "Quotas",
		},
		GetUsageBody: quotasv0alpha1.GetUsageBody{
			Namespace: request.ResourceIdentifier.Namespace,
			Group:     group,
			Resource:  res,
			Usage:     quota.Usage,
			Limit:     quota.Limit,
		},
	})
}

func New(cfg app.Config) (app.App, error) {
	appConfig, ok := cfg.SpecificConfig.(*QuotasAppConfig)
	if !ok {
		return nil, fmt.Errorf("expected QuotasAppConfig but got %T", cfg.SpecificConfig)
	}
	handler := NewQuotasHandler(appConfig)

	simpleConfig := simple.AppConfig{
		Name:       "quotas",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logging.FromContext(ctx).Error("Informer processing error", "error", err)
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{},
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v0alpha1": {
				{
					Namespaced: true,
					Path:       "usage",
					Method:     "GET",
				}: handler.GetQuota,
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
	return map[schema.GroupVersion][]resource.Kind{}
}
