package featuremgmt

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt/strcase"
	"github.com/stretchr/testify/require"
)

func TestRegistry(t *testing.T) {
	legacyNames := map[string]bool{
		"httpclientprovider_azure_auth":  true,
		"service-accounts":               true,
		"database_metrics":               true,
		"live-config":                    true,
		"live-pipeline":                  true,
		"live-service-web-worker":        true,
		"accesscontrol-builtins":         true,
		"prometheus_azure_auth":          true,
		"disable_http_request_histogram": true,
	}

	t.Run("check feature naming convention", func(t *testing.T) {
		invalidNames := make([]string, 0)
		for _, f := range standardFeatureFlags {
			if legacyNames[f.Name] {
				continue
			}

			if f.Name != strcase.ToLowerCamel(f.Name) {
				invalidNames = append(invalidNames, f.Name)
			}
		}

		require.Empty(t, invalidNames)
		// acronyms can be configured as needed via `ConfigureAcronym` function from `./strcase/camel.go`
	})

}
