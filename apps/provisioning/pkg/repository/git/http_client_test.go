package git

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHostLimitTransportLimitsConcurrentRequestsPerHost(t *testing.T) {
	transport := &recordingRoundTripper{
		started: make(chan string, 3),
	}
	client := &http.Client{
		Transport: newHostLimitTransport(transport, HTTPClientConfig{
			MaxConcurrentRequestsPerHost: 1,
		}),
	}

	firstResponse, err := client.Get("https://git.example.com/first")
	require.NoError(t, err)
	require.Equal(t, "git.example.com", <-transport.started)

	secondCtx, cancelSecond := context.WithCancel(context.Background())
	secondResult := make(chan error, 1)
	go func() {
		request, requestErr := http.NewRequestWithContext(secondCtx, http.MethodGet, "https://git.example.com/second", nil)
		if requestErr != nil {
			secondResult <- requestErr
			return
		}
		response, requestErr := client.Do(request)
		if response != nil {
			_ = response.Body.Close()
		}
		secondResult <- requestErr
	}()

	cancelSecond()
	require.ErrorIs(t, <-secondResult, context.Canceled)
	assert.Empty(t, transport.started)

	require.NoError(t, firstResponse.Body.Close())

	thirdResponse, err := client.Get("https://git.example.com/third")
	require.NoError(t, err)
	require.Equal(t, "git.example.com", <-transport.started)
	require.NoError(t, thirdResponse.Body.Close())
}

func TestHostLimitTransportUsesIndependentHostLimits(t *testing.T) {
	transport := &recordingRoundTripper{
		started: make(chan string, 2),
	}
	client := &http.Client{
		Transport: newHostLimitTransport(transport, HTTPClientConfig{
			MaxConcurrentRequestsPerHost: 1,
		}),
	}

	firstResponse, err := client.Get("https://git-one.example.com/repo")
	require.NoError(t, err)

	secondResponse, err := client.Get("https://git-two.example.com/repo")
	require.NoError(t, err)

	assert.ElementsMatch(t, []string{"git-one.example.com", "git-two.example.com"}, []string{
		<-transport.started,
		<-transport.started,
	})
	require.NoError(t, firstResponse.Body.Close())
	require.NoError(t, secondResponse.Body.Close())
}

func TestHostLimitTransportRateLimitHonorsContextCancellation(t *testing.T) {
	transport := &recordingRoundTripper{
		started: make(chan string, 1),
	}
	client := &http.Client{
		Transport: newHostLimitTransport(transport, HTTPClientConfig{
			RequestsPerSecondPerHost: 1,
			BurstPerHost:             1,
		}),
	}

	firstResponse, err := client.Get("https://git.example.com/first")
	require.NoError(t, err)
	require.NoError(t, firstResponse.Body.Close())
	require.Equal(t, "git.example.com", <-transport.started)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://git.example.com/second", nil)
	require.NoError(t, err)

	response, err := client.Do(request)
	if response != nil {
		_ = response.Body.Close()
	}
	require.Error(t, err)
	assert.True(t, errors.Is(err, context.DeadlineExceeded) || strings.Contains(err.Error(), "would exceed context deadline"))
	assert.Empty(t, transport.started)
}

func TestRemoteHostKey(t *testing.T) {
	tests := []struct {
		name     string
		rawURL   string
		expected string
	}{
		{
			name:     "normalizes HTTPS default port and host case",
			rawURL:   "https://Git.Example.com/repo",
			expected: "git.example.com:443",
		},
		{
			name:     "keeps explicit port",
			rawURL:   "https://git.example.com:8443/repo",
			expected: "git.example.com:8443",
		},
		{
			name:     "normalizes HTTP default port",
			rawURL:   "http://git.example.com/repo",
			expected: "git.example.com:80",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request, err := http.NewRequest(http.MethodGet, test.rawURL, nil)
			require.NoError(t, err)

			assert.Equal(t, test.expected, remoteHostKey(request.URL))
		})
	}
}

type recordingRoundTripper struct {
	started chan string
}

func (r *recordingRoundTripper) RoundTrip(request *http.Request) (*http.Response, error) {
	r.started <- request.URL.Hostname()
	return responseWithBody(request.URL.Path), nil
}

func responseWithBody(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}
