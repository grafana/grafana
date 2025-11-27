package app

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	unifiedStorage "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	//"github.com/grafana/grafana-app-sdk/resource"
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

// GetQuota handles requests for the GET /something resource route
func (h *QuotasHandler) GetQuota(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	// expects a query param "groupResource" with value like "dashboards.grafana.app/dashboard"
	groupResource := "/"
	if request.URL.Query().Has("groupResource") {
		groupResource = request.URL.Query().Get("groupResource")
	}
	group := strings.Split(groupResource, "/")[0]
	res := strings.Split(groupResource, "/")[1]

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

	return json.NewEncoder(writer).Encode(quotasv0alpha1.GetQuotaUsage{
		TypeMeta: metav1.TypeMeta{
			APIVersion: fmt.Sprintf("%s/%s", quotasv0alpha1.APIGroup, quotasv0alpha1.APIVersion),
		},
		GetQuotaUsageBody: quotasv0alpha1.GetQuotaUsageBody{
			Namespace: request.ResourceIdentifier.Namespace,
			Resource:  resName,
			Group:     resGroup,
			Usage:     quota.Usage,
			Limit:     quota.Limit,
		},
	})
}

func New(cfg app.Config) (app.App, error) {
	handler := NewQuotasHandler(cfg.SpecificConfig.(*QuotasAppConfig))

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
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: quotasv0alpha1.QuotaKind(),
			},
		},
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
	gv := schema.GroupVersion{
		Group:   quotasv0alpha1.QuotaKind().Group(),
		Version: quotasv0alpha1.QuotaKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {quotasv0alpha1.QuotaKind()},
	}
}
