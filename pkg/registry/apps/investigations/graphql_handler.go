package investigations

import (
	"fmt"
	"reflect"

	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
	"github.com/grafana/grafana-app-sdk/resource"
	investigationv0alpha1 "github.com/grafana/grafana/apps/investigations/pkg/apis/investigations/v0alpha1"
	"github.com/graphql-go/graphql"
)

// investigationGraphQLHandler implements ResourceGraphQLHandler for investigation resources
type investigationGraphQLHandler struct{}

// Ensure investigationGraphQLHandler implements ResourceGraphQLHandler
var _ graphqlsubgraph.ResourceGraphQLHandler = (*investigationGraphQLHandler)(nil)

// NewInvestigationGraphQLHandler creates a new investigation GraphQL handler
func NewInvestigationGraphQLHandler() graphqlsubgraph.ResourceGraphQLHandler {
	return &investigationGraphQLHandler{}
}

// GetResourceKind returns the investigation resource kind
func (h *investigationGraphQLHandler) GetResourceKind() resource.Kind {
	return investigationv0alpha1.InvestigationKind()
}

// GetGraphQLFields returns investigation-specific GraphQL fields
func (h *investigationGraphQLHandler) GetGraphQLFields() graphql.Fields {
	// Create person type for created by profile
	personType := graphql.NewObject(graphql.ObjectConfig{
		Name: "InvestigationPerson",
		Fields: graphql.Fields{
			"uid":         &graphql.Field{Type: graphql.String},
			"name":        &graphql.Field{Type: graphql.String},
			"gravatarUrl": &graphql.Field{Type: graphql.String},
		},
	})

	// Create time range type
	timeRangeType := graphql.NewObject(graphql.ObjectConfig{
		Name: "InvestigationTimeRange",
		Fields: graphql.Fields{
			"from": &graphql.Field{Type: graphql.String},
			"to":   &graphql.Field{Type: graphql.String},
		},
	})

	// Create datasource reference type
	datasourceRefType := graphql.NewObject(graphql.ObjectConfig{
		Name: "InvestigationDatasourceRef",
		Fields: graphql.Fields{
			"uid": &graphql.Field{Type: graphql.String},
		},
	})

	// Create collectable type
	collectableType := graphql.NewObject(graphql.ObjectConfig{
		Name: "InvestigationCollectable",
		Fields: graphql.Fields{
			"id":            &graphql.Field{Type: graphql.String},
			"createdAt":     &graphql.Field{Type: graphql.String},
			"title":         &graphql.Field{Type: graphql.String},
			"origin":        &graphql.Field{Type: graphql.String},
			"type":          &graphql.Field{Type: graphql.String},
			"queries":       &graphql.Field{Type: graphql.NewList(graphql.String)},
			"timeRange":     &graphql.Field{Type: timeRangeType},
			"datasource":    &graphql.Field{Type: datasourceRefType},
			"url":           &graphql.Field{Type: graphql.String},
			"logoPath":      &graphql.Field{Type: graphql.String},
			"note":          &graphql.Field{Type: graphql.String},
			"noteUpdatedAt": &graphql.Field{Type: graphql.String},
			"fieldConfig":   &graphql.Field{Type: graphql.String},
		},
	})

	// Create view mode type
	viewModeType := graphql.NewObject(graphql.ObjectConfig{
		Name: "InvestigationViewMode",
		Fields: graphql.Fields{
			"mode":         &graphql.Field{Type: graphql.String},
			"showComments": &graphql.Field{Type: graphql.Boolean},
			"showTooltips": &graphql.Field{Type: graphql.Boolean},
		},
	})

	// Return investigation-specific fields that will be added to the base resource type
	return graphql.Fields{
		"title":                 &graphql.Field{Type: graphql.String},
		"createdByProfile":      &graphql.Field{Type: personType},
		"hasCustomName":         &graphql.Field{Type: graphql.Boolean},
		"isFavorite":            &graphql.Field{Type: graphql.Boolean},
		"overviewNote":          &graphql.Field{Type: graphql.String},
		"overviewNoteUpdatedAt": &graphql.Field{Type: graphql.String},
		"collectables":          &graphql.Field{Type: graphql.NewList(collectableType)},
		"viewMode":              &graphql.Field{Type: viewModeType},
	}
}

