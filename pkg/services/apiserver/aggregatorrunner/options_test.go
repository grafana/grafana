package aggregatorrunner

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

func TestAggregatorOptions_Validate(t *testing.T) {
	tests := []struct {
		name        string
		opts        *AggregatorOptions
		expectError bool
		errorCount  int
	}{
		{
			name: "valid options",
			opts: &AggregatorOptions{
				Config:            &genericapiserver.RecommendedConfig{},
				DelegateAPIServer: genericapiserver.NewEmptyDelegate(),
				Scheme:            runtime.NewScheme(),
			},
			expectError: false,
		},
		{
			name: "missing config",
			opts: &AggregatorOptions{
				DelegateAPIServer: genericapiserver.NewEmptyDelegate(),
				Scheme:            runtime.NewScheme(),
			},
			expectError: true,
			errorCount:  1,
		},
		{
			name: "missing delegate",
			opts: &AggregatorOptions{
				Config: &genericapiserver.RecommendedConfig{},
				Scheme: runtime.NewScheme(),
			},
			expectError: true,
			errorCount:  1,
		},
		{
			name: "missing scheme",
			opts: &AggregatorOptions{
				Config:            &genericapiserver.RecommendedConfig{},
				DelegateAPIServer: genericapiserver.NewEmptyDelegate(),
			},
			expectError: true,
			errorCount:  1,
		},
		{
			name:        "all missing",
			opts:        &AggregatorOptions{},
			expectError: true,
			errorCount:  3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := tt.opts.Validate()

			if tt.expectError {
				assert.NotEmpty(t, errs)
				assert.Len(t, errs, tt.errorCount)
			} else {
				assert.Empty(t, errs)
			}
		})
	}
}

func TestAggregatorOptions_OptionalFields(t *testing.T) {
	// Test that optional fields don't cause validation errors
	opts := &AggregatorOptions{
		Config:            &genericapiserver.RecommendedConfig{},
		DelegateAPIServer: genericapiserver.NewEmptyDelegate(),
		Scheme:            runtime.NewScheme(),
		// Optional fields left nil
		CRDInformer:            nil,
		AuthorizerRegistration: nil,
		LocalOnlyAggregation:   true,
	}

	errs := opts.Validate()
	assert.Empty(t, errs)
}
