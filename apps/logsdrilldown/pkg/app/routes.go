package app

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-app-sdk/app"
)

// GetDefaultFieldsHandler handles requests for the GET /defaultFields cluster-scoped resource route.
// It returns only the defaultFields from LogsDrilldown resources, accessible to all users.
func GetDefaultFieldsHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	// Get the app instance from context to access the informer/client
	// For now, return a simple response structure
	// In a real implementation, you would query the LogsDrilldown resources and extract defaultFields
	
	// This is a placeholder - you'll need to access your storage/informer to get actual data
	// For example, if you have access to the app client:
	// list, err := appClient.List(ctx, &v1alpha1.LogsDrilldownList{})
	// Then extract defaultFields from the first item (or aggregate them)
	
	response := struct {
		DefaultFields []string `json:"defaultFields"`
	}{
		DefaultFields: []string{"time", "body", "level"}, // Default placeholder - should come from actual resource
	}

	return json.NewEncoder(writer).Encode(response)
}

// UpdateDefaultFieldsHandler handles requests for the PUT /defaultFields cluster-scoped resource route.
// It updates the defaultFields in LogsDrilldown resources.
func UpdateDefaultFieldsHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	// Parse the request body
	var requestBody struct {
		DefaultFields []string `json:"defaultFields"`
	}
	
	if err := json.NewDecoder(request.Body).Decode(&requestBody); err != nil {
		return err
	}

	// TODO: Update the LogsDrilldown resource with the new defaultFields
	// This is a placeholder - you'll need to access your storage/client to update the actual resource
	// For example:
	// 1. Get the existing LogsDrilldown resource
	// 2. Update spec.defaultFields with requestBody.DefaultFields
	// 3. Save the updated resource
	
	// Return the updated fields
	response := struct {
		DefaultFields []string `json:"defaultFields"`
	}{
		DefaultFields: requestBody.DefaultFields,
	}

	return json.NewEncoder(writer).Encode(response)
}

