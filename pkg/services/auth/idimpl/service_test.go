package idimpl

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
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

		_ = ProvideService(setting.NewCfg(), nil, nil, features, authnService, nil)
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

		_ = ProvideService(setting.NewCfg(), nil, nil, features, authnService, nil)
		assert.False(t, hookRegistered)
	})
}
