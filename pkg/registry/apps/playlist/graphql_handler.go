package playlist

import (
	"fmt"
	"reflect"

	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
	"github.com/grafana/grafana-app-sdk/resource"
	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/graphql-go/graphql"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// playlistGraphQLHandler implements ResourceGraphQLHandler for playlist resources
type playlistGraphQLHandler struct {
	// Add subgraph registry to enable cross-resource relationships
	subgraphRegistry SubgraphRegistry
}

// SubgraphRegistry interface for finding other subgraphs
type SubgraphRegistry interface {
	GetSubgraphForKind(gvk schema.GroupVersionKind) (SubgraphInterface, error)
}

// SubgraphInterface represents a GraphQL subgraph
type SubgraphInterface interface {
	GetStorage(gvr schema.GroupVersionResource) graphqlsubgraph.Storage
}

// Ensure playlistGraphQLHandler implements ResourceGraphQLHandler
var _ graphqlsubgraph.ResourceGraphQLHandler = (*playlistGraphQLHandler)(nil)

// NewPlaylistGraphQLHandler creates a new playlist GraphQL handler
func NewPlaylistGraphQLHandler() graphqlsubgraph.ResourceGraphQLHandler {
	return &playlistGraphQLHandler{}
}

// NewPlaylistGraphQLHandlerWithRegistry creates a new playlist GraphQL handler with subgraph registry for relationships
func NewPlaylistGraphQLHandlerWithRegistry(registry SubgraphRegistry) graphqlsubgraph.ResourceGraphQLHandler {
	return &playlistGraphQLHandler{
		subgraphRegistry: registry,
	}
}

// GetResourceKind returns the playlist resource kind
func (h *playlistGraphQLHandler) GetResourceKind() resource.Kind {
	return playlistv0alpha1.PlaylistKind()
}

// GetGraphQLFields returns playlist-specific GraphQL fields
func (h *playlistGraphQLHandler) GetGraphQLFields() graphql.Fields {
	// Create playlist item type with relationship support
	playlistItemType := graphql.NewObject(graphql.ObjectConfig{
		Name: "PlaylistItem",
		Fields: graphql.Fields{
			"id":          &graphql.Field{Type: graphql.Int},
			"playlistUid": &graphql.Field{Type: graphql.String},
			"type":        &graphql.Field{Type: graphql.String},
			"value":       &graphql.Field{Type: graphql.String},
			"order":       &graphql.Field{Type: graphql.Int},
			"title":       &graphql.Field{Type: graphql.String},
			// Add dashboard relationship field
			"dashboard": &graphql.Field{
				Type:        h.getDashboardTypeReference(),
				Description: "Dashboard referenced by this playlist item (value matches dashboard metadata.name)",
				Resolve:     h.createDashboardResolver(),
			},
		},
	})

	// Return playlist-specific fields that will be added to the base resource type
	return graphql.Fields{
		"uid":      &graphql.Field{Type: graphql.String},
		"name":     &graphql.Field{Type: graphql.String},
		"interval": &graphql.Field{Type: graphql.String},
		"items":    &graphql.Field{Type: graphql.NewList(playlistItemType)},
	}
}

// getDashboardTypeReference returns a reference to the Dashboard type from the dashboard subgraph
func (h *playlistGraphQLHandler) getDashboardTypeReference() graphql.Type {
	// In proper GraphQL federation, this would reference the Dashboard type from the dashboard subgraph
	// For now, we'll create a minimal interface that represents the Dashboard structure
	// without conflicting with the actual Dashboard type name
	return graphql.NewObject(graphql.ObjectConfig{
		Name: "DashboardReference",
		Fields: graphql.Fields{
			"uid":         &graphql.Field{Type: graphql.String},
			"title":       &graphql.Field{Type: graphql.String},
			"description": &graphql.Field{Type: graphql.String},
			"metadata": &graphql.Field{
				Type: graphql.NewObject(graphql.ObjectConfig{
					Name: "DashboardReferenceMetadata",
					Fields: graphql.Fields{
						"name":              &graphql.Field{Type: graphql.String},
						"uid":               &graphql.Field{Type: graphql.String},
						"namespace":         &graphql.Field{Type: graphql.String},
						"creationTimestamp": &graphql.Field{Type: graphql.String},
					},
				}),
			},
		},
	})
}

// createDashboardResolver creates a resolver function for the dashboard relationship
func (h *playlistGraphQLHandler) createDashboardResolver() graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		// Extract the playlist item from the source
		playlistItem, ok := p.Source.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("expected playlist item, got %T", p.Source)
		}

		// Get the type and value from the playlist item
		itemType, typeExists := playlistItem["type"].(string)
		itemValue, valueExists := playlistItem["value"].(string)

		if !typeExists || !valueExists {
			return nil, nil // Return null if type or value is missing
		}

		// Only resolve dashboard relationship for dashboard_by_uid type
		if itemType != "dashboard_by_uid" {
			return nil, nil // Return null for other types
		}

		// If we don't have a subgraph registry, we can't resolve the relationship
		if h.subgraphRegistry == nil {
			// For demonstration, return a mock dashboard object
			return h.createMockDashboard(itemValue), nil
		}

		// Find the dashboard subgraph
		dashboardGVK := schema.GroupVersionKind{
			Group:   "dashboard.grafana.app",
			Version: "v1beta1",
			Kind:    "Dashboard",
		}

		dashboardSubgraph, err := h.subgraphRegistry.GetSubgraphForKind(dashboardGVK)
		if err != nil {
			// Graceful degradation - return null if dashboard subgraph is not available
			return nil, nil
		}

		// Get the dashboard storage
		dashboardGVR := schema.GroupVersionResource{
			Group:    "dashboard.grafana.app",
			Version:  "v1beta1",
			Resource: "dashboards",
		}

		storage := dashboardSubgraph.GetStorage(dashboardGVR)
		if storage == nil {
			return nil, nil
		}

		// Extract namespace from context
		namespace := "default" // Default namespace
		if p.Context != nil {
			if ns, ok := p.Context.Value("namespace").(string); ok {
				namespace = ns
			}
		}

		// Fetch the dashboard by name (playlist item value matches metadata.name)
		dashboard, err := storage.Get(p.Context, namespace, itemValue)
		if err != nil {
			// Return null if dashboard is not found (graceful degradation)
			return nil, nil
		}

		return dashboard, nil
	}
}

