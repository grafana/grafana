package idimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func Test_ProvideService(t *testing.T) {
	t.Run("should register post auth hook when feature flag is enabled", func(t *testing.T) {
		features := featuremgmt.WithFeatures(featuremgmt.FlagIdForwarding)

		var hookRegistered bool
		authnService := &authntest.MockService{
			RegisterPostAuthHookFunc: func(_ authn.PostAuthHookFn, _ uint) {
				hookRegistered = true
			},
		}

		_ = ProvideService(setting.NewCfg(), nil, nil, features, authnService)
		assert.True(t, hookRegistered)
	})

	t.Run("should not register post auth hook when feature flag is disabled", func(t *testing.T) {
		features := featuremgmt.WithFeatures()

		var hookRegistered bool
		authnService := &authntest.MockService{
			RegisterPostAuthHookFunc: func(_ authn.PostAuthHookFn, _ uint) {
				hookRegistered = true
			},
		}

		_ = ProvideService(setting.NewCfg(), nil, nil, features, authnService)
		assert.False(t, hookRegistered)
	})
}
