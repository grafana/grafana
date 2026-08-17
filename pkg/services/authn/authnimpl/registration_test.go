package authnimpl

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social/socialtest"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestRegisterOAuthClients(t *testing.T) {
	t.Run("registers configured OAuth providers", func(t *testing.T) {
		authnService := &authntest.FakeService{}
		socialService := &socialtest.FakeSocialService{
			ExpectedOAuthProviders: map[string]bool{
				"github":  true,
				"azuread": true,
			},
		}

		registerOAuthClients(
			t.Context(), log.NewNopLogger(), authnService, nil, nil, socialService,
			featuremgmt.WithFeatures(), tracing.InitializeTracerForTest(),
		)

		clientNames := make([]string, 0, len(authnService.RegisteredClients))
		for _, client := range authnService.RegisteredClients {
			clientNames = append(clientNames, client.Name())
		}
		assert.ElementsMatch(t, []string{"auth.client.github", "auth.client.azuread"}, clientNames)
	})

	t.Run("keeps startup available when provider discovery fails", func(t *testing.T) {
		authnService := &authntest.FakeService{}
		socialService := &socialtest.FakeSocialService{ExpectedOAuthProvidersError: assert.AnError}

		registerOAuthClients(
			t.Context(), log.NewNopLogger(), authnService, nil, nil, socialService,
			featuremgmt.WithFeatures(), tracing.InitializeTracerForTest(),
		)

		assert.Empty(t, authnService.RegisteredClients)
	})
}
