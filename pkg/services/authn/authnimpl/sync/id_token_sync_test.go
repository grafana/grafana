package sync

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/auth/idsignertest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/assert"
)

func TestIDTokenSync_SyncIDTokenHook(t *testing.T) {
	type testCase struct {
		desc     string
		features featuremgmt.FeatureToggles
	}

	tests := []testCase{
		{
			desc:     "should set id token if feature toggle is enabled",
			features: featuremgmt.WithFeatures(featuremgmt.FlagIdToken),
		},
		{

			desc:     "should not set id token if feature toggle is disabled",
			features: featuremgmt.WithFeatures(featuremgmt.FlagIdToken),
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {

			signer := &idsignertest.FakeService{ExpectedToken: "SomeToken"}
			sync := ProvideIDTokenSync(signer, tt.features)

			identitiy := &authn.Identity{}
			sync.SyncIDTokenHook(context.Background(), identitiy, &authn.Request{})

			if tt.features.IsEnabled(featuremgmt.FlagIdToken) {
				assert.Equal(t, "SomeToken", identitiy.IDToken)
			} else {
				assert.Empty(t, identitiy.IDToken)
			}
		})
	}
}
