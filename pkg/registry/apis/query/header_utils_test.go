package query

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	queryService "github.com/grafana/grafana/pkg/services/query"
)

func TestExtractKnownHeaders_GuardrailOverride(t *testing.T) {
	const (
		overrideHeader       = "X-Grafana-Guardrail-Override"
		overrideReasonHeader = "X-Grafana-Guardrail-Override-Reason"
	)

	tests := []struct {
		name     string
		header   http.Header
		expected map[string]string
	}{
		{
			name: "forwards both guardrail override headers",
			header: http.Header{
				overrideHeader:       []string{"abc.def"},
				overrideReasonHeader: []string{"investigating an incident"},
			},
			expected: map[string]string{
				overrideHeader:       "abc.def",
				overrideReasonHeader: "investigating an incident",
			},
		},
		{
			name: "forwards guardrail override headers regardless of key casing",
			header: http.Header{
				"x-grafana-guardrail-override":        []string{"abc.def"},
				"X-GRAFANA-GUARDRAIL-OVERRIDE-REASON": []string{"a reason"},
			},
			expected: map[string]string{
				overrideHeader:       "abc.def",
				overrideReasonHeader: "a reason",
			},
		},
		{
			name: "keeps forwarding other known headers alongside the guardrail headers",
			header: http.Header{
				overrideHeader:                  []string{"abc.def"},
				queryService.HeaderDashboardUID: []string{"dash-123"},
			},
			expected: map[string]string{
				overrideHeader:                  "abc.def",
				queryService.HeaderDashboardUID: "dash-123",
			},
		},
		{
			name: "drops unknown headers",
			header: http.Header{
				overrideHeader:  []string{"abc.def"},
				"X-Not-Allowed": []string{"should-be-dropped"},
			},
			expected: map[string]string{
				overrideHeader: "abc.def",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, ExtractKnownHeaders(tt.header))
		})
	}
}
