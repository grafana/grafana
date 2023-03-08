package contextmodel

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/web"
)

func TestQueryBoolWithDefault(t *testing.T) {
	tc := map[string]struct {
		url          string
		defaultValue bool
		expected     bool
	}{
		"with no value specified, the default value is returned": {
			url:          "http://localhost/api/v2/alerts",
			defaultValue: true,
			expected:     true,
		},
		"with a value specified, the default value is overridden": {
			url:          "http://localhost/api/v2/alerts?silenced=false",
			defaultValue: true,
			expected:     false,
		},
	}

	for name, tt := range tc {
		t.Run(name, func(t *testing.T) {
			req, err := http.NewRequest("GET", tt.url, nil)
			require.NoError(t, err)
			r := ReqContext{
				Context: &web.Context{Req: req},
			}
			require.Equal(t, tt.expected, r.QueryBoolWithDefault("silenced", tt.defaultValue))
		})
	}
}
