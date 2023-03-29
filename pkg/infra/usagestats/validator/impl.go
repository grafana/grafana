package validator

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type UsageStatsValidator struct {
	pluginStore plugins.Store
}

func ProvideService(pluginStore plugins.Store) (Service, error) {
	s := &UsageStatsValidator{
		pluginStore: pluginStore,
	}

	return s, nil
}

func (uss *UsageStatsValidator) ShouldBeReported(ctx context.Context, dsType string) bool {
	ds, exists := uss.pluginStore.Plugin(ctx, dsType)
	if !exists {
		return false
	}

	return ds.Signature.IsValid() || ds.Signature.IsInternal()
}
