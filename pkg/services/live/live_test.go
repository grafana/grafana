package live

import (
	"context"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
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
		name    string
		origin  string
		appURL  string
		success bool
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
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			appURL, err := url.Parse(tc.appURL)
			require.NoError(t, err)
			r := httptest.NewRequest("GET", tc.appURL, nil)
			r.Header.Set("Origin", tc.origin)
			require.Equal(t, tc.success, checkOrigin(r, appURL),
				"origin %s, appURL: %s", tc.origin, tc.appURL,
			)
		})
	}
}
