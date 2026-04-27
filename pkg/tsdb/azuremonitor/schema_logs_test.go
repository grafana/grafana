package azuremonitor

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	schemas "github.com/grafana/schemads"
	"github.com/stretchr/testify/require"
)

func TestLogAnalyticsSchema_TableParameterValues_UnsupportedParameter(t *testing.T) {
	svc := &Service{im: &fakeInstance{}}
	p := newLogAnalyticsSchema(svc, log.DefaultLogger)

	tests := []struct {
		name           string
		tableParameter string
	}{
		{name: "unknown parameter name", tableParameter: "not_a_real_parameter"},
		{name: "metrics-only parameter on logs table", tableParameter: resourceGroup},
		{name: "empty parameter name", tableParameter: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := p.TableParameterValues(context.Background(), &schemas.TableParameterValuesRequest{
				Table:          "logs-MyWorkspace",
				TableParameter: tt.tableParameter,
			})
			require.NoError(t, err)
			require.NotNil(t, resp)
			require.Empty(t, resp.TableParameterValues, "no values should be returned for an unsupported parameter")
			require.Equal(t,
				map[string]string{tt.tableParameter: "unknown table parameter"},
				resp.Errors,
				"error must be keyed by the requested parameter so the caller can correlate it",
			)
		})
	}
}
