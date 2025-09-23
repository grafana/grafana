package validator

import (
	"context"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

type UsageStatsValidator struct {
	pluginStore pluginstore.Store
}

func ProvideService(pluginStore pluginstore.Store) (Service, error) {
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
