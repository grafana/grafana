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

	// Create view mode type
	viewModeType := graphql.NewObject(graphql.ObjectConfig{
		Name: "InvestigationViewMode",
		Fields: graphql.Fields{
			"mode":         &graphql.Field{Type: graphql.String},
			"showComments": &graphql.Field{Type: graphql.Boolean},
			"showTooltips": &graphql.Field{Type: graphql.Boolean},
		},
	})

	// Create collectable summary type (simplified version)
	collectableSummaryType := graphql.NewObject(graphql.ObjectConfig{
		Name: "InvestigationCollectableSummary",
		Fields: graphql.Fields{
			"type":  &graphql.Field{Type: graphql.String},
			"title": &graphql.Field{Type: graphql.String},
			"uid":   &graphql.Field{Type: graphql.String},
			"order": &graphql.Field{Type: graphql.Int},
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
		"viewMode":              &graphql.Field{Type: viewModeType},
		"collectableSummaries":  &graphql.Field{Type: graphql.NewList(collectableSummaryType)},
	}
}

// ConvertResourceToGraphQL converts an investigation resource to GraphQL format
func (h *investigationGraphQLHandler) ConvertResourceToGraphQL(obj resource.Object) map[string]interface{} {
	metadata := obj.GetStaticMetadata()
	spec := obj.GetSpec()

	result := map[string]interface{}{
		"title":                 metadata.Name,
		"hasCustomName":         false,
		"isFavorite":            false,
		"overviewNote":          "",
		"overviewNoteUpdatedAt": "",
		"createdByProfile":      nil,
		"viewMode":              nil,
		"collectableSummaries":  []interface{}{},
	}

	// Try to extract investigation-specific data from spec
	if spec != nil {
		// Use reflection to extract fields from typed struct
		specValue := reflect.ValueOf(spec)
		if specValue.Kind() == reflect.Ptr {
			specValue = specValue.Elem()
		}

		if specValue.Kind() == reflect.Struct {
			// Try to find Title field
			if titleField := specValue.FieldByName("Title"); titleField.IsValid() && titleField.CanInterface() {
				if titleStr, ok := titleField.Interface().(string); ok && titleStr != "" {
					result["title"] = titleStr
				}
			}

			// Try to find HasCustomName field
			if hasCustomNameField := specValue.FieldByName("HasCustomName"); hasCustomNameField.IsValid() && hasCustomNameField.CanInterface() {
				if hasCustomName, ok := hasCustomNameField.Interface().(bool); ok {
					result["hasCustomName"] = hasCustomName
				}
			}

			// Try to find IsFavorite field
			if isFavoriteField := specValue.FieldByName("IsFavorite"); isFavoriteField.IsValid() && isFavoriteField.CanInterface() {
				if isFavorite, ok := isFavoriteField.Interface().(bool); ok {
					result["isFavorite"] = isFavorite
				}
			}

			// Try to find OverviewNote field
			if overviewNoteField := specValue.FieldByName("OverviewNote"); overviewNoteField.IsValid() && overviewNoteField.CanInterface() {
				if overviewNote, ok := overviewNoteField.Interface().(string); ok {
					result["overviewNote"] = overviewNote
				}
			}

			// Try to find OverviewNoteUpdatedAt field
			if overviewNoteUpdatedAtField := specValue.FieldByName("OverviewNoteUpdatedAt"); overviewNoteUpdatedAtField.IsValid() && overviewNoteUpdatedAtField.CanInterface() {
				if overviewNoteUpdatedAt, ok := overviewNoteUpdatedAtField.Interface().(string); ok {
					result["overviewNoteUpdatedAt"] = overviewNoteUpdatedAt
				}
			}

			// Try to find CreatedByProfile field
			if createdByProfileField := specValue.FieldByName("CreatedByProfile"); createdByProfileField.IsValid() && createdByProfileField.CanInterface() {
				profile := createdByProfileField.Interface()
				if profileValue := reflect.ValueOf(profile); profileValue.Kind() == reflect.Struct {
					profileMap := map[string]interface{}{}
					if uidField := profileValue.FieldByName("Uid"); uidField.IsValid() && uidField.CanInterface() {
						profileMap["uid"] = fmt.Sprintf("%v", uidField.Interface())
					}
					if nameField := profileValue.FieldByName("Name"); nameField.IsValid() && nameField.CanInterface() {
						profileMap["name"] = fmt.Sprintf("%v", nameField.Interface())
					}
					if gravatarUrlField := profileValue.FieldByName("GravatarUrl"); gravatarUrlField.IsValid() && gravatarUrlField.CanInterface() {
						profileMap["gravatarUrl"] = fmt.Sprintf("%v", gravatarUrlField.Interface())
					}
					result["createdByProfile"] = profileMap
				}
			}

			// Try to find ViewMode field
			if viewModeField := specValue.FieldByName("ViewMode"); viewModeField.IsValid() && viewModeField.CanInterface() {
				viewMode := viewModeField.Interface()
				if viewModeValue := reflect.ValueOf(viewMode); viewModeValue.Kind() == reflect.Struct {
					viewModeMap := map[string]interface{}{}
					if modeField := viewModeValue.FieldByName("Mode"); modeField.IsValid() && modeField.CanInterface() {
						viewModeMap["mode"] = fmt.Sprintf("%v", modeField.Interface())
					}
					if showCommentsField := viewModeValue.FieldByName("ShowComments"); showCommentsField.IsValid() && showCommentsField.CanInterface() {
						if showComments, ok := showCommentsField.Interface().(bool); ok {
							viewModeMap["showComments"] = showComments
						}
					}
					if showTooltipsField := viewModeValue.FieldByName("ShowTooltips"); showTooltipsField.IsValid() && showTooltipsField.CanInterface() {
						if showTooltips, ok := showTooltipsField.Interface().(bool); ok {
							viewModeMap["showTooltips"] = showTooltips
						}
					}
					result["viewMode"] = viewModeMap
				}
			}

			// Try to find Collectables field and create summaries
			if collectablesField := specValue.FieldByName("Collectables"); collectablesField.IsValid() && collectablesField.CanInterface() {
				collectables := collectablesField.Interface()
				if collectablesSlice := reflect.ValueOf(collectables); collectablesSlice.Kind() == reflect.Slice {
					summaries := make([]interface{}, collectablesSlice.Len())
					for i := 0; i < collectablesSlice.Len(); i++ {
						collectable := collectablesSlice.Index(i).Interface()
						collectableValue := reflect.ValueOf(collectable)
						if collectableValue.Kind() == reflect.Ptr {
							collectableValue = collectableValue.Elem()
						}

						summary := map[string]interface{}{
							"type":  "unknown",
							"title": fmt.Sprintf("Collectable %d", i+1),
							"uid":   fmt.Sprintf("collectable-%d", i),
							"order": i + 1,
						}

						if collectableValue.Kind() == reflect.Struct {
							// Try to extract type and other fields from collectable
							if typeField := collectableValue.FieldByName("Type"); typeField.IsValid() && typeField.CanInterface() {
								summary["type"] = fmt.Sprintf("%v", typeField.Interface())
							}
							if titleField := collectableValue.FieldByName("Title"); titleField.IsValid() && titleField.CanInterface() {
								summary["title"] = fmt.Sprintf("%v", titleField.Interface())
							}
							if uidField := collectableValue.FieldByName("Uid"); uidField.IsValid() && uidField.CanInterface() {
								summary["uid"] = fmt.Sprintf("%v", uidField.Interface())
							}
						}

						summaries[i] = summary
					}
					result["collectableSummaries"] = summaries
				}
			}
		}
	}

	return result
}

// CreateDemoData creates demo data for investigation resources
func (h *investigationGraphQLHandler) CreateDemoData() interface{} {
	// Return nil to disable demo data creation
	return nil
}

// investigationIndexGraphQLHandler implements ResourceGraphQLHandler for investigation index resources
type investigationIndexGraphQLHandler struct{}

// Ensure investigationIndexGraphQLHandler implements ResourceGraphQLHandler
var _ graphqlsubgraph.ResourceGraphQLHandler = (*investigationIndexGraphQLHandler)(nil)

// NewInvestigationIndexGraphQLHandler creates a new investigation index GraphQL handler
func NewInvestigationIndexGraphQLHandler() graphqlsubgraph.ResourceGraphQLHandler {
	return &investigationIndexGraphQLHandler{}
}

// GetResourceKind returns the investigation index resource kind
func (h *investigationIndexGraphQLHandler) GetResourceKind() resource.Kind {
	return investigationv0alpha1.InvestigationIndexKind()
}

// GetGraphQLFields returns investigation index-specific GraphQL fields
func (h *investigationIndexGraphQLHandler) GetGraphQLFields() graphql.Fields {
	// Return investigation index-specific fields
	return graphql.Fields{
		"investigations": &graphql.Field{Type: graphql.NewList(graphql.String)},
		"totalCount":     &graphql.Field{Type: graphql.Int},
	}
}

// ConvertResourceToGraphQL converts an investigation index resource to GraphQL format
func (h *investigationIndexGraphQLHandler) ConvertResourceToGraphQL(obj resource.Object) map[string]interface{} {
	result := map[string]interface{}{
		"investigations": []interface{}{},
		"totalCount":     0,
	}

	// The investigation index would typically contain references to investigations
	// For now, return empty structure
	return result
}

// CreateDemoData creates demo data for investigation index resources
func (h *investigationIndexGraphQLHandler) CreateDemoData() interface{} {
	// Return nil to disable demo data creation
	return nil
}
