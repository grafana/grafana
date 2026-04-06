package sqleng

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sync"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var openfeatureTestMutex sync.Mutex

func setupOpenFeatureFlag(t *testing.T, flag string, value bool) {
	t.Helper()
	openfeatureTestMutex.Lock()

	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
		flag: setting.NewInMemoryFlag(flag, value),
	})
	require.NoError(t, err)

	err = openfeature.SetProviderAndWait(provider)
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMutex.Unlock()
	})
}

type mockSuperuserDetector struct {
	isSuperuser bool
	err         error
}

func (m *mockSuperuserDetector) DetectSuperuser(_ context.Context) (bool, error) {
	return m.isSuperuser, m.err
}

func TestCheckHealthSuccess(t *testing.T) {
	tests := []struct {
		name             string
		detector         superuserDetector
		superuserWarning bool
		wantDetails      string
	}{
		{
			name:             "not a superuser",
			detector:         &mockSuperuserDetector{isSuperuser: false},
			superuserWarning: true,
			wantDetails:      "",
		},
		{
			name:             "is a superuser, feature enabled",
			detector:         &mockSuperuserDetector{isSuperuser: true},
			superuserWarning: true,
			wantDetails:      `{"superuser":true}`,
		},
		{
			name:             "is a superuser, feature disabled",
			detector:         &mockSuperuserDetector{isSuperuser: true},
			superuserWarning: false,
			wantDetails:      "",
		},
		{
			name:             "superuser detection error is ignored",
			detector:         &mockSuperuserDetector{err: errors.New("permission denied")},
			superuserWarning: true,
			wantDetails:      "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagPostgresqlSuperuserWarning, tt.superuserWarning)
			got, err := checkHealthSuccess(context.Background(), tt.detector)
			require.NoError(t, err)
			assert.Equal(t, backend.HealthStatusOk, got.Status)
			assert.Equal(t, "Database Connection OK", got.Message)
			assert.Equal(t, tt.wantDetails, string(got.JSONDetails))
		})
	}
}

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
			name: "regular error",
			err:  errors.New("internal server error"),
			want: &backend.CheckHealthResult{
				Status:      backend.HealthStatusError,
				Message:     "internal server error",
				JSONDetails: []byte(`{"errorDetailsLink":"https://grafana.com/docs/grafana/latest/datasources/postgres","verboseMessage":"internal server error"}`),
			},
		},
		{
			name: "invalid port specifier error",
			err:  fmt.Errorf("%w %q: %w", ErrParsingPostgresURL, `"foo.bar.co"`, errors.New(`strconv.Atoi: parsing "foo.bar.co": invalid syntax`)),
			want: &backend.CheckHealthResult{
				Status:      backend.HealthStatusError,
				Message:     "Connection string error: error parsing postgres url",
				JSONDetails: []byte(`{"errorDetailsLink":"https://grafana.com/docs/grafana/latest/datasources/postgres","verboseMessage":"error parsing postgres url \"\\\"foo.bar.co\\\"\": strconv.Atoi: parsing \"foo.bar.co\": invalid syntax"}`),
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
