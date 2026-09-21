// Package errortracking adapts Grafana configuration to the app-owned store.
package errortracking

import (
	"fmt"
	"strconv"
	"strings"

	appstorage "github.com/grafana/grafana/apps/errortracking/pkg/storage"
	"github.com/grafana/grafana/pkg/setting"
)

type Store = appstorage.Store

const defaultMaxConns = appstorage.DefaultMaxConns

func ProvideStore(cfg *setting.Cfg) (*Store, error) {
	runtimeConfig := cfg.Raw.Section("grafana-apiserver").Key("runtime_config").String()
	for value := range strings.SplitSeq(runtimeConfig, ",") {
		if strings.TrimSpace(value) != "error-tracking.grafana.app/v0alpha1=true" {
			continue
		}
		maxConns, err := configuredMaxConns(cfg)
		if err != nil {
			return nil, err
		}
		databaseURL := strings.TrimSpace(cfg.Raw.Section("error_tracking").Key("database_url").String())
		if databaseURL == "" {
			return nil, fmt.Errorf("error tracking database URL is required")
		}
		return appstorage.NewStore(databaseURL, maxConns)
	}
	return appstorage.NewDisabledStore(), nil
}

func NewStore(connectionString string, maxConns int32) (*Store, error) {
	return appstorage.NewStore(connectionString, maxConns)
}

func configuredMaxConns(cfg *setting.Cfg) (int32, error) {
	raw := strings.TrimSpace(cfg.Raw.Section("error_tracking").Key("max_conns").String())
	if raw == "" {
		return defaultMaxConns, nil
	}
	value, err := strconv.ParseInt(raw, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("error tracking database max_conns must be an integer")
	}
	if value < 1 {
		return 0, fmt.Errorf("error tracking database max_conns must be positive")
	}
	return int32(value), nil
}
