package lokiconfig

import (
	"fmt"
	"net/url"

	"github.com/grafana/alerting/lokiclient"
	"github.com/grafana/grafana/pkg/setting"
)

func NewLokiConfig(cfg setting.UnifiedAlertingLokiSettings) (lokiclient.LokiConfig, error) {
	read, write := cfg.LokiReadURL, cfg.LokiWriteURL
	if read == "" {
		read = cfg.LokiRemoteURL
	}
	if write == "" {
		write = cfg.LokiRemoteURL
	}

	if read == "" {
		return lokiclient.LokiConfig{}, fmt.Errorf("either read path URL or remote Loki URL must be provided")
	}
	if write == "" {
		return lokiclient.LokiConfig{}, fmt.Errorf("either write path URL or remote Loki URL must be provided")
	}

	readURL, err := url.Parse(read)
	if err != nil {
		return lokiclient.LokiConfig{}, fmt.Errorf("failed to parse loki remote read URL: %w", err)
	}
	writeURL, err := url.Parse(write)
	if err != nil {
		return lokiclient.LokiConfig{}, fmt.Errorf("failed to parse loki remote write URL: %w", err)
	}

	return lokiclient.LokiConfig{
		ReadPathURL:       readURL,
		WritePathURL:      writeURL,
		BasicAuthUser:     cfg.LokiBasicAuthUsername,
		BasicAuthPassword: cfg.LokiBasicAuthPassword,
		TenantID:          cfg.LokiTenantID,
		ExternalLabels:    cfg.ExternalLabels,
		MaxQueryLength:    cfg.LokiMaxQueryLength,
		MaxQuerySize:      cfg.LokiMaxQuerySize,
		// Snappy-compressed protobuf is the default, same goes for Promtail.
		Encoder: lokiclient.SnappyProtoEncoder{},
	}, nil
}
