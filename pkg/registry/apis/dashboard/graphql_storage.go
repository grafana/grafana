package dashboard

import (
	"context"
	"encoding/json"
	"fmt"

	claims "github.com/grafana/authlib/types"
	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
	"github.com/grafana/grafana-app-sdk/resource"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	unifiedresource "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// dashboardStorageAdapter bridges Dashboard legacy storage to GraphQL storage interface
type dashboardStorageAdapter struct {
	access     legacy.DashboardAccess
	namespacer request.NamespaceMapper
}

// Ensure dashboardStorageAdapter implements GraphQL Storage interface
var _ graphqlsubgraph.Storage = (*dashboardStorageAdapter)(nil)

// NewDashboardStorageAdapter creates a new dashboard storage adapter
func NewDashboardStorageAdapter(access legacy.DashboardAccess, namespacer request.NamespaceMapper) *dashboardStorageAdapter {
	return &dashboardStorageAdapter{
		access:     access,
		namespacer: namespacer,
	}
}

// Get implements graphqlsubgraph.Storage - fetches a single dashboard
func (s *dashboardStorageAdapter) Get(ctx context.Context, namespace, name string) (resource.Object, error) {
	// Parse namespace to get org ID
	nsInfo, err := claims.ParseNamespace(namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to parse namespace: %w", err)
	}

	// Get dashboard from legacy storage
	dash, _, err := s.access.GetDashboard(ctx, nsInfo.OrgID, name, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboard: %w", err)
	}
	if dash == nil {
		return nil, fmt.Errorf("dashboard not found")
	}

	// Ensure TypeMeta is set for GraphQL resource handlers
	if dash.TypeMeta.APIVersion == "" {
		dash.TypeMeta.APIVersion = dashboardV1.DashboardResourceInfo.GroupVersion().String()
	}
	if dash.TypeMeta.Kind == "" {
		dash.TypeMeta.Kind = "Dashboard"
	}

	return dash, nil
}

// List implements graphqlsubgraph.Storage - fetches multiple dashboards
func (s *dashboardStorageAdapter) List(ctx context.Context, namespace string, options graphqlsubgraph.ListOptions) (resource.ListObject, error) {
	// Parse namespace to get org ID
	_, err := claims.ParseNamespace(namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to parse namespace: %w", err)
	}

	// Build list request
	req := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     dashboardV1.DashboardResourceInfo.GroupResource().Group,
				Resource:  dashboardV1.DashboardResourceInfo.GroupResource().Resource,
			},
		},
		Limit: options.Limit,
	}

	// Set up the list callback to collect dashboards
	var dashboards []resource.Object
	listCallback := func(iter unifiedresource.ListIterator) error {
		for {
			if !iter.Next() {
				break // End of list
			}

			// Parse the dashboard JSON
			var dash dashboardV1.Dashboard
			if err := json.Unmarshal(iter.Value(), &dash); err != nil {
				return fmt.Errorf("failed to unmarshal dashboard: %w", err)
			}

			// Ensure TypeMeta is set for GraphQL resource handlers
			if dash.TypeMeta.APIVersion == "" {
				dash.TypeMeta.APIVersion = dashboardV1.DashboardResourceInfo.GroupVersion().String()
			}
			if dash.TypeMeta.Kind == "" {
				dash.TypeMeta.Kind = "Dashboard"
			}

			dashboards = append(dashboards, &dash)
		}
		return iter.Error()
	}

	// Execute the list operation
	_, err = s.access.ListIterator(ctx, req, listCallback)
	if err != nil {
		return nil, fmt.Errorf("failed to list dashboards: %w", err)
	}

	// Create the list result
	list := &dashboardV1.DashboardList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: dashboardV1.DashboardResourceInfo.GroupVersion().String(),
			Kind:       "DashboardList",
		},
		Items: make([]dashboardV1.Dashboard, len(dashboards)),
	}

	// Convert to proper list items
	for i, dashboard := range dashboards {
		if dash, ok := dashboard.(*dashboardV1.Dashboard); ok {
			list.Items[i] = *dash
		}
	}

	return list, nil
}

// Create implements graphqlsubgraph.Storage - creates a new dashboard
func (s *dashboardStorageAdapter) Create(ctx context.Context, namespace string, obj resource.Object) (resource.Object, error) {
	// Parse namespace to get org ID
	nsInfo, err := claims.ParseNamespace(namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to parse namespace: %w", err)
	}

	// Type assertion to Dashboard
	dash, ok := obj.(*dashboardV1.Dashboard)
	if !ok {
		return nil, fmt.Errorf("expected Dashboard, got %T", obj)
	}

	// Ensure namespace is set
	if dash.GetNamespace() == "" {
		dash.SetNamespace(namespace)
	}

	// Save dashboard using legacy storage
	savedDash, _, err := s.access.SaveDashboard(ctx, nsInfo.OrgID, dash, true) // failOnExisting=true for create
	if err != nil {
		return nil, fmt.Errorf("failed to create dashboard: %w", err)
	}

	// Ensure TypeMeta is set for GraphQL resource handlers
	if savedDash.TypeMeta.APIVersion == "" {
		savedDash.TypeMeta.APIVersion = dashboardV1.DashboardResourceInfo.GroupVersion().String()
	}
	if savedDash.TypeMeta.Kind == "" {
		savedDash.TypeMeta.Kind = "Dashboard"
	}

	return savedDash, nil
}

// Update implements graphqlsubgraph.Storage - updates an existing dashboard
func (s *dashboardStorageAdapter) Update(ctx context.Context, namespace, name string, obj resource.Object) (resource.Object, error) {
	// Parse namespace to get org ID
	nsInfo, err := claims.ParseNamespace(namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to parse namespace: %w", err)
	}

	// Type assertion to Dashboard
	dash, ok := obj.(*dashboardV1.Dashboard)
	if !ok {
		return nil, fmt.Errorf("expected Dashboard, got %T", obj)
	}

	// Ensure name and namespace match
	if dash.GetName() != name {
		dash.SetName(name)
	}
	if dash.GetNamespace() == "" {
		dash.SetNamespace(namespace)
	}

	// Save dashboard using legacy storage
	savedDash, _, err := s.access.SaveDashboard(ctx, nsInfo.OrgID, dash, false) // failOnExisting=false for update
	if err != nil {
		return nil, fmt.Errorf("failed to update dashboard: %w", err)
	}

	// Ensure TypeMeta is set for GraphQL resource handlers
	if savedDash.TypeMeta.APIVersion == "" {
		savedDash.TypeMeta.APIVersion = dashboardV1.DashboardResourceInfo.GroupVersion().String()
	}
	if savedDash.TypeMeta.Kind == "" {
		savedDash.TypeMeta.Kind = "Dashboard"
	}

	return savedDash, nil
}

// Delete implements graphqlsubgraph.Storage - deletes a dashboard
func (s *dashboardStorageAdapter) Delete(ctx context.Context, namespace, name string) error {
	// Parse namespace to get org ID
	nsInfo, err := claims.ParseNamespace(namespace)
	if err != nil {
		return fmt.Errorf("failed to parse namespace: %w", err)
	}

	// Delete dashboard using legacy storage
	_, _, err = s.access.DeleteDashboard(ctx, nsInfo.OrgID, name)
	if err != nil {
		return fmt.Errorf("failed to delete dashboard: %w", err)
	}

	return nil
}
