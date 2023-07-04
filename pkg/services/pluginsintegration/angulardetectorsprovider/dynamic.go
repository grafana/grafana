package angulardetectorsprovider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularpatternsstore"
)

const (
	defaultBackgroundJobInterval = time.Hour * 1

	cacheRestoreTimeout = time.Second * 10
	gcomFetchTimeout    = time.Minute * 1
)

// Dynamic is an angulardetector.DetectorsProvider that calls GCOM to get Angular detection patterns,
// converts them to detectors and caches them for all future calls.
// It also provides a background service that will periodically refresh the patterns from GCOM.
// If the feature flag FlagPluginsDynamicAngularDetectionPatterns is disabled, the background service is disabled.
type Dynamic struct {
	log      log.Logger
	features featuremgmt.FeatureToggles

	httpClient http.Client
	baseURL    string

	// store is the underlying angular patterns store used as a cache.
	store angularpatternsstore.Service

	// detectors contains the cached angular detectors, which are created from the remote angular patterns.
	// Use setDetectors and ProvideDetectors to write/read this value.
	detectors []angulardetector.AngularDetector

	// mux is the mutex used to read/write the cached detectors in a concurrency-safe way.
	mux sync.RWMutex

	// backgroundJobInterval is the interval between the periodic background job calls.
	backgroundJobInterval time.Duration
}

func ProvideDynamic(cfg *config.Cfg, store angularpatternsstore.Service, features featuremgmt.FeatureToggles) (*Dynamic, error) {
	d := &Dynamic{
		log:                   log.New("plugin.angulardetectorsprovider.dynamic"),
		features:              features,
		store:                 store,
		httpClient:            makeHttpClient(),
		baseURL:               cfg.GrafanaComURL,
		backgroundJobInterval: defaultBackgroundJobInterval,
	}

	// Perform the initial restore from db without blocking
	d.mux.Lock()
	go func() {
		d.log.Debug("Restoring cache")
		ctx, canc := context.WithTimeout(context.Background(), cacheRestoreTimeout)
		defer canc()
		if err := d.setDetectorsFromCache(ctx); err != nil {
			d.log.Warn("Cache restore failed", "error", err)
		}
		d.mux.Unlock()
	}()

	return d, nil
}

// patternsToDetectors converts a slice of gcomPattern into a slice of angulardetector.AngularDetector, by calling
// angularDetector() on each gcomPattern.
func (d *Dynamic) patternsToDetectors(patterns GCOMPatterns) ([]angulardetector.AngularDetector, error) {
	var finalErr error
	detectors := make([]angulardetector.AngularDetector, 0, len(patterns))
	for _, pattern := range patterns {
		ad, err := pattern.angularDetector()
		if err != nil {
			// Fail silently in case of an errUnknownPatternType.
			// This allows us to introduce new pattern types without breaking old Grafana versions
			if errors.Is(err, errUnknownPatternType) {
				d.log.Debug("Unknown angular pattern", "name", pattern.Name, "type", pattern.Type, "error", err)
				continue
			}
			// Other error, do not ignore it
			finalErr = errors.Join(finalErr, err)
		}
		detectors = append(detectors, ad)
	}
	if finalErr != nil {
		return nil, finalErr
	}
	return detectors, nil
}

// fetch fetches the angular patterns from GCOM and returns them as GCOMPatterns.
// Call detectors() on the returned value to get the corresponding detectors.
func (d *Dynamic) fetch(ctx context.Context) (GCOMPatterns, error) {
	st := time.Now()

	reqURL, err := url.JoinPath(d.baseURL, gcomAngularPatternsPath)
	if err != nil {
		return nil, fmt.Errorf("url joinpath: %w", err)
	}

	d.log.Debug("Fetching dynamic angular detection patterns", "url", reqURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("new request with context: %w", err)
	}
	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http do: %w", err)
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			d.log.Error("Response body close error", "error", err)
		}
	}()
	var out GCOMPatterns
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("json decode: %w", err)
	}
	d.log.Debug("Fetched dynamic angular detection patterns", "patterns", len(out), "duration", time.Since(st))
	return out, nil
}

