package service

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/bridge"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/registry/corecrd"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
)

type DashboardController struct {
	dashboardService *DashboardServiceImpl
	bridgeService    *bridge.Service
	reg              *corecrd.Registry
}

func ProvideDashboardController(bridgeService *bridge.Service, reg *corecrd.Registry, dasboardService *DashboardServiceImpl) *DashboardController {
	return &DashboardController{
		dashboardService: dasboardService,
		bridgeService:    bridgeService,
		reg:              reg,
	}
}

func (c *DashboardController) Run(ctx context.Context) error {
	dashboardCRD := c.reg.Dashboard()

	gvr := schema.GroupVersionResource{
		Group:    dashboardCRD.GVK().Group,
		Version:  dashboardCRD.GVK().Version,
		Resource: dashboardCRD.Schema.Spec.Names.Plural,
	}

	factory := dynamicinformer.NewDynamicSharedInformerFactory(c.bridgeService.ClientSet.Dynamic, time.Minute)
	dashboardInformer := factory.ForResource(gvr).Informer()

	dashboardInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			uObj, ok := obj.(*unstructured.Unstructured)
			if !ok {
				fmt.Println("dashboard add: failed to convert to dashboard")
				return
			}

			dash := k8ssys.Base[dashboard.Dashboard]{}
			err := runtime.DefaultUnstructuredConverter.FromUnstructured(uObj.UnstructuredContent(), &dash)
			if err != nil {
				fmt.Println("dashboard add: failed to convert to dashboard", err)
				return
			}

			fmt.Printf("dashboard added: %+v \n", dash)
			//c.dashboardService.SaveDashboard()
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			dash, ok := newObj.(*k8ssys.Base[dashboard.Dashboard])
			if !ok {
				fmt.Println("dashboard update: failed to convert to dashboard")
				return
			}
			fmt.Printf("dashboard updated: %+v \n", dash)
			//c.dashboardService.SaveDashboard()
		},
		DeleteFunc: func(obj interface{}) {
			fmt.Printf("dashboard deleted: %s \n", obj)
			//c.dashboardService.DeleteDashboard(ctx, obj.ID, obj.OrgID)
		},
	})

	stop := make(chan struct{})
	defer close(stop)

	factory.Start(stop)
	<-ctx.Done()
	return nil
}
