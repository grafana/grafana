package playlist

import (
	"fmt"
	"reflect"

	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
	"github.com/grafana/grafana-app-sdk/resource"
	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/graphql-go/graphql"
)

// playlistGraphQLHandler implements ResourceGraphQLHandler for playlist resources
type playlistGraphQLHandler struct{}

// Ensure playlistGraphQLHandler implements ResourceGraphQLHandler
var _ graphqlsubgraph.ResourceGraphQLHandler = (*playlistGraphQLHandler)(nil)

// NewPlaylistGraphQLHandler creates a new playlist GraphQL handler
func NewPlaylistGraphQLHandler() graphqlsubgraph.ResourceGraphQLHandler {
	return &playlistGraphQLHandler{}
}

// GetResourceKind returns the playlist resource kind
func (h *playlistGraphQLHandler) GetResourceKind() resource.Kind {
	return playlistv0alpha1.PlaylistKind()
}

// GetGraphQLFields returns playlist-specific GraphQL fields
func (h *playlistGraphQLHandler) GetGraphQLFields() graphql.Fields {
	// Create playlist item type
	playlistItemType := graphql.NewObject(graphql.ObjectConfig{
		Name: "PlaylistItem",
		Fields: graphql.Fields{
			"id":          &graphql.Field{Type: graphql.Int},
			"playlistUid": &graphql.Field{Type: graphql.String},
			"type":        &graphql.Field{Type: graphql.String},
			"value":       &graphql.Field{Type: graphql.String},
			"order":       &graphql.Field{Type: graphql.Int},
			"title":       &graphql.Field{Type: graphql.String},
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

// CreateDemoData creates demo data for playlist resources
func (h *playlistGraphQLHandler) CreateDemoData() interface{} {
	return map[string]interface{}{
		"metadata": map[string]interface{}{
			"name":              "demo-playlist",
			"namespace":         "default",
			"uid":               "demo-playlist-uid",
			"resourceVersion":   "1",
			"generation":        1,
			"creationTimestamp": "2024-01-01T00:00:00Z",
			"labels":            "{}",
			"annotations":       "{}",
		},
		"spec":     `{"title": "Demo Playlist", "description": "This is a demo playlist for testing"}`,
		"uid":      "demo-playlist-uid",
		"name":     "Demo Playlist (no args required)",
		"interval": "30s",
		"items": []map[string]interface{}{
			{
				"id":          1,
				"playlistUid": "demo-playlist-uid",
				"type":        "dashboard_by_uid",
				"value":       "demo-dashboard-1",
				"order":       1,
				"title":       "Demo Dashboard 1",
			},
			{
				"id":          2,
				"playlistUid": "demo-playlist-uid",
				"type":        "dashboard_by_tag",
				"value":       "demo-tag",
				"order":       2,
				"title":       "Demo Dashboard 2",
			},
		},
	}
}
