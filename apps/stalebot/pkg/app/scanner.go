package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	dashboardv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	usageinsightsv0alpha1 "github.com/grafana/grafana/pkg/extensions/apis/usageinsights/v0alpha1"
	"k8s.io/client-go/rest"
)

type DashboardScanner struct {
	restConfig rest.Config
}

func NewDashboardScanner(restConfig rest.Config) *DashboardScanner {
	return &DashboardScanner{restConfig: restConfig}
}

func (s *DashboardScanner) FindStaleDashboards(ctx context.Context, namespace string) error {
	log := logging.FromContext(ctx)

	// Step 1: list all dashboards via typed client
	clientRegistry := k8s.NewClientRegistry(s.restConfig, k8s.ClientConfig{})
	rawClient, err := clientRegistry.ClientFor(dashboardv2beta1.DashboardKind())
	if err != nil {
		return fmt.Errorf("create dashboard client: %w", err)
	}
	dashboardClient := dashboardv2beta1.NewDashboardClient(rawClient)
	dashboards, err := dashboardClient.ListAll(ctx, namespace, resource.ListOptions{})
	if err != nil {
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		log.Error("FAILED TO LIST DASHBOARDS!!!", "error", err)
		return fmt.Errorf("list dashboards: %w", err)
	}
	log.Info("Step 1: found dashboards", "count", len(dashboards.Items), "namespace", namespace)
	log.Info("Step 1: found dashboards", "count", len(dashboards.Items), "namespace", namespace)
	log.Info("Step 1: found dashboards", "count", len(dashboards.Items), "namespace", namespace)
	log.Info("Step 1: found dashboards", "count", len(dashboards.Items), "namespace", namespace)
	log.Info("Step 1: found dashboards", "count", len(dashboards.Items), "namespace", namespace)
	log.Info("Step 1: found dashboards", "count", len(dashboards.Items), "namespace", namespace)
	log.Info("Step 1: found dashboards", "count", len(dashboards.Items), "namespace", namespace)
	log.Info("Step 1: found dashboards", "count", len(dashboards.Items), "namespace", namespace)
	log.Info("Step 1: found dashboards", "count", len(dashboards.Items), "namespace", namespace)

	// uid → title
	titles := make(map[string]string, len(dashboards.Items))
	for _, d := range dashboards.Items {
		titles[d.GetName()] = d.Spec.Title
	}

	// Step 2: list DashboardStats via typed client
	statsRawClient, err := clientRegistry.ClientFor(usageinsightsv0alpha1.DashboardStatsKind())
	if err != nil {
		return fmt.Errorf("create dashboard stats client: %w", err)
	}
	statsClient := resource.NewTypedClient[*usageinsightsv0alpha1.DashboardStats, *usageinsightsv0alpha1.DashboardStatsList](statsRawClient, usageinsightsv0alpha1.DashboardStatsKind())
	statsList, err := statsClient.List(ctx, namespace, resource.ListOptions{})
	if err != nil {
		return fmt.Errorf("list dashboard stats: %w", err)
	}
	log.Info("Step 2: found dashboard stats", "count", len(statsList.Items), "namespace", namespace)

	// uid → views_last_30_days
	views := make(map[string]int64, len(statsList.Items))
	for _, item := range statsList.Items {
		views[item.GetName()] = item.DashboardStatsStatus.ViewsLast30Days
	}

	// Step 3: filter dashboards not viewed in the last 30 days
	var stale []string
	for uid := range titles {
		if views[uid] == 0 {
			stale = append(stale, uid)
		}
	}
	log.Info("Step 3: filtered by views_last_30_days == 0", "total", len(titles), "with_views", len(titles)-len(stale), "stale", len(stale))

	for _, uid := range stale {
		fmt.Printf("name=%s uid=%s\n", titles[uid], uid)
	}
	return nil
}
