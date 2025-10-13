package angulardetectorsprovider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularpatternsstore"
	"github.com/grafana/grafana/pkg/setting"
)

var errNotModified = errors.New("not modified")

// Intervals that passes between background job runs.
// Can be overwritten in tests.
var (
	backgroundJobIntervalOnPrem = time.Hour * 24
	backgroundJobIntervalCloud  = time.Hour * 1
)

// Dynamic is an angulardetector.DetectorsProvider that calls GCOM to get Angular detection patterns,
// converts them to detectors and caches them for all future calls.
// It also provides a background service that will periodically refresh the patterns from GCOM.
type Dynamic struct {
	log log.Logger

	httpClient http.Client
	baseURL    string
	disabled   bool

	// store is the underlying angular patterns store used as a cache.
	store angularpatternsstore.Service

	// detectors contains the cached angular detectors, which are created from the remote angular patterns.
	// mux should be acquired before reading from/writing to this field.
	detectors []angulardetector.AngularDetector

	// mux is the mutex used to read/write the cached detectors in a concurrency-safe way.
	mux sync.RWMutex

	// backgroundJobInterval is the interval that passes between background job runs.
	backgroundJobInterval time.Duration
}

func ProvideDynamic(cfg *setting.Cfg, store angularpatternsstore.Service) (*Dynamic, error) {
	backgroundJobInterval := backgroundJobIntervalOnPrem
	if cfg.StackID != "" {
		// Use a shorter interval for cloud.
		// (in cloud, cfg.StackID is always set).
		backgroundJobInterval = backgroundJobIntervalCloud
	}

	d := &Dynamic{
		log:                   log.New("plugin.angulardetectorsprovider.dynamic"),
		store:                 store,
		httpClient:            makeHttpClient(),
		baseURL:               cfg.GrafanaComAPIURL,
		backgroundJobInterval: backgroundJobInterval,
		// Disable the background service if the user has opted out of plugin updates.
		// (useful for air-gapped installations)
		disabled: !cfg.CheckForPluginUpdates,
	}
	d.log.Debug("Providing dynamic angular detection patterns", "baseURL", d.baseURL, "interval", d.backgroundJobInterval)

	// Perform the initial restore from db
	st := time.Now()
	d.log.Debug("Restoring cache")
	d.mux.Lock()
	if err := d.setDetectorsFromCache(context.Background()); err != nil {
		d.log.Warn("Cache restore failed", "error", err)
	} else {
		d.log.Info("Restored cache from database", "duration", time.Since(st))
	}
	d.mux.Unlock()
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

type GCOMResponse struct {
	Patterns GCOMPatterns
	ETag     string
}

// fetch fetches the angular patterns from GCOM and returns them as GCOMPatterns.
// Call detectors() on the returned value to get the corresponding detectors.
// If etag is not empty, it will be sent as If-None-Match header.
// If the response status code is 304, it returns errNotModified.
func (d *Dynamic) fetch(ctx context.Context, etag string) (GCOMResponse, error) {
	st := time.Now()

	reqURL, err := url.JoinPath(d.baseURL, gcomAngularPatternsPath)
	if err != nil {
		return GCOMResponse{}, fmt.Errorf("url joinpath: %w", err)
	}

	d.log.Debug("Fetching dynamic angular detection patterns", "url", reqURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return GCOMResponse{}, fmt.Errorf("new request with context: %w", err)
	}
	if etag != "" {
		req.Header.Add("If-None-Match", etag)
	}

	var r GCOMResponse
	resp, err := d.httpClient.Do(req)
	if err != nil {
		return GCOMResponse{}, fmt.Errorf("http do: %w", err)
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			d.log.Error("Response body close error", "error", err)
		}
	}()
	if resp.StatusCode == http.StatusNotModified {
		return GCOMResponse{}, errNotModified
	}
	if resp.StatusCode/100 != 2 {
		return GCOMResponse{}, fmt.Errorf("bad status code: %d", resp.StatusCode)
	}
	if err := json.NewDecoder(resp.Body).Decode(&r.Patterns); err != nil {
		return GCOMResponse{}, fmt.Errorf("json decode: %w", err)
	}
	r.ETag = resp.Header.Get("ETag")
	d.log.Debug("Fetched dynamic angular detection patterns", "patterns", len(r.Patterns), "duration", time.Since(st))
	return r, nil
}

