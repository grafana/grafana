package sqleng

import (
	"errors"
	"net"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
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
				JSONDetails: []byte(`{"errorDetailsLink":"https://grafana.com/docs/grafana/latest/datasources/mysql/#configure-the-data-source","verboseMessage":"foo\nread tcp: some op"}`),
			},
		},
		{
			name: "db error",
			err:  errors.Join(errors.New("foo"), &mysql.MySQLError{Number: uint16(1045), Message: "Access denied for user"}),
			want: &backend.CheckHealthResult{
				Status:      backend.HealthStatusError,
				Message:     "Database error: Failed to connect to the MySQL server. MySQL error number: 1045",
				JSONDetails: []byte(`{"errorDetailsLink":"https://dev.mysql.com/doc/mysql-errors/8.4/en/","verboseMessage":"foo\nError 1045: Access denied for user"}`),
			},
		},
		{
			name: "regular error",
			err:  errors.New("internal server error"),
			want: &backend.CheckHealthResult{
				Status:      backend.HealthStatusError,
				Message:     "internal server error",
				JSONDetails: []byte(`{}`),
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
