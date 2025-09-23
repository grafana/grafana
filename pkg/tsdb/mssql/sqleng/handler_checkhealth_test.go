package sqleng

import (
	"errors"
	"net"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	mssql "github.com/microsoft/go-mssqldb"
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
				JSONDetails: []byte(`{"errorDetailsLink":"https://grafana.com/docs/grafana/latest/datasources/mssql","verboseMessage":"foo\nread tcp: some op"}`),
			},
		},
		{
			name: "db error",
			err:  errors.Join(errors.New("foo"), &mssql.Error{Message: "error foo occurred in mssql server"}),
			want: &backend.CheckHealthResult{
				Status:      backend.HealthStatusError,
				Message:     "foo\nmssql: error foo occurred in mssql server",
				JSONDetails: []byte(`{"errorDetailsLink":"https://grafana.com/docs/grafana/latest/datasources/mssql","verboseMessage":"foo\nmssql: error foo occurred in mssql server"}`),
			},
		},
		{
			name: "regular error",
			err:  errors.New("internal server error"),
			want: &backend.CheckHealthResult{
				Status:      backend.HealthStatusError,
				Message:     "internal server error",
				JSONDetails: []byte(`{"errorDetailsLink":"https://grafana.com/docs/grafana/latest/datasources/mssql","verboseMessage":"internal server error"}`),
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
