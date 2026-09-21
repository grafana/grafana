package server

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfig(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	data := `{
		"server":{"certFile":"/tls/tls.crt","keyFile":"/tls/tls.key"},
		"auth":{"signingKeysURL":"https://signer/keys","issuer":"auth","audience":"error-tracking.grafana.app"},
		"audit":{"policyFile":"/audit/policy.yaml","logPath":"-"}
	}`
	if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
		t.Fatal(err)
	}

	config, err := LoadConfig(path)
	if err != nil {
		t.Fatal(err)
	}
	if config.Server.BindAddress != "0.0.0.0" || config.Server.SecurePort != 6443 || config.Database.MaxConnections != 4 {
		t.Fatalf("unexpected defaults: %+v", config)
	}

	t.Setenv("ERROR_TRACKING_DATABASE_MAX_CONNS", "8")
	config, err = LoadConfig(path)
	if err != nil {
		t.Fatal(err)
	}
	if config.Database.MaxConnections != 8 {
		t.Fatalf("max connections = %d, want 8", config.Database.MaxConnections)
	}
}

func TestLoadConfigRejectsUnknownField(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte(`{"unknown":true}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadConfig(path); err == nil {
		t.Fatal("expected unknown field to be rejected")
	}
}