// ConvertResourceToGraphQL converts an investigation resource to GraphQL format
func (h *investigationGraphQLHandler) ConvertResourceToGraphQL(obj resource.Object) map[string]interface{} {
	metadata := obj.GetStaticMetadata()
	spec := obj.GetSpec()

	result := map[string]interface{}{
		"title":                 metadata.Name, // fallback to name
		"createdByProfile":      map[string]interface{}{"uid": "", "name": "Unknown", "gravatarUrl": ""},
		"hasCustomName":         false,
		"isFavorite":            false,
		"overviewNote":          "",
		"overviewNoteUpdatedAt": "",
		"collectables":          []interface{}{},
		"viewMode":              map[string]interface{}{"mode": "full", "showComments": true, "showTooltips": true},
	}

	// Try to extract investigation-specific data from spec
	if spec != nil {
		// Use reflection to extract fields from typed struct (this is the primary path)
		specValue := reflect.ValueOf(spec)
		if specValue.Kind() == reflect.Ptr {
			specValue = specValue.Elem()
		}

		if specValue.Kind() == reflect.Struct {
			// Extract Title field
			if titleField := specValue.FieldByName("Title"); titleField.IsValid() && titleField.CanInterface() {
				if titleStr, ok := titleField.Interface().(string); ok && titleStr != "" {
					result["title"] = titleStr
				}
			}

			// Extract CreatedByProfile field
			if createdByField := specValue.FieldByName("CreatedByProfile"); createdByField.IsValid() && createdByField.CanInterface() {
				profileValue := reflect.ValueOf(createdByField.Interface())
				if profileValue.Kind() == reflect.Ptr {
					profileValue = profileValue.Elem()
				}
				if profileValue.Kind() == reflect.Struct {
					profile := map[string]interface{}{"uid": "", "name": "Unknown", "gravatarUrl": ""}
					if uidField := profileValue.FieldByName("Uid"); uidField.IsValid() && uidField.CanInterface() {
						profile["uid"] = fmt.Sprintf("%v", uidField.Interface())
					}
					if nameField := profileValue.FieldByName("Name"); nameField.IsValid() && nameField.CanInterface() {
						profile["name"] = fmt.Sprintf("%v", nameField.Interface())
					}
					if gravatarField := profileValue.FieldByName("GravatarUrl"); gravatarField.IsValid() && gravatarField.CanInterface() {
						profile["gravatarUrl"] = fmt.Sprintf("%v", gravatarField.Interface())
					}
					result["createdByProfile"] = profile
				}
			}

			// Extract boolean fields
			if hasCustomNameField := specValue.FieldByName("HasCustomName"); hasCustomNameField.IsValid() && hasCustomNameField.CanInterface() {
				if val, ok := hasCustomNameField.Interface().(bool); ok {
					result["hasCustomName"] = val
				}
			}

			if isFavoriteField := specValue.FieldByName("IsFavorite"); isFavoriteField.IsValid() && isFavoriteField.CanInterface() {
				if val, ok := isFavoriteField.Interface().(bool); ok {
					result["isFavorite"] = val
				}
			}

			// Extract string fields
			if overviewNoteField := specValue.FieldByName("OverviewNote"); overviewNoteField.IsValid() && overviewNoteField.CanInterface() {
				if val, ok := overviewNoteField.Interface().(string); ok {
					result["overviewNote"] = val
				}
			}

			if overviewNoteUpdatedAtField := specValue.FieldByName("OverviewNoteUpdatedAt"); overviewNoteUpdatedAtField.IsValid() && overviewNoteUpdatedAtField.CanInterface() {
				if val, ok := overviewNoteUpdatedAtField.Interface().(string); ok {
					result["overviewNoteUpdatedAt"] = val
				}
			}

			// Extract ViewMode field
			if viewModeField := specValue.FieldByName("ViewMode"); viewModeField.IsValid() && viewModeField.CanInterface() {
				viewModeValue := reflect.ValueOf(viewModeField.Interface())
				if viewModeValue.Kind() == reflect.Ptr {
					viewModeValue = viewModeValue.Elem()
				}
				if viewModeValue.Kind() == reflect.Struct {
					viewMode := map[string]interface{}{"mode": "full", "showComments": true, "showTooltips": true}
					if modeField := viewModeValue.FieldByName("Mode"); modeField.IsValid() && modeField.CanInterface() {
						viewMode["mode"] = fmt.Sprintf("%v", modeField.Interface())
					}
					if showCommentsField := viewModeValue.FieldByName("ShowComments"); showCommentsField.IsValid() && showCommentsField.CanInterface() {
						if val, ok := showCommentsField.Interface().(bool); ok {
							viewMode["showComments"] = val
						}
					}
					if showTooltipsField := viewModeValue.FieldByName("ShowTooltips"); showTooltipsField.IsValid() && showTooltipsField.CanInterface() {
						if val, ok := showTooltipsField.Interface().(bool); ok {
							viewMode["showTooltips"] = val
						}
					}
					result["viewMode"] = viewMode
				}
			}

			// Extract Collectables field
			if collectablesField := specValue.FieldByName("Collectables"); collectablesField.IsValid() && collectablesField.CanInterface() {
				collectablesValue := collectablesField.Interface()

				// Handle slice of collectables
				if collectablesSlice := reflect.ValueOf(collectablesValue); collectablesSlice.Kind() == reflect.Slice {
					graphqlCollectables := make([]interface{}, collectablesSlice.Len())
					for i := 0; i < collectablesSlice.Len(); i++ {
						collectable := collectablesSlice.Index(i).Interface()

						// Try to extract fields from collectable struct
						collectableValue := reflect.ValueOf(collectable)
						if collectableValue.Kind() == reflect.Ptr {
							collectableValue = collectableValue.Elem()
						}

						graphqlCollectable := map[string]interface{}{
							"id":            fmt.Sprintf("collectable-%d", i+1),
							"createdAt":     "2024-01-01T00:00:00Z",
							"title":         fmt.Sprintf("Collectable %d", i+1),
							"origin":        "dashboard",
							"type":          "panel",
							"queries":       []interface{}{},
							"timeRange":     map[string]interface{}{"from": "now-1h", "to": "now"},
							"datasource":    map[string]interface{}{"uid": ""},
							"url":           "",
							"logoPath":      "",
							"note":          "",
							"noteUpdatedAt": "",
							"fieldConfig":   "{}",
						}

						if collectableValue.Kind() == reflect.Struct {
							// Extract all fields from the collectable struct
							collectableFields := []string{
								"Id", "CreatedAt", "Title", "Origin", "Type", "Url", "LogoPath", "Note", "NoteUpdatedAt", "FieldConfig",
							}
							for _, fieldName := range collectableFields {
								if field := collectableValue.FieldByName(fieldName); field.IsValid() && field.CanInterface() {
									val := field.Interface()
									switch fieldName {
									case "Id":
										graphqlCollectable["id"] = fmt.Sprintf("%v", val)
									case "CreatedAt":
										graphqlCollectable["createdAt"] = fmt.Sprintf("%v", val)
									case "Title":
										graphqlCollectable["title"] = fmt.Sprintf("%v", val)
									case "Origin":
										graphqlCollectable["origin"] = fmt.Sprintf("%v", val)
									case "Type":
										graphqlCollectable["type"] = fmt.Sprintf("%v", val)
									case "Url":
										graphqlCollectable["url"] = fmt.Sprintf("%v", val)
									case "LogoPath":
										if val != nil {
											graphqlCollectable["logoPath"] = fmt.Sprintf("%v", val)
										}
									case "Note":
										graphqlCollectable["note"] = fmt.Sprintf("%v", val)
									case "NoteUpdatedAt":
										graphqlCollectable["noteUpdatedAt"] = fmt.Sprintf("%v", val)
									case "FieldConfig":
										graphqlCollectable["fieldConfig"] = fmt.Sprintf("%v", val)
									}
								}
							}

							// Handle Queries field specially (slice)
							if queriesField := collectableValue.FieldByName("Queries"); queriesField.IsValid() && queriesField.CanInterface() {
								if queriesSlice := reflect.ValueOf(queriesField.Interface()); queriesSlice.Kind() == reflect.Slice {
									queries := make([]interface{}, queriesSlice.Len())
									for j := 0; j < queriesSlice.Len(); j++ {
										queries[j] = fmt.Sprintf("%v", queriesSlice.Index(j).Interface())
									}
									graphqlCollectable["queries"] = queries
								}
							}

							// Handle TimeRange field
							if timeRangeField := collectableValue.FieldByName("TimeRange"); timeRangeField.IsValid() && timeRangeField.CanInterface() {
								timeRangeValue := reflect.ValueOf(timeRangeField.Interface())
								if timeRangeValue.Kind() == reflect.Ptr {
									timeRangeValue = timeRangeValue.Elem()
								}
								if timeRangeValue.Kind() == reflect.Struct {
									timeRange := map[string]interface{}{"from": "now-1h", "to": "now"}
									if fromField := timeRangeValue.FieldByName("From"); fromField.IsValid() && fromField.CanInterface() {
										timeRange["from"] = fmt.Sprintf("%v", fromField.Interface())
									}
									if toField := timeRangeValue.FieldByName("To"); toField.IsValid() && toField.CanInterface() {
										timeRange["to"] = fmt.Sprintf("%v", toField.Interface())
									}
									graphqlCollectable["timeRange"] = timeRange
								}
							}

							// Handle Datasource field
							if datasourceField := collectableValue.FieldByName("Datasource"); datasourceField.IsValid() && datasourceField.CanInterface() {
								datasourceValue := reflect.ValueOf(datasourceField.Interface())
								if datasourceValue.Kind() == reflect.Ptr {
									datasourceValue = datasourceValue.Elem()
								}
								if datasourceValue.Kind() == reflect.Struct {
									datasource := map[string]interface{}{"uid": ""}
									if uidField := datasourceValue.FieldByName("Uid"); uidField.IsValid() && uidField.CanInterface() {
										datasource["uid"] = fmt.Sprintf("%v", uidField.Interface())
									}
									graphqlCollectable["datasource"] = datasource
								}
							}
						}

						graphqlCollectables[i] = graphqlCollectable
					}
					result["collectables"] = graphqlCollectables
				}
			}
		} else {
			// Fallback: try as a map (in case it was unmarshaled as JSON)
			if specMap, ok := spec.(map[string]interface{}); ok {
				if title, exists := specMap["title"]; exists {
					result["title"] = title
				}
				if createdByProfile, exists := specMap["createdByProfile"]; exists {
					result["createdByProfile"] = createdByProfile
				}
				if hasCustomName, exists := specMap["hasCustomName"]; exists {
					result["hasCustomName"] = hasCustomName
				}
				if isFavorite, exists := specMap["isFavorite"]; exists {
					result["isFavorite"] = isFavorite
				}
				if overviewNote, exists := specMap["overviewNote"]; exists {
					result["overviewNote"] = overviewNote
				}
				if overviewNoteUpdatedAt, exists := specMap["overviewNoteUpdatedAt"]; exists {
					result["overviewNoteUpdatedAt"] = overviewNoteUpdatedAt
				}
				if viewMode, exists := specMap["viewMode"]; exists {
					result["viewMode"] = viewMode
				}
				if collectables, exists := specMap["collectables"]; exists {
					result["collectables"] = collectables
				}
			}
		}
	}

	return result
}

