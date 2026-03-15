package app

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	dashboardv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/infra/log"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

var logger = log.New("stalebot.scanner")

type DashboardScanner struct {
	restConfig rest.Config
}

func NewDashboardScanner(restConfig rest.Config) *DashboardScanner {
	return &DashboardScanner{restConfig: restConfig}
}

func (s *DashboardScanner) FindStaleDashboards(ctx context.Context, namespace string) error {
	// Step 1: list all dashboards via typed client
	clientRegistry := k8s.NewClientRegistry(s.restConfig, k8s.ClientConfig{})
	rawClient, err := clientRegistry.ClientFor(dashboardv2beta1.DashboardKind())
	if err != nil {
		return fmt.Errorf("create dashboard client: %w", err)
	}
	dashboardClient := dashboardv2beta1.NewDashboardClient(rawClient)
	dashboards, err := dashboardClient.ListAll(ctx, namespace, resource.ListOptions{})
	if err != nil {
		return fmt.Errorf("list dashboards: %w", err)
	}
	logger.Info("Step 1: found dashboards", "count", len(dashboards.Items), "namespace", namespace)

	// uid → title
	titles := make(map[string]string, len(dashboards.Items))
	for _, d := range dashboards.Items {
		titles[d.GetName()] = d.Spec.Title
	}

	// Step 2: list DashboardStats via dynamic client (enterprise types not importable)
	dynClient, err := dynamic.NewForConfig(&s.restConfig)
	if err != nil {
		return fmt.Errorf("create dynamic client: %w", err)
	}
	statsGVR := schema.GroupVersionResource{
		Group:    "usageinsights.grafana.app",
		Version:  "v0alpha1",
		Resource: "dashboardstats",
	}
	statsList, err := dynClient.Resource(statsGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("list dashboard stats: %w", err)
	}
	logger.Info("Step 2: found dashboard stats", "count", len(statsList.Items), "namespace", namespace)

	// uid → views_last_30_days
	views := make(map[string]int64, len(statsList.Items))
	for _, item := range statsList.Items {
		uid := item.GetName()
		raw, _, _ := unstructured.NestedFieldNoCopy(item.Object, "views_last_30_days")
		if v, ok := raw.(int64); ok {
			views[uid] = v
		} else if n, err := json.Number(fmt.Sprintf("%v", raw)).Int64(); err == nil {
			views[uid] = n
		}
	}

	// Step 3: filter dashboards not viewed in the last 30 days
	var stale []string
	for uid := range titles {
		if views[uid] == 0 {
			stale = append(stale, uid)
		}
	}
	logger.Info("Step 3: filtered by views_last_30_days == 0",
		"total", len(titles),
		"with_views", len(titles)-len(stale),
		"stale", len(stale),
	)

	for _, uid := range stale {
		fmt.Printf("name=%s uid=%s\n", titles[uid], uid)
	}
	return nil
}
