package git

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"golang.org/x/time/rate"
)

// httpClientConfig controls outbound Git Smart HTTP traffic for one repository.
// Limits are applied independently to each remote host used by the returned client.
type httpClientConfig struct {
	MaxConcurrentRequests int
	RequestsPerSecond     int
	Burst                 int
}

// newHTTPClient returns an HTTP client that applies the configured limits to
// outbound Git requests.
func newHTTPClient(config httpClientConfig) *http.Client {
	if config.MaxConcurrentRequests <= 0 && config.RequestsPerSecond <= 0 {
		return &http.Client{}
	}

	return &http.Client{
		Transport: newHostLimitTransport(http.DefaultTransport, config),
	}
}

type hostLimitTransport struct {
	base   http.RoundTripper
	config httpClientConfig

	mu       sync.Mutex
	limiters map[string]*requestLimiter
}

func newHostLimitTransport(base http.RoundTripper, config httpClientConfig) *hostLimitTransport {
	if base == nil {
		base = http.DefaultTransport
	}

	return &hostLimitTransport{
		base:     base,
		config:   config,
		limiters: make(map[string]*requestLimiter),
	}
}

func (t *hostLimitTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	release, err := t.limiter(req.URL).acquire(req.Context())
	if err != nil {
		return nil, err
	}

	response, err := t.base.RoundTrip(req)
	if err != nil {
		release()
		return nil, err
	}
	if response.Body == nil {
		release()
		return response, nil
	}

	response.Body = &releaseReadCloser{
		ReadCloser: response.Body,
		release:    release,
	}
	return response, nil
}

func (t *hostLimitTransport) limiter(remote *url.URL) *requestLimiter {
	key := remoteHostKey(remote)

	t.mu.Lock()
	defer t.mu.Unlock()

	limiter, ok := t.limiters[key]
	if ok {
		return limiter
	}

	limiter = newRequestLimiter(t.config)
	t.limiters[key] = limiter
	return limiter
}

func remoteHostKey(remote *url.URL) string {
	host := strings.ToLower(remote.Hostname())
	port := remote.Port()
	if port == "" {
		switch strings.ToLower(remote.Scheme) {
		case "http":
			port = "80"
		case "https":
			port = "443"
		}
	}
	if port == "" {
		return host
	}
	return net.JoinHostPort(host, port)
}

type requestLimiter struct {
	concurrent chan struct{}
	rate       *rate.Limiter
}

func newRequestLimiter(config httpClientConfig) *requestLimiter {
	limiter := &requestLimiter{}
	if config.MaxConcurrentRequests > 0 {
		limiter.concurrent = make(chan struct{}, config.MaxConcurrentRequests)
	}
	if config.RequestsPerSecond > 0 {
		burst := config.Burst
		if burst <= 0 {
			burst = 1
		}
		limiter.rate = rate.NewLimiter(rate.Limit(config.RequestsPerSecond), burst)
	}
	return limiter
}

func (l *requestLimiter) acquire(ctx context.Context) (func(), error) {
	release := func() {}
	if l.concurrent != nil {
		select {
		case l.concurrent <- struct{}{}:
			var once sync.Once
			release = func() {
				once.Do(func() {
					<-l.concurrent
				})
			}
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	if l.rate != nil {
		if err := l.rate.Wait(ctx); err != nil {
			release()
			return nil, err
		}
	}

	return release, nil
}

type releaseReadCloser struct {
	io.ReadCloser
	release func()
}

func (r *releaseReadCloser) Read(p []byte) (int, error) {
	n, err := r.ReadCloser.Read(p)
	if err != nil {
		r.release()
	}
	return n, err
}

func (r *releaseReadCloser) Close() error {
	err := r.ReadCloser.Close()
	r.release()
	return err
}
