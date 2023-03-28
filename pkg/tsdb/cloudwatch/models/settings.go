package models

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type CloudWatchSettings struct {
	awsds.AWSDatasourceSettings
	Namespace string `json:"customMetricsNamespaces"`
}

func LoadCloudWatchSettings(config backend.DataSourceInstanceSettings) (CloudWatchSettings, error) {
	instance := CloudWatchSettings{}
	if config.JSONData != nil && len(config.JSONData) > 1 {
		if err := json.Unmarshal(config.JSONData, &instance); err != nil {
			return CloudWatchSettings{}, fmt.Errorf("could not unmarshal DatasourceSettings json: %w", err)
		}
	}

	if instance.Region == "default" || instance.Region == "" {
		instance.Region = instance.DefaultRegion
	}

	if instance.Profile == "" {
		instance.Profile = config.Database
	}

	instance.AccessKey = config.DecryptedSecureJSONData["accessKey"]
	instance.SecretKey = config.DecryptedSecureJSONData["secretKey"]

	return instance, nil
}
