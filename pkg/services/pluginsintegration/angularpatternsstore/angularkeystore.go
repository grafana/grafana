package angularpatternsstore

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularinspector"
)

const (
	keyPatterns    = "angular_patterns"
	keyLastUpdated = "last_updated"
)

type Service struct {
	kv *kvstore.NamespacedKVStore
}

var _ plugins.AngularPatternsStore = (*Service)(nil)

func ProvideService(kv kvstore.KVStore) *Service {
	return &Service{
		kv: kvstore.WithNamespace(kv, 0, "plugin.angularpatterns"),
	}
}

func (s *Service) Get(ctx context.Context) (angularinspector.GCOMPatterns, error) {
	data, ok, err := s.kv.Get(ctx, keyPatterns)
	if err != nil {
		return nil, fmt.Errorf("kv get: %w", err)
	}
	if !ok {
		return nil, nil
	}
	var out angularinspector.GCOMPatterns
	if err := json.Unmarshal([]byte(data), &out); err != nil {
		// Ignore decode errors, so we can change the format in future versions
		// and keep backwards/forwards compatibility
		return nil, nil
	}
	return out, nil
}

func (s *Service) Set(ctx context.Context, patterns angularinspector.GCOMPatterns) error {
	b, err := json.Marshal(patterns)
	if err != nil {
		return fmt.Errorf("json marshal: %w", err)
	}
	if err := s.kv.Set(ctx, keyPatterns, string(b)); err != nil {
		return fmt.Errorf("kv set: %w", err)
	}
	if err := s.kv.Set(ctx, keyLastUpdated, time.Now().Format(time.RFC3339)); err != nil {
		return fmt.Errorf("kv last updated set: %w", err)
	}
	return nil
}

func (s *Service) GetLastUpdated(ctx context.Context) (time.Time, error) {
	v, ok, err := s.kv.Get(ctx, keyLastUpdated)
	if err != nil {
		return time.Time{}, fmt.Errorf("kv get: %w", err)
	}
	if !ok {
		return time.Time{}, nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		// Ignore decode errors, so we can change the format in future versions
		// and keep backwards/forwards compatibility
		return time.Time{}, nil
	}
	return t, nil
}
