package mtctx

import (
	"context"
	"fmt"
	"log"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var _ Service = (*ServiceImpl)(nil)

type Service interface {
	GetStackConfigWatcher(ctx context.Context, stackID int64) (watch.Interface, error)
}

func ProvideService(router routing.RouteRegister) Service {
	svc := &ServiceImpl{}
	router.Get("/api/hack/hello", middleware.ReqOrgAdmin, routing.Wrap(svc.doGetEntity))

	config, err := rest.InClusterConfig()
	if err == nil {
		svc.clientset, err = kubernetes.NewForConfig(config)
	}

	// creates the clientset
	if err != nil {
		log.Println("DOOOH, the config watcher client can not run: " + err.Error())
	}

	return svc
}

type ServiceImpl struct {
	clientset *kubernetes.Clientset
	cache     map[int64]TenantInfo
}

func (s *ServiceImpl) doGetEntity(c *models.ReqContext) response.Response {
	// stackID := ~ where do I get this from? ~
	// cfg := s.GetTenantConfig(stackId)
	// fmt.Println(cfg.SomeThingFromConfig)

	return response.JSON(200, map[string]interface{}{
		"hello": "world",
	})
}

func (s *ServiceImpl) GetStackConfigWatcher(ctx context.Context, stackID int64) (watch.Interface, error) {
	if s.clientset == nil {
		return nil, fmt.Errorf("missing error")
	}

	return s.clientset.CoreV1().ConfigMaps("hosted-grafana").Watch(ctx, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("metadata[name]=%d-hackathon-mthg", stackID),
	})

	// for {
	// 	select {
	// 	case event := <-watcher.ResultChan():
	// 		// Handle the event.
	// 		log.Printf("ConfigMap %s updated: %+v", event.Object.(*v1.ConfigMap).Name, event)
	// 	}
	// }
}

// gets initial config ini and registers the watcher for config changes
func (s *ServiceImpl) GetTenantConfig(stackID int64) any {
	if info, ok := s.cache[stackID]; ok {
		return &info
	}

	_, err := s.GetStackConfigWatcher(context.TODO(), stackID)
	if err != nil {
		fmt.Println("Error getting watcher for stackID:", stackID)
	}

	// register config watcher somewhere to listen for changes
	// ~magic~

	// Maybe return an INI ?
	return &TenantInfo{}
}

func (s *ServiceImpl) BuildTenantInfoFromConfig(stackID int64, config any) *TenantInfo {
	// make db connection
	// dbCon := ~magic~ to connect to db with config

	return &TenantInfo{
		StackID: stackID,
	}
}
