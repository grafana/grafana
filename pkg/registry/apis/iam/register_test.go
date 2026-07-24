package iam

import (
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestInstallSchema_ResourcePermissionsGate(t *testing.T) {
	gvk := iamv0.ResourcePermissionInfo.GroupVersionKind()

	tests := []struct {
		name           string
		flagEnabled    bool
		wantRegistered bool
	}{
		{
			name:           "kind registered when flag enabled",
			flagEnabled:    true,
			wantRegistered: true,
		},
		{
			name:           "kind not registered when flag disabled",
			flagEnabled:    false,
			wantRegistered: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
				featuremgmt.FlagKubernetesAuthzResourcePermissionApis: {
					Key:            featuremgmt.FlagKubernetesAuthzResourcePermissionApis,
					DefaultVariant: "default",
					Variants:       map[string]any{"default": tt.flagEnabled},
				},
			})
			require.NoError(t, openfeature.SetProviderAndWait(provider))

			b := &IdentityAccessManagementAPIBuilder{ofClient: openfeature.NewDefaultClient()}

			scheme := runtime.NewScheme()
			require.NoError(t, b.InstallSchema(scheme))
			require.Equal(t, tt.wantRegistered, scheme.Recognizes(gvk),
				"ResourcePermission kind registration should match %s=%v", featuremgmt.FlagKubernetesAuthzResourcePermissionApis, tt.flagEnabled)
		})
	}
}