// updateDetectors fetches the patterns from GCOM, converts them to detectors,
// stores the patterns in the database and update the cached detectors.
func (d *Dynamic) updateDetectors(ctx context.Context, etag string) error {
	// Fetch patterns from GCOM
	d.mux.Lock()
	defer d.mux.Unlock()

	resp, err := d.fetch(ctx, etag)
	switch {
	case err == nil:
		break
	case errors.Is(err, errNotModified):
		// If patterns did not change, update the last updated anyways,
		// so we don't keep trying to fetch them, but update the in-memory
		// detectors from the previously stored value.
		d.log.Debug("Not modified, skipping update")
		if err := d.store.SetLastUpdated(ctx); err != nil {
			return fmt.Errorf("set last updated: %w", err)
		}
		// Update in-memory detectors, by reading current value in the kvstore
		if err := d.setDetectorsFromCache(ctx); err != nil {
			return fmt.Errorf("set detectors from cache: %w", err)
		}
		return nil
	default:
		return fmt.Errorf("fetch: %w", err)
	}
	// Convert the patterns to detectors
	newDetectors, err := d.patternsToDetectors(resp.Patterns)
	if err != nil {
		return fmt.Errorf("patterns convert to detectors: %w", err)
	}

	// Update store only if the patterns can be converted to detectors
	if err := d.store.Set(ctx, resp.Patterns); err != nil {
		return fmt.Errorf("store set: %w", err)
	}
	if err := d.store.SetETag(ctx, resp.ETag); err != nil {
		return fmt.Errorf("store set etag: %w", err)
	}

	// Update cached detectors
	d.detectors = newDetectors
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
	d.detectors = cachedDetectors
	return nil
}

// randomSkew returns a random time.Duration between 0 and maxSkew.
// This can be added to d.backgroundJobInterval to skew it by a random amount.
func (d *Dynamic) randomSkew(maxSkew time.Duration) time.Duration {
	return time.Duration(rand.Float64() * float64(maxSkew))
}

// Run is the function implementing the background service and updates the detectors periodically.
func (d *Dynamic) Run(ctx context.Context) error {
	d.log.Debug("Started background service")

	// Determine when next run is, and check if we should run immediately
	lastUpdate, err := d.store.GetLastUpdated(ctx)
	if err != nil {
		return fmt.Errorf("get last updated: %w", err)
	}

	// Offset the background job interval a bit to skew GCOM calls from all instances,
	// so GCOM is not overwhelmed with lots of requests all at the same time.
	// Important when lots of HG instances restart at the same time.
	skew := d.randomSkew(d.backgroundJobInterval / 4)
	d.backgroundJobInterval += skew
	d.log.Debug(
		"Applied background job skew",
		"skew", d.backgroundJobInterval, "interval", d.backgroundJobInterval,
	)

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
			etag, ok, err := d.store.GetETag(context.Background())
			if err != nil {
				d.log.Error("Error while getting etag", "error", err)
			}
			// Ensure etag is empty if we don't have a value
			if !ok {
				etag = ""
			}
			if err := d.updateDetectors(context.Background(), etag); err != nil {
				d.log.Error("Error while updating detectors", "error", err)
			}
			d.log.Info("Patterns update finished", "duration", time.Since(st))

			// Restore default ticker if we run with a shorter interval the first time
			ticker.Reset(d.backgroundJobInterval)
			tick = ticker.C
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// IsDisabled returns whether the dynamic detectors provider background service is disabled.
func (d *Dynamic) IsDisabled() bool {
	return d.disabled
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

// static checks

var (
	_ registry.BackgroundService = (*Dynamic)(nil)
	_ registry.CanBeDisabled     = (*Dynamic)(nil)
)
