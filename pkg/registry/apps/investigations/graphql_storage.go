package investigations

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
	"github.com/grafana/grafana-app-sdk/resource"
	investigationv0alpha1 "github.com/grafana/grafana/apps/investigations/pkg/apis/investigations/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// investigationsRESTStorageAdapter adapts the investigations REST API to work with GraphQL storage interface
type investigationsRESTStorageAdapter struct {
	namespacer request.NamespaceMapper
	cfg        *setting.Cfg
}

// Ensure investigationsRESTStorageAdapter implements graphqlsubgraph.Storage
var _ graphqlsubgraph.Storage = (*investigationsRESTStorageAdapter)(nil)

// NewInvestigationsStorageAdapter creates a new investigations storage adapter
func NewInvestigationsStorageAdapter(cfg *setting.Cfg) graphqlsubgraph.Storage {
	return &investigationsRESTStorageAdapter{
		namespacer: request.GetNamespaceMapper(cfg),
		cfg:        cfg,
	}
}

// ensureTypeMetaSet ensures that the TypeMeta is properly set on a resource object
// This is critical for GraphQL resource handlers to be called during conversion
func (a *investigationsRESTStorageAdapter) ensureTypeMetaSet(obj resource.Object) {
	// Check if TypeMeta is already set
	gvk := obj.GroupVersionKind()
	if gvk.Kind == "" || gvk.Version == "" {
		// Set proper TypeMeta for investigation resources
		kind := investigationv0alpha1.InvestigationKind()
		obj.SetGroupVersionKind(schema.GroupVersionKind{
			Group:   kind.Group(),
			Version: kind.Version(),
			Kind:    kind.Kind(),
		})
	}
}

// Get retrieves a single investigation by namespace and name
func (a *investigationsRESTStorageAdapter) Get(ctx context.Context, namespace, name string) (resource.Object, error) {
	// Make internal HTTP request to investigations API
	url := fmt.Sprintf("http://localhost:%s/apis/investigations.grafana.app/v0alpha1/namespaces/%s/investigations/%s", a.cfg.HTTPPort, namespace, name)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	// Try to get authentication from the context and pass it through
	if authHeader := ctx.Value("auth_header"); authHeader != nil {
		if authStr, ok := authHeader.(string); ok {
			req.Header.Set("Authorization", authStr)
		}
	}

	// Fallback: use basic auth for internal calls
	if req.Header.Get("Authorization") == "" {
		req.SetBasicAuth("admin", "admin")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get investigation %s: %w", name, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("investigation not found: %s", name)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get investigation %s: status %d", name, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var investigation investigationv0alpha1.Investigation
	if err := json.Unmarshal(body, &investigation); err != nil {
		return nil, fmt.Errorf("failed to unmarshal investigation: %w", err)
	}

	// CRITICAL: Ensure TypeMeta is set for GraphQL resource handlers to work
	a.ensureTypeMetaSet(&investigation)

	return &investigation, nil
}

// List retrieves multiple investigations with optional filtering
func (a *investigationsRESTStorageAdapter) List(ctx context.Context, namespace string, options graphqlsubgraph.ListOptions) (resource.ListObject, error) {
	// Make internal HTTP request to investigations API
	url := fmt.Sprintf("http://localhost:%s/apis/investigations.grafana.app/v0alpha1/namespaces/%s/investigations", a.cfg.HTTPPort, namespace)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	// Try to get authentication from the context and pass it through
	if authHeader := ctx.Value("auth_header"); authHeader != nil {
		if authStr, ok := authHeader.(string); ok {
			req.Header.Set("Authorization", authStr)
		}
	}

	// Fallback: use basic auth for internal calls
	if req.Header.Get("Authorization") == "" {
		req.SetBasicAuth("admin", "admin")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list investigations: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to list investigations: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var investigationList investigationv0alpha1.InvestigationList
	if err := json.Unmarshal(body, &investigationList); err != nil {
		return nil, fmt.Errorf("failed to unmarshal investigation list: %w", err)
	}

	// CRITICAL: Ensure TypeMeta is set on all items for GraphQL resource handlers to work
	items := investigationList.GetItems()
	for _, item := range items {
		a.ensureTypeMetaSet(item)
	}

	return &investigationList, nil
}

// Create creates a new investigation
func (a *investigationsRESTStorageAdapter) Create(ctx context.Context, namespace string, obj resource.Object) (resource.Object, error) {
	return nil, fmt.Errorf("investigation storage adapter Create not yet implemented")
}

// Update updates an existing investigation
func (a *investigationsRESTStorageAdapter) Update(ctx context.Context, namespace, name string, obj resource.Object) (resource.Object, error) {
	return nil, fmt.Errorf("investigation storage adapter Update not yet implemented")
}

// Delete deletes an investigation by namespace and name
func (a *investigationsRESTStorageAdapter) Delete(ctx context.Context, namespace, name string) error {
	return fmt.Errorf("investigation storage adapter Delete not yet implemented")
}
