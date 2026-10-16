package ofrep

import (
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mustParseURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	u, err := url.Parse(raw)
	require.NoError(t, err)
	return u
}

func newUpstreamTestBuilder(t *testing.T, goffURL *url.URL, overrideFlags ...string) *APIBuilder {
	t.Helper()
	flags := make(map[string]bool, len(overrideFlags))
	for _, f := range overrideFlags {
		flags[f] = true
	}
	return &APIBuilder{
		providerType:    setting.FeaturesServiceProviderType,
		url:             mustParseURL(t, "http://override-lookup-provider"),
		goffURL:         goffURL,
		hgOverrideFlags: flags,
		logger:          log.NewNopLogger(),
	}
}

func TestAPIBuilder_UpstreamForFlag(t *testing.T) {
	goff := mustParseURL(t, "http://goff")

	tests := []struct {
		name          string
		bypassEnabled bool
		goffURL       *url.URL
		overrideFlags []string
		flagKey       string
		namespace     string
		wantGOFF      bool
	}{
		{
			name:          "gate off: always the override-lookup provider, even with GOFF configured and no override",
			bypassEnabled: false,
			goffURL:       goff,
			overrideFlags: []string{"knownOverrideFlag"},
			flagKey:       "someOtherFlag",
			namespace:     "stacks-1234",
			wantGOFF:      false,
		},
		{
			name:          "gate on, no GOFF URL configured: fails closed to the override-lookup provider",
			bypassEnabled: true,
			goffURL:       nil,
			flagKey:       "anyFlag",
			namespace:     "stacks-1234",
			wantGOFF:      false,
		},
		{
			name:          "gate on, namespace empty: bypasses even a flag with an override",
			bypassEnabled: true,
			goffURL:       goff,
			overrideFlags: []string{"knownOverrideFlag"},
			flagKey:       "knownOverrideFlag",
			namespace:     "",
			wantGOFF:      true,
		},
		{
			name:          "gate on, namespace wildcard: bypasses even a flag with an override",
			bypassEnabled: true,
			goffURL:       goff,
			overrideFlags: []string{"knownOverrideFlag"},
			flagKey:       "knownOverrideFlag",
			namespace:     "*",
			wantGOFF:      true,
		},
		{
			name:          "gate on, namespace known, flag has an override: override-lookup provider",
			bypassEnabled: true,
			goffURL:       goff,
			overrideFlags: []string{"knownOverrideFlag"},
			flagKey:       "knownOverrideFlag",
			namespace:     "stacks-1234",
			wantGOFF:      false,
		},
		{
			name:          "gate on, namespace known, flag has no override: GOFF",
			bypassEnabled: true,
			goffURL:       goff,
			overrideFlags: []string{"knownOverrideFlag"},
			flagKey:       "someOtherFlag",
			namespace:     "stacks-1234",
			wantGOFF:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagFeaturesLegacyOverrideLookupBypass, tt.bypassEnabled)
			b := newUpstreamTestBuilder(t, tt.goffURL, tt.overrideFlags...)

			got := b.upstreamForFlag(t.Context(), tt.flagKey, tt.namespace, b.logger)

			if tt.wantGOFF {
				assert.Equal(t, goff, got)
			} else {
				assert.Equal(t, b.url, got)
			}
		})
	}
}

func TestAPIBuilder_UpstreamForBulk(t *testing.T) {
	goff := mustParseURL(t, "http://goff")

	tests := []struct {
		name          string
		bypassEnabled bool
		goffURL       *url.URL
		namespace     string
		wantGOFF      bool
	}{
		{
			name:          "gate off: always the override-lookup provider",
			bypassEnabled: false,
			goffURL:       goff,
			namespace:     "",
			wantGOFF:      false,
		},
		{
			name:          "gate on, no GOFF URL configured: fails closed",
			bypassEnabled: true,
			goffURL:       nil,
			namespace:     "",
			wantGOFF:      false,
		},
		{
			name:          "gate on, namespace empty: bypasses",
			bypassEnabled: true,
			goffURL:       goff,
			namespace:     "",
			wantGOFF:      true,
		},
		{
			name:          "gate on, namespace wildcard: bypasses",
			bypassEnabled: true,
			goffURL:       goff,
			namespace:     "*",
			wantGOFF:      true,
		},
		{
			name:          "gate on, namespace known: stays on the override-lookup provider, the override list doesn't apply to bulk",
			bypassEnabled: true,
			goffURL:       goff,
			namespace:     "stacks-1234",
			wantGOFF:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagFeaturesLegacyOverrideLookupBypass, tt.bypassEnabled)
			b := newUpstreamTestBuilder(t, tt.goffURL)

			got := b.upstreamForBulk(t.Context(), tt.namespace, b.logger)

			if tt.wantGOFF {
				assert.Equal(t, goff, got)
			} else {
				assert.Equal(t, b.url, got)
			}
		})
	}
}
