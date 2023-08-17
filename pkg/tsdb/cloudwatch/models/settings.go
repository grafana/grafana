package models

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type Duration struct {
	time.Duration
}
type CloudWatchSettings struct {
	awsds.AWSDatasourceSettings
	Namespace               string   `json:"customMetricsNamespaces"`
	SecureSocksProxyEnabled bool     `json:"enableSecureSocksProxy"` // this can be removed when https://github.com/grafana/grafana/issues/39089 is implemented
	LogsTimeout             Duration `json:"logsTimeout"`
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

	// logs timeout default is 30 minutes, the same as timeout in frontend logs query
	// note: for alerting queries, the context will be cancelled before that unless evaluation_timeout_seconds in defaults.ini is increased (default: 30s)
	if instance.LogsTimeout.Duration == 0 {
		instance.LogsTimeout = Duration{30 * time.Minute}
	}

	instance.AccessKey = config.DecryptedSecureJSONData["accessKey"]
	instance.SecretKey = config.DecryptedSecureJSONData["secretKey"]

	return instance, nil
}

func (duration *Duration) UnmarshalJSON(b []byte) error {
	var unmarshalledJson interface{}

	err := json.Unmarshal(b, &unmarshalledJson)
	if err != nil {
		return err
	}

	switch value := unmarshalledJson.(type) {
	case float64:
		*duration = Duration{time.Duration(value)}
	case string:
		dur, err := time.ParseDuration(value)
		if err != nil {
			return err
		}
		*duration = Duration{dur}
	default:
		return fmt.Errorf("invalid duration: %#v", unmarshalledJson)
	}

	return nil
}