// createMockDashboard creates a mock dashboard object for demonstration
func (h *playlistGraphQLHandler) createMockDashboard(name string) map[string]interface{} {
	return map[string]interface{}{
		"uid":         fmt.Sprintf("uid-%s", name), // UID is different from name
		"title":       fmt.Sprintf("Dashboard %s", name),
		"description": fmt.Sprintf("Dashboard with name %s", name),
		"metadata": map[string]interface{}{
			"name":              name, // This is what the playlist item value matches
			"uid":               fmt.Sprintf("uid-%s", name),
			"namespace":         "default",
			"creationTimestamp": "2024-01-01T00:00:00Z",
		},
	}
}

// ConvertResourceToGraphQL converts a playlist resource to GraphQL format
func (h *playlistGraphQLHandler) ConvertResourceToGraphQL(obj resource.Object) map[string]interface{} {
	metadata := obj.GetStaticMetadata()
	spec := obj.GetSpec()

	result := map[string]interface{}{
		"uid":      metadata.Name,   // fallback to name
		"name":     metadata.Name,   // fallback to name
		"interval": "5m",            // default interval
		"items":    []interface{}{}, // empty items array
	}

	// Try to extract playlist-specific data from spec
	if spec != nil {
		// Use reflection to extract fields from typed struct (this is the primary path)
		specValue := reflect.ValueOf(spec)
		if specValue.Kind() == reflect.Ptr {
			specValue = specValue.Elem()
		}

		if specValue.Kind() == reflect.Struct {
			// Try to find Title field
			if titleField := specValue.FieldByName("Title"); titleField.IsValid() && titleField.CanInterface() {
				if titleStr, ok := titleField.Interface().(string); ok && titleStr != "" {
					result["name"] = titleStr
				}
			}

			// Try to find Interval field
			if intervalField := specValue.FieldByName("Interval"); intervalField.IsValid() && intervalField.CanInterface() {
				if intervalStr, ok := intervalField.Interface().(string); ok && intervalStr != "" {
					result["interval"] = intervalStr
				}
			}

			// Try to find Items field
			if itemsField := specValue.FieldByName("Items"); itemsField.IsValid() && itemsField.CanInterface() {
				itemsValue := itemsField.Interface()

				// Handle slice of items
				if itemsSlice := reflect.ValueOf(itemsValue); itemsSlice.Kind() == reflect.Slice {
					graphqlItems := make([]interface{}, itemsSlice.Len())
					for i := 0; i < itemsSlice.Len(); i++ {
						item := itemsSlice.Index(i).Interface()

						// Try to extract fields from item struct
						itemValue := reflect.ValueOf(item)
						if itemValue.Kind() == reflect.Ptr {
							itemValue = itemValue.Elem()
						}

						graphqlItem := map[string]interface{}{
							"id":          i + 1,
							"playlistUid": metadata.Name,
							"order":       i + 1,
							"title":       fmt.Sprintf("Dashboard %d", i+1),
						}

						if itemValue.Kind() == reflect.Struct {
							// Try to get Type field
							if typeField := itemValue.FieldByName("Type"); typeField.IsValid() && typeField.CanInterface() {
								graphqlItem["type"] = fmt.Sprintf("%v", typeField.Interface())
							}
							// Try to get Value field
							if valueField := itemValue.FieldByName("Value"); valueField.IsValid() && valueField.CanInterface() {
								graphqlItem["value"] = fmt.Sprintf("%v", valueField.Interface())
							}
						}

						graphqlItems[i] = graphqlItem
					}
					result["items"] = graphqlItems
				}
			}
		} else {
			// Fallback: try as a map (in case it was unmarshaled as JSON)
			if specMap, ok := spec.(map[string]interface{}); ok {
				if title, exists := specMap["title"]; exists {
					result["name"] = title
				}
				if interval, exists := specMap["interval"]; exists {
					result["interval"] = interval
				}
				if items, exists := specMap["items"]; exists {
					if itemList, ok := items.([]interface{}); ok {
						// Convert items to GraphQL format
						graphqlItems := make([]interface{}, len(itemList))
						for i, item := range itemList {
							if itemMap, ok := item.(map[string]interface{}); ok {
								graphqlItems[i] = map[string]interface{}{
									"id":          i + 1,
									"playlistUid": metadata.Name,
									"type":        itemMap["type"],
									"value":       itemMap["value"],
									"order":       i + 1,
									"title":       fmt.Sprintf("Dashboard %d", i+1),
								}
							}
						}
						result["items"] = graphqlItems
					}
				}
			}
		}
	}

	return result
}
