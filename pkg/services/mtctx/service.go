package mtctx

import (
	"log"
	"net/http"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

type Service interface {
	Middleware(next http.Handler) http.Handler
}

var _ Service = (*serviceImpl)(nil)

func ProvideService(router routing.RouteRegister) Service {
	svc := &serviceImpl{}

	// attach kubernetes client to service
	config, err := rest.InClusterConfig()
	if err != nil {
		log.Println("could not get kubernetes config", err)
	} else if config != nil {
		// creates the client
		svc.clientset, err = kubernetes.NewForConfig(config)
		if err != nil {
			log.Println("could not initialize kubernetes client", err.Error())
		}
	}

	// add middleware to push tenant info to request
	// require admin
	router.Get("/api/hack/hello", svc.InitializeTenantConfig, middleware.ReqOrgAdmin, routing.Wrap(svc.showTenantInfo))

	return svc
}
