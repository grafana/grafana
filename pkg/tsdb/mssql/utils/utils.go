package utils

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-azure-sdk-go/azcredentials"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// GetJsonData just gets the json in easier to work with type. It's used on multiple places which isn't super effective
// but only when creating a client which should not happen often anyway.
func getJsonData(settings backend.DataSourceInstanceSettings) (map[string]interface{}, error) {
	var jsonData map[string]interface{}
	err := json.Unmarshal(settings.JSONData, &jsonData)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling JSONData: %w", err)
	}
	return jsonData, nil
}

func GetAzureCredentials(settings backend.DataSourceInstanceSettings) (azcredentials.AzureCredentials, error) {
	jsonData, err := getJsonData(settings)
	if err != nil {
		return nil, err
	}
	return azcredentials.FromDatasourceData(jsonData, settings.DecryptedSecureJSONData)
}
