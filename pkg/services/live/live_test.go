package live

import (
	"context"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func Test_runConcurrentlyIfNeeded_Concurrent(t *testing.T) {
	doneCh := make(chan struct{})
	f := func() {
		close(doneCh)
	}
	semaphore := make(chan struct{}, 2)
	err := runConcurrentlyIfNeeded(context.Background(), semaphore, f)
	require.NoError(t, err)

	select {
	case <-doneCh:
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for function execution")
	}
}

func Test_runConcurrentlyIfNeeded_NoConcurrency(t *testing.T) {
	doneCh := make(chan struct{})
	f := func() {
		close(doneCh)
	}
	err := runConcurrentlyIfNeeded(context.Background(), nil, f)
	require.NoError(t, err)

	select {
	case <-doneCh:
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for function execution")
	}
}

func Test_runConcurrentlyIfNeeded_DeadlineExceeded(t *testing.T) {
	f := func() {}
	semaphore := make(chan struct{}, 2)
	semaphore <- struct{}{}
	semaphore <- struct{}{}

	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()
	err := runConcurrentlyIfNeeded(ctx, semaphore, f)
	require.ErrorIs(t, err, context.DeadlineExceeded)
}

func TestCheckOrigin(t *testing.T) {
	testCases := []struct {
		name           string
		origin         string
		appURL         string
		allowedOrigins []string
		success        bool
		host           string
	}{
		{
			name:    "empty_origin",
			origin:  "",
			appURL:  "http://localhost:3000/",
			success: true,
		},
		{
			name:    "valid_origin",
			origin:  "http://localhost:3000",
			appURL:  "http://localhost:3000/",
			success: true,
		},
		{
			name:    "valid_origin_no_port",
			origin:  "https://www.example.com",
			appURL:  "https://www.example.com:443/grafana/",
			success: true,
		},
		{
			name:    "unauthorized_origin",
			origin:  "http://localhost:8000",
			appURL:  "http://localhost:3000/",
			success: false,
		},
		{
			name:    "bad_origin",
			origin:  ":::http://localhost:8000",
			appURL:  "http://localhost:3000/",
			success: false,
		},
		{
			name:    "different_scheme",
			origin:  "http://example.com",
			appURL:  "https://example.com",
			success: false,
		},
		{
			name:    "authorized_case_insensitive",
			origin:  "https://examplE.com",
			appURL:  "https://example.com",
			success: true,
		},
		{
			name:           "authorized_allowed_origins",
			origin:         "https://test.example.com",
			appURL:         "http://localhost:3000/",
			allowedOrigins: []string{"https://test.example.com"},
			success:        true,
		},
		{
			name:           "authorized_allowed_origins_pattern",
			origin:         "https://test.example.com",
			appURL:         "http://localhost:3000/",
			allowedOrigins: []string{"https://*.example.com"},
			success:        true,
		},
		{
			name:           "authorized_allowed_origins_all",
			origin:         "https://test.example.com",
			appURL:         "http://localhost:3000/",
			allowedOrigins: []string{"*"},
			success:        true,
		},
		{
			name:    "request_host_matches_origin_host",
			origin:  "http://example.com",
			appURL:  "https://example.com",
			success: true,
			host:    "example.com",
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			appURL, err := url.Parse(tc.appURL)
			require.NoError(t, err)

			originGlobs, err := setting.GetAllowedOriginGlobs(tc.allowedOrigins)
			require.NoError(t, err)

			checkOrigin := getCheckOriginFunc(appURL, tc.allowedOrigins, originGlobs)

			r := httptest.NewRequest("GET", tc.appURL, nil)
			r.Host = tc.host
			r.Header.Set("Origin", tc.origin)
			require.Equal(t, tc.success, checkOrigin(r),
				"origin %s, appURL: %s", tc.origin, tc.appURL,
			)
		})
	}
}

func Test_getHistogramMetric(t *testing.T) {
	type args struct {
		val          int
		bounds       []int
		metricPrefix string
	}

	tests := []struct {
		name string
		args args
		want string
	}{
		{
			"zero",
			args{0, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_0",
		},
		{
			"equal_to_bound",
			args{10, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_10",
		},
		{
			"in_the_middle",
			args{30000, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_100000",
		},
		{
			"more_than_upper_bound",
			args{300000, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_inf",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getHistogramMetric(tt.args.val, tt.args.bounds, tt.args.metricPrefix); got != tt.want {
				t.Errorf("getHistogramMetric() = %v, want %v", got, tt.want)
			}
		})
	}
}
