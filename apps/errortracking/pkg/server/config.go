package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/grafana/grafana/apps/errortracking/pkg/storage"
)

const Audience = "error-tracking.grafana.app"

type Config struct {
	Server struct {
		BindAddress string `json:"bindAddress"`
		SecurePort  int    `json:"securePort"`
		CertFile    string `json:"certFile"`
		KeyFile     string `json:"keyFile"`
	} `json:"server"`
	Auth struct {
		SigningKeysURL string `json:"signingKeysURL"`
		Issuer         string `json:"issuer"`
		Audience       string `json:"audience"`
	} `json:"auth"`
	Database struct {
		MaxConnections int32 `json:"maxConnections"`
	} `json:"database"`
	Audit struct {
		PolicyFile string `json:"policyFile"`
		LogPath    string `json:"logPath"`
	} `json:"audit"`
}

func LoadConfig(path string) (Config, error) {
	config := Config{}
	config.Server.BindAddress = "0.0.0.0"
	config.Server.SecurePort = 6443
	config.Auth.Audience = Audience
	config.Database.MaxConnections = storage.DefaultMaxConns

	// The operator supplies this path explicitly through --config.
	data, err := os.ReadFile(path) //nolint:gosec
	if err != nil {
		return Config{}, fmt.Errorf("read config: %w", err)
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&config); err != nil {
		return Config{}, fmt.Errorf("decode config: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return Config{}, fmt.Errorf("decode config: expected one JSON object")
	}
	if raw := strings.TrimSpace(os.Getenv("ERROR_TRACKING_DATABASE_MAX_CONNS")); raw != "" {
		value, err := strconv.ParseInt(raw, 10, 32)
		if err != nil {
			return Config{}, fmt.Errorf("ERROR_TRACKING_DATABASE_MAX_CONNS must be an integer")
		}
		config.Database.MaxConnections = int32(value)
	}
	if err := config.Validate(); err != nil {
		return Config{}, err
	}
	return config, nil
}

func (c Config) Validate() error {
	switch {
	case c.Server.BindAddress == "":
		return fmt.Errorf("server.bindAddress is required")
	case c.Server.SecurePort < 1 || c.Server.SecurePort > 65535:
		return fmt.Errorf("server.securePort must be between 1 and 65535")
	case c.Server.CertFile == "" || c.Server.KeyFile == "":
		return fmt.Errorf("server.certFile and server.keyFile are required")
	case c.Auth.SigningKeysURL == "":
		return fmt.Errorf("auth.signingKeysURL is required")
	case c.Auth.Issuer == "":
		return fmt.Errorf("auth.issuer is required")
	case c.Auth.Audience != Audience:
		return fmt.Errorf("auth.audience must be %q", Audience)
	case c.Database.MaxConnections < 1:
		return fmt.Errorf("database.maxConnections must be positive")
	case c.Audit.PolicyFile == "" || c.Audit.LogPath == "":
		return fmt.Errorf("audit.policyFile and audit.logPath are required")
	}
	return nil
}
