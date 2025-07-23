package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/grafana/grafana-app-sdk/simple"
)

const (
	ConnTypeGRPC = "grpc"
	ConnTypeHTTP = "http"
)

type Config struct {
	OTelConfig    simple.OpenTelemetryConfig
	WebhookServer WebhookServerConfig
}

type WebhookServerConfig struct {
	Port        int
	TLSCertPath string
	TLSKeyPath  string
}

func LoadConfigFromEnv() (*Config, error) {
	cfg := Config{}
	cfg.OTelConfig.ServiceName = os.Getenv("OTEL_SERVICE_NAME")
	switch strings.ToLower(os.Getenv("OTEL_CONN_TYPE")) {
	case ConnTypeGRPC:
		cfg.OTelConfig.ConnType = ConnTypeGRPC
	case ConnTypeHTTP:
		cfg.OTelConfig.ConnType = ConnTypeHTTP
	case "":
		// Default
		cfg.OTelConfig.ConnType = ConnTypeHTTP
	default:
		return nil, fmt.Errorf("unknown OTEL_CONN_TYPE '%s'", os.Getenv("OTEL_CONN_TYPE"))
	}
	cfg.OTelConfig.Host = os.Getenv("OTEL_HOST")
	portStr := os.Getenv("OTEL_PORT")
	if portStr == "" {
		if cfg.OTelConfig.ConnType == ConnTypeGRPC {
			// Default OTel GRPC port
			cfg.OTelConfig.Port = 4317
		} else {
			// Default OTel HTTP port
			cfg.OTelConfig.Port = 4318
		}
	} else {
		var err error
		cfg.OTelConfig.Port, err = strconv.Atoi(portStr)
		if err != nil {
			return nil, fmt.Errorf("invalid OTEL_PORT '%s': %w", portStr, err)
		}
	}

	whPortStr := os.Getenv("WEBHOOK_PORT")
	if whPortStr == "" {
		cfg.WebhookServer.Port = 8443
	} else {
		var err error
		cfg.WebhookServer.Port, err = strconv.Atoi(whPortStr)
		if err != nil {
			return nil, fmt.Errorf("invalid WEBHOOK_PORT '%s': %w", whPortStr, err)
		}
	}

	cfg.WebhookServer.TLSCertPath = os.Getenv("WEBHOOK_CERT_PATH")
	cfg.WebhookServer.TLSKeyPath = os.Getenv("WEBHOOK_KEY_PATH")

	return &cfg, nil
}
