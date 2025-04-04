package frontendnotification

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/frontendnotification/v0alpha1"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
)

type FrontendNotificationService struct {
	live                 *live.GrafanaLive // Inject this through wire/dependency injection
	clientConfigProvider grafanaapiserver.DirectRestConfigProvider
}

func ProvideService(live *live.GrafanaLive, clientConfigProvider grafanaapiserver.DirectRestConfigProvider) *FrontendNotificationService {
	return &FrontendNotificationService{
		live:                 live,
		clientConfigProvider: clientConfigProvider,
	}
}

func (s *FrontendNotificationService) SendNotification(ctx context.Context, orgID int64, message interface{}) error {
	// Create a service identity context
	svcCtx, svcIdentity := identity.WithServiceIdentity(ctx, orgID)

	// Create a new HTTP request with context
	req, err := http.NewRequestWithContext(svcCtx, "POST", "/api/frontend-notification", nil)
	if err != nil {
		return err
	}

	// Create a ReqContext for the API client
	reqCtx := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter(req.Method, nil),
		},
		SignedInUser: &user.SignedInUser{
			OrgID: orgID,
			Permissions: map[int64]map[string][]string{
				orgID: svcIdentity.GetPermissions(),
			},
		},
		IsSignedIn: true,
	}

	// Create a frontend notification using the Kubernetes-style API
	dyn, err := dynamic.NewForConfig(s.clientConfigProvider.GetDirectRestConfig(reqCtx))
	if err != nil {
		return err
	}

	// Create the notification object
	notification := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": v0alpha1.APIVERSION,
			"kind":       "FrontendNotification",
			"metadata": map[string]interface{}{
				"generateName": "notification-",
			},
			"spec": map[string]interface{}{
				"message": message.(string),
			},
		},
	}

	// Create the notification in the appropriate namespace
	_, err = dyn.Resource(v0alpha1.FrontendNotificationResourceInfo.GroupVersionResource()).
		Namespace("default").
		Create(svcCtx, notification, v1.CreateOptions{})
	if err != nil {
		return err
	}

	return nil
}
