package bundleregistry

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/supportbundles"
)

func TestService_RegisterSupportItemCollector(t *testing.T) {
	s := ProvideService()
	collector := supportbundles.Collector{
		UID:               "test",
		DisplayName:       "test",
		Description:       "test",
		IncludedByDefault: true,
		Default:           true,
		Fn: func(context.Context) (*supportbundles.SupportItem, error) {
			return nil, nil
		},
	}

	t.Run("should register collector", func(t *testing.T) {
		s.RegisterSupportItemCollector(collector)
		require.Len(t, s.collectors, 1)
		require.Len(t, s.Collectors(), 1)
	})

	t.Run("should not register collector with same UID", func(t *testing.T) {
		s.RegisterSupportItemCollector(collector)
		require.Len(t, s.collectors, 1)
		require.Len(t, s.Collectors(), 1)
	})
}
