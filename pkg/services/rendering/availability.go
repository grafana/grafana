package rendering

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"
)

type Availability interface {
	Run(context.Context) error
	IsAvailable(context.Context) bool
	Version() string
	Health() error
}

// ConfiguredAvailability keeps embedded Grafana available while its renderer is
// configured. A failed background version probe must not disable ST rendering.
type ConfiguredAvailability struct {
	Monitor *RemoteAvailability
}

func (s ConfiguredAvailability) Run(ctx context.Context) error {
	if s.Monitor != nil {
		return s.Monitor.Run(ctx)
	}

	<-ctx.Done()
	return nil
}

func (ConfiguredAvailability) IsAvailable(context.Context) bool { return true }

func (s ConfiguredAvailability) Version() string {
	if s.Monitor != nil {
		return s.Monitor.Version()
	}

	return ""
}

func (s ConfiguredAvailability) Health() error {
	if s.Monitor != nil {
		return s.Monitor.Health()
	}

	return nil
}

type ProbeConfig struct {
	Renderer  ImageRendererConfig
	Client    *http.Client
	UserAgent UserAgentProvider
	Interval  time.Duration
	Timeout   time.Duration
	// OnHealthChange can publish probe results to the module's readiness notifier.
	OnHealthChange func(error)
}

// RemoteAvailability follows the shared renderer's health, independent of tenant settings.
type RemoteAvailability struct {
	config  ProbeConfig
	mu      sync.RWMutex
	version string
	err     error
}

func NewRemoteAvailability(cfg ProbeConfig) *RemoteAvailability {
	if cfg.UserAgent == nil {
		cfg.UserAgent = StaticUserAgent("Grafana/")
	}

	if cfg.Client == nil {
		cfg.Client = &http.Client{}
	}

	if cfg.Interval <= 0 {
		cfg.Interval = 15 * time.Minute
	}

	if cfg.Timeout <= 0 {
		cfg.Timeout = 10 * time.Second
	}

	return &RemoteAvailability{config: cfg, err: ErrRenderUnavailable}
}

func (s *RemoteAvailability) IsAvailable(context.Context) bool { return s.Health() == nil }

func (s *RemoteAvailability) Version() string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.version
}

func (s *RemoteAvailability) Health() error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.err
}

func (s *RemoteAvailability) Run(ctx context.Context) error {
	timer := time.NewTimer(0)
	defer timer.Stop()

	retries := 0
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-timer.C:
			version, err := s.probe(ctx)
			s.mu.Lock()
			s.err = err
			if err == nil {
				s.version = version
			}
			s.mu.Unlock()

			if s.config.OnHealthChange != nil {
				s.config.OnHealthChange(err)
			}

			delay := s.config.Interval
			if err != nil && retries < 4 {
				retries++
				delay = min(15*time.Second, delay)
			} else if err == nil {
				retries = 0
			}

			timer.Reset(delay)
		}
	}
}

func (s *RemoteAvailability) probe(ctx context.Context) (string, error) {
	if s.config.Renderer.URL == "" {
		return "", ErrRenderUnavailable
	}

	ctx, cancel := context.WithTimeout(ctx, s.config.Timeout)
	defer cancel()

	u, err := url.Parse(s.config.Renderer.URL + "/version")
	if err != nil {
		return "", err
	}

	resp, err := doRendererRequest(ctx, s.config.Client, s.config.UserAgent, s.config.Renderer, u, nil)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return "1.0.0", nil
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("renderer version request failed, status code: %d", resp.StatusCode)
	}

	var info struct{ Version string }
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return "", err
	}

	if info.Version == "" {
		return "", fmt.Errorf("renderer returned an empty version")
	}

	return info.Version, nil
}