// CreateDemoData creates demo data for investigation resources
func (h *investigationGraphQLHandler) CreateDemoData() interface{} {
	return map[string]interface{}{
		"metadata": map[string]interface{}{
			"name":              "demo-investigation",
			"namespace":         "default",
			"uid":               "demo-investigation-uid",
			"resourceVersion":   "1",
			"generation":        1,
			"creationTimestamp": "2024-01-01T00:00:00Z",
			"labels":            "{}",
			"annotations":       "{}",
		},
		"spec":  `{"title": "Demo Investigation", "overviewNote": "This is a demo investigation for testing"}`,
		"title": "Demo Investigation (no args required)",
		"createdByProfile": map[string]interface{}{
			"uid":         "demo-user-uid",
			"name":        "Demo User",
			"gravatarUrl": "https://www.gravatar.com/avatar/demo",
		},
		"hasCustomName":         true,
		"isFavorite":            false,
		"overviewNote":          "This is a comprehensive investigation into system performance issues",
		"overviewNoteUpdatedAt": "2024-01-01T12:00:00Z",
		"viewMode": map[string]interface{}{
			"mode":         "full",
			"showComments": true,
			"showTooltips": true,
		},
		"collectables": []map[string]interface{}{
			{
				"id":        "collectable-1",
				"createdAt": "2024-01-01T10:00:00Z",
				"title":     "CPU Usage Panel",
				"origin":    "dashboard",
				"type":      "panel",
				"queries":   []string{"cpu_usage_percent", "system_load"},
				"timeRange": map[string]interface{}{
					"from": "now-1h",
					"to":   "now",
				},
				"datasource": map[string]interface{}{
					"uid": "prometheus-uid",
				},
				"url":           "/d/dashboard-uid/system-metrics?panelId=1",
				"logoPath":      "/public/img/prometheus_logo.svg",
				"note":          "High CPU usage detected during peak hours",
				"noteUpdatedAt": "2024-01-01T11:00:00Z",
				"fieldConfig":   `{"displayMode": "table", "showHeader": true}`,
			},
			{
				"id":        "collectable-2",
				"createdAt": "2024-01-01T10:30:00Z",
				"title":     "Memory Usage Trend",
				"origin":    "explore",
				"type":      "timeseries",
				"queries":   []string{"memory_usage_bytes"},
				"timeRange": map[string]interface{}{
					"from": "now-24h",
					"to":   "now",
				},
				"datasource": map[string]interface{}{
					"uid": "prometheus-uid",
				},
				"url":           "/explore?left=%5B%22now-24h%22%2C%22now%22%2C%22Prometheus%22%2C%7B%22expr%22%3A%22memory_usage_bytes%22%7D%5D",
				"logoPath":      "/public/img/prometheus_logo.svg",
				"note":          "Memory leak suspected in service X",
				"noteUpdatedAt": "2024-01-01T11:30:00Z",
				"fieldConfig":   `{"unit": "bytes", "min": 0}`,
			},
		},
	}
}