// setDetectors sets the detectors by acquiring the lock first.
func (d *Dynamic) setDetectors(newDetectors []angulardetector.AngularDetector) {
	d.mux.Lock()
	d.detectors = newDetectors
	d.mux.Unlock()
}

// updateDetectors fetches the patterns from GCOM, converts them to detectors,
// stores the patterns in the database and update the cached detectors.
func (d *Dynamic) updateDetectors(ctx context.Context) error {
	// Fetch patterns from GCOM
	patterns, err := d.fetch(ctx)
	if err != nil {
		return fmt.Errorf("fetch: %w", err)
	}

	// Convert the patterns to detectors
	newDetectors, err := d.patternsToDetectors(patterns)
	if err != nil {
		return fmt.Errorf("patterns convert to detectors: %w", err)
	}

	// Update store only if the patterns can be converted to detectors
	if err := d.store.Set(ctx, patterns); err != nil {
		return fmt.Errorf("store set: %w", err)
	}

	// Update cached detectors
	d.setDetectors(newDetectors)
	return nil
}

// setDetectorsFromCache sets the in-memory detectors from the patterns in the store.
// The caller must Lock d.mux before calling this function.
func (d *Dynamic) setDetectorsFromCache(ctx context.Context) error {
	var cachedPatterns GCOMPatterns
	rawCached, ok, err := d.store.Get(ctx)
	if !ok {
		// No cached value found, do not alter in-memory detectors
		return nil
	}
	if err != nil {
		return fmt.Errorf("get cached value: %w", err)
	}
	// Try to unmarshal, convert to detectors and set local cache
	if err := json.Unmarshal([]byte(rawCached), &cachedPatterns); err != nil {
		return fmt.Errorf("json unmarshal: %w", err)
	}
	cachedDetectors, err := d.patternsToDetectors(cachedPatterns)
	if err != nil {
		return fmt.Errorf("convert to detectors: %w", err)
	}
	// Do not use setDetectors or it will cause a deadlock
	d.detectors = cachedDetectors
	return nil
}

// IsDisabled returns true if FlagPluginsDynamicAngularDetectionPatterns is not enabled.
func (d *Dynamic) IsDisabled() bool {
	return !d.features.IsEnabled(featuremgmt.FlagPluginsDynamicAngularDetectionPatterns)
}

// Run is the function implementing the background service and updates the detectors periodically.
func (d *Dynamic) Run(ctx context.Context) error {
	d.log.Debug("Started background service")

	// Determine when next run is, and check if we should run immediately
	lastUpdate, err := d.store.GetLastUpdated(ctx)
	if err != nil {
		return fmt.Errorf("get last updated: %w", err)
	}
	nextRunUntil := time.Until(lastUpdate.Add(d.backgroundJobInterval))

	ticker := time.NewTicker(d.backgroundJobInterval)
	defer ticker.Stop()

	var tick <-chan time.Time
	if nextRunUntil <= 0 {
		// Do first run immediately
		firstTick := make(chan time.Time, 1)
		tick = firstTick

		firstTick <- time.Now()
	} else {
		// Do first run after a certain amount of time
		ticker.Reset(nextRunUntil)
		tick = ticker.C
	}

	// Keep running periodically
	for {
		select {
		case <-tick:
			st := time.Now()
			d.log.Debug("Updating patterns")

			opCtx, canc := context.WithTimeout(ctx, gcomFetchTimeout)
			if err := d.updateDetectors(opCtx); err != nil {
				d.log.Error("Error while updating detectors", "error", err)
			}
			canc()
			d.log.Debug("Patterns update finished", "duration", time.Since(st))

			// Restore default ticker if we run with a shorter interval the first time
			ticker.Reset(d.backgroundJobInterval)
			tick = ticker.C
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// ProvideDetectors returns the cached detectors. It returns an empty slice if there's no value.
func (d *Dynamic) ProvideDetectors(_ context.Context) []angulardetector.AngularDetector {
	d.mux.RLock()
	r := d.detectors
	d.mux.RUnlock()
	return r
}

// Same configuration as pkg/plugins/repo/client.go
func makeHttpClient() http.Client {
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return http.Client{
		Timeout:   10 * time.Second,
		Transport: tr,
	}
}
