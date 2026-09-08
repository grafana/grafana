package v2

import (
	"container/list"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Masterminds/semver"
)

type Capability string

const (
	CapabilityFullHeightImages  Capability = "FullHeightImages"
	CapabilityScalingDownImages Capability = "ScalingDownImages"
	CapabilityPDFRendering      Capability = "PdfRendering"
	versionRequestTimeout                  = 30 * time.Second
	versionCacheTTL                        = 15 * time.Minute
	versionCacheEntriesMax                 = 1_024
)

var (
	ErrCapabilityUnknown      = errors.New("unknown rendering capability")
	ErrRendererVersionInvalid = errors.New("invalid renderer version")
)

type CapabilitySupport struct {
	Supported        bool
	SemverConstraint string
}

func capabilityConstraint(capability Capability) (string, bool) {
	switch capability {
	case CapabilityFullHeightImages, CapabilityScalingDownImages:
		return ">= 3.4.0", true
	case CapabilityPDFRendering:
		return ">= 3.10.0", true
	default:
		return "", false
	}
}

func (s *Service) HasCapability(ctx context.Context, capability Capability) (CapabilitySupport, error) {
	constraintValue, known := capabilityConstraint(capability)
	if !known {
		return CapabilitySupport{}, ErrCapabilityUnknown
	}
	configuration, err := s.configurations.Get(ctx)
	if err != nil {
		return CapabilitySupport{}, fmt.Errorf("get rendering configuration: %w", err)
	}
	enabled, err := configuration.enabled()
	if err != nil {
		return CapabilitySupport{}, err
	}
	return s.hasCapability(ctx, enabled, capability, constraintValue)
}

func (s *Service) hasCapability(ctx context.Context, enabled enabledConfiguration, capability Capability, constraintValue string) (CapabilitySupport, error) {
	version, err := s.fetchRendererVersion(ctx, enabled)
	if err != nil {
		return CapabilitySupport{SemverConstraint: constraintValue}, err
	}
	constraint, err := semver.NewConstraint(constraintValue)
	if err != nil {
		return CapabilitySupport{SemverConstraint: constraintValue}, ErrCapabilityUnknown
	}
	parsedVersion, err := semver.NewVersion(version)
	if err != nil {
		return CapabilitySupport{SemverConstraint: constraintValue}, ErrRendererVersionInvalid
	}
	return CapabilitySupport{
		Supported:        constraint.Check(parsedVersion),
		SemverConstraint: constraintValue,
	}, nil
}

func (s *Service) isCapabilitySupported(ctx context.Context, enabled enabledConfiguration, capability Capability) error {
	constraintValue, known := capabilityConstraint(capability)
	if !known {
		return ErrCapabilityUnknown
	}
	support, err := s.hasCapability(ctx, enabled, capability, constraintValue)
	if err != nil {
		return err
	}
	if !support.Supported {
		return fmt.Errorf("%s unsupported, requires image renderer version: %s", capability, support.SemverConstraint)
	}
	return nil
}

func (s *Service) IsCapabilitySupported(ctx context.Context, capability Capability) error {
	support, err := s.HasCapability(ctx, capability)
	if err != nil {
		return err
	}
	if !support.Supported {
		return fmt.Errorf("%s unsupported, requires image renderer version: %s", capability, support.SemverConstraint)
	}
	return nil
}

func (s *Service) fetchRendererVersion(ctx context.Context, cfg enabledConfiguration) (string, error) {
	cacheKey := cfg.rendererURL.url.String() + "\x00" + cfg.rendererCACertPath
	if version, found := s.versions.get(cacheKey, time.Now()); found {
		s.version.Store(&version)
		return version, nil
	}

	client, releaseClient, err := s.clientFor(cfg.rendererCACertPath)
	if err != nil {
		return "", err
	}
	defer releaseClient()
	versionURL := *cfg.rendererURL.url
	versionURL.Path = strings.TrimRight(versionURL.Path, "/") + "/version"

	requestContext, cancel := context.WithTimeout(ctx, versionRequestTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(requestContext, http.MethodGet, versionURL.String(), nil)
	if err != nil {
		return "", fmt.Errorf("create renderer version request: %w", err)
	}
	request.Header.Set(rendererAuthTokenHeader, cfg.rendererAuthToken.value)
	request.Header.Set(rateLimiterHeader, cfg.rendererTenantID.value)
	request.Header.Set("User-Agent", "Grafana/"+cfg.buildVersion)

	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("send renderer version request: %w", err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode == http.StatusNotFound {
		version := "1.0.0"
		s.versions.put(cacheKey, version, time.Now().Add(versionCacheTTL))
		s.version.Store(&version)
		return version, nil
	}
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("renderer version request failed: status code %d", response.StatusCode)
	}

	var information struct {
		Version string
	}
	decoder := json.NewDecoder(response.Body)
	if err := decoder.Decode(&information); err != nil {
		return "", fmt.Errorf("decode renderer version response: %w", err)
	}
	if strings.TrimSpace(information.Version) == "" {
		return "", ErrRendererVersionInvalid
	}
	version := information.Version
	s.versions.put(cacheKey, version, time.Now().Add(versionCacheTTL))
	s.version.Store(&version)
	return version, nil
}

type rendererVersionCache struct {
	mutex      sync.Mutex
	entries    map[string]*list.Element
	recent     *list.List
	entryLimit int
}

type rendererVersionCacheEntry struct {
	key       string
	version   string
	expiresAt time.Time
}

func newRendererVersionCache() *rendererVersionCache {
	return &rendererVersionCache{
		entries:    make(map[string]*list.Element, versionCacheEntriesMax),
		recent:     list.New(),
		entryLimit: versionCacheEntriesMax,
	}
}

func (c *rendererVersionCache) get(key string, now time.Time) (string, bool) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	element, found := c.entries[key]
	if !found {
		return "", false
	}
	entry := element.Value.(*rendererVersionCacheEntry)
	if !now.Before(entry.expiresAt) {
		delete(c.entries, key)
		c.recent.Remove(element)
		return "", false
	}
	c.recent.MoveToFront(element)
	return entry.version, true
}

func (c *rendererVersionCache) put(key, version string, expiresAt time.Time) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	if element, found := c.entries[key]; found {
		entry := element.Value.(*rendererVersionCacheEntry)
		entry.version = version
		entry.expiresAt = expiresAt
		c.recent.MoveToFront(element)
		return
	}
	element := c.recent.PushFront(&rendererVersionCacheEntry{key: key, version: version, expiresAt: expiresAt})
	c.entries[key] = element
	if c.recent.Len() <= c.entryLimit {
		return
	}
	oldest := c.recent.Back()
	delete(c.entries, oldest.Value.(*rendererVersionCacheEntry).key)
	c.recent.Remove(oldest)
}
