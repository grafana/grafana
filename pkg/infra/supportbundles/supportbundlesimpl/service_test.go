package supportbundlesimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/supportbundles"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestService_RegisterSupportItemCollector(t *testing.T) {
	s := &Service{
		cfg:            &setting.Cfg{},
		store:          nil,
		pluginStore:    nil,
		pluginSettings: nil,
		accessControl:  nil,
		features:       nil,
		log:            log.NewNopLogger(),
		collectors:     map[string]supportbundles.Collector{},
	}
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
	})

	t.Run("should not register collector with same UID", func(t *testing.T) {
		s.RegisterSupportItemCollector(collector)
		require.Len(t, s.collectors, 1)
	})
}
