package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apis/frontendnotification/v0alpha1"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
)

func (hs *HTTPServer) registerFrontendNotificationAPI(apiRoute routing.RouteRegister) {
	apiRoute.Group("/frontend-notification", func(frontendNotificationRoute routing.RouteRegister) {
		handler := newFrontendNotificationK8sHandler(hs)
		frontendNotificationRoute.Post("/", handler.createFrontendNotification)
	})
}

//-----------------------------------------------------------------------------------------
// FrontendNotification k8s wrapper functions
//-----------------------------------------------------------------------------------------

type frontendNotificationK8sHandler struct {
	namespacer           request.NamespaceMapper
	clientConfigProvider grafanaapiserver.DirectRestConfigProvider
}

func newFrontendNotificationK8sHandler(hs *HTTPServer) *frontendNotificationK8sHandler {
	return &frontendNotificationK8sHandler{
		namespacer:           request.GetNamespaceMapper(hs.Cfg),
		clientConfigProvider: hs.clientConfigProvider,
	}
}

func (fk8s *frontendNotificationK8sHandler) createFrontendNotification(c *contextmodel.ReqContext) {
	client, ok := fk8s.getClient(c)
	if !ok {
		return // error is already sent
	}

	out, err := client.Create(c.Req.Context(), &unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"message": "TODO",
			},
		},
	}, v1.CreateOptions{})

	if err != nil {
		c.JsonApiErr(500, "client", err)
		return
	}
	c.JSON(http.StatusOK, out)
}

func (fk8s *frontendNotificationK8sHandler) getClient(c *contextmodel.ReqContext) (dynamic.ResourceInterface, bool) {
	dyn, err := dynamic.NewForConfig(fk8s.clientConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		c.JsonApiErr(500, "client", err)
		return nil, false
	}
	return dyn.Resource(v0alpha1.FrontendNotificationResourceInfo.GroupVersionResource()).Namespace(fk8s.namespacer(c.OrgID)), true
}
