package sqleng

import (
	"errors"
	"net"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestErrToHealthCheckResult(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want *backend.CheckHealthResult
	}{
		{
			name: "without error",
			want: &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: "Internal Server Error"},
		},
		{
			name: "network error",
			err:  errors.Join(errors.New("foo"), &net.OpError{Op: "read", Net: "tcp", Err: errors.New("some op")}),
			want: &backend.CheckHealthResult{
				Status:      backend.HealthStatusError,
				Message:     "Network error: Failed to connect to the server. Error message: some op",
				JSONDetails: []byte(`{"errorDetailsLink":"https://grafana.com/docs/grafana/latest/datasources/postgres","verboseMessage":"foo\nread tcp: some op"}`),
			},
		},
		{
			name: "db error",
			err:  errors.Join(errors.New("foo"), &pq.Error{Message: pq.ErrCouldNotDetectUsername.Error(), Code: pq.ErrorCode("28P01")}),
			want: &backend.CheckHealthResult{
				Status:      backend.HealthStatusError,
				Message:     "foo\npq: pq: Could not detect default username. Please provide one explicitly. Postgres error code: invalid_password",
				JSONDetails: []byte(`{"errorDetailsLink":"https://grafana.com/docs/grafana/latest/datasources/postgres","verboseMessage":"pq: Could not detect default username. Please provide one explicitly"}`),
			},
		},
		{
			name: "regular error",
			err:  errors.New("internal server error"),
			want: &backend.CheckHealthResult{
				Status:      backend.HealthStatusError,
				Message:     "internal server error",
				JSONDetails: []byte(`{"errorDetailsLink":"https://grafana.com/docs/grafana/latest/datasources/postgres","verboseMessage":"internal server error"}`),
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ErrToHealthCheckResult(tt.err)
			require.Nil(t, err)
			assert.Equal(t, string(tt.want.JSONDetails), string(got.JSONDetails))
			require.Equal(t, tt.want, got)
		})
	}
}
