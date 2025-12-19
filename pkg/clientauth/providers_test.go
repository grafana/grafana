package clientauth

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStaticNamespaceProvider(t *testing.T) {
	tests := []struct {
		name              string
		namespace         string
		expectedNamespace string
	}{
		{
			name:              "wildcard namespace",
			namespace:         "*",
			expectedNamespace: "*",
		},
		{
			name:              "specific namespace",
			namespace:         "my-namespace",
			expectedNamespace: "my-namespace",
		},
		{
			name:              "empty namespace",
			namespace:         "",
			expectedNamespace: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := NewStaticNamespaceProvider(tt.namespace)
			result := provider.GetNamespace(context.Background())
			require.Equal(t, tt.expectedNamespace, result)
		})
	}
}

func TestStaticAudienceProvider(t *testing.T) {
	tests := []struct {
		name              string
		audiences         []string
		expectedAudiences []string
	}{
		{
			name:              "single audience",
			audiences:         []string{"folder.grafana.app"},
			expectedAudiences: []string{"folder.grafana.app"},
		},
		{
			name:              "multiple audiences",
			audiences:         []string{"audience1", "audience2", "audience3"},
			expectedAudiences: []string{"audience1", "audience2", "audience3"},
		},
		{
			name:              "empty audiences",
			audiences:         []string{},
			expectedAudiences: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := NewStaticAudienceProvider(tt.audiences...)
			result := provider.GetAudiences(context.Background())
			require.Equal(t, tt.expectedAudiences, result)
		})
	}
}

func TestSingleAudienceProvider(t *testing.T) {
	provider := NewSingleAudienceProvider("test-audience")
	result := provider.GetAudiences(context.Background())
	require.Equal(t, []string{"test-audience"}, result)
}

func TestProviderInterfaces(t *testing.T) {
	// Verify that all providers implement their interfaces
	var _ NamespaceProvider = (*StaticNamespaceProvider)(nil)
	var _ AudienceProvider = (*StaticAudienceProvider)(nil)
	var _ AudienceProvider = (*SingleAudienceProvider)(nil)
}
