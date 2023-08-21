package clientmiddleware

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFeaturesMiddleware(t *testing.T) {
	t.Run("Should add feature flags to context", func(t *testing.T) {
		expectedFeatures := []string{"feat-1", "feat-2"}
		f := featuremgmt.WithFeatures(expectedFeatures[0], true, expectedFeatures[1], true)

		cdt := clienttest.NewClientDecoratorTest(t,
			clienttest.WithMiddlewares(NewFeaturesMiddleware(f)),
		)

		req := &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{},
		}

		_, err := cdt.Decorator.QueryData(context.Background(), req)

		require.NoError(t, err)

		assert.NotNil(t, req.PluginContext.FeatureTogglesEnabled)

		for _, feat := range expectedFeatures {
			assert.True(t, req.PluginContext.FeatureTogglesEnabled[feat])
		}
	})
}
