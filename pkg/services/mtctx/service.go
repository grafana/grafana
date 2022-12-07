package mtctx

import (
	"log"
	"net/http"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Service interface {
	Middleware(next http.Handler) http.Handler
}

var _ Service = (*serviceImpl)(nil)

func ProvideService(router routing.RouteRegister) Service {
	svc := &serviceImpl{
		cache:     make(map[int64]*TenantInfo, 0),
		namespace: "default", // "hosted-grafana"
	}

	kubeconfig := "/Users/ryan/.kube/config"
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)

	if err != nil {
		// attach kubernetes client to service
		svc.namespace = "hosted-grafana"
		config, err = rest.InClusterConfig()
	}

	if err != nil {
		log.Println("could not get kubernetes config", err)
	} else if config != nil {
		// creates the client
		svc.clientset, err = kubernetes.NewForConfig(config)
		if err != nil {
			log.Println("could not initialize kubernetes client", err.Error())
		}
	}

	// require admin
	router.Get("/api/hack/hello", middleware.ReqOrgAdmin, routing.Wrap(svc.showTenantInfo))

	return svc
}
