package angulardetectorsprovider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularpatternsstore"
)

const defaultCacheTTL = time.Hour * 1

type backgroundJob interface {
	backgroundJob(ctx context.Context)
}

// Dynamic is an angulardetector.DetectorsProvider that calls GCOM to get Angular detection patterns,
// converts them to detectors and caches them for all future calls.
// It also provides a background service that will periodically refresh the patterns from GCOM.
type Dynamic struct {
	log   log.Logger
	store angularpatternsstore.Service

	httpClient *http.Client
	baseURL    string

	cacheTTL time.Duration

	// initialRestoreDone is a channel that will be closed when the first restore from db is done by the
	// background service. It can be used to wait for the first restore to be done by reading a value from this channel.
	initialRestoreDone chan struct{}

	detectors []angulardetector.AngularDetector
	mux       sync.RWMutex

	// bgJob is the implementation of the background job.
	// This is called when scheduled by Run().
	bgJob backgroundJob
}

func ProvideDynamic(cfg *config.Cfg, store angularpatternsstore.Service) (*Dynamic, error) {
	// TODO: standardize gcom client
	cl, err := httpclient.New()
	if err != nil {
		return nil, fmt.Errorf("httpclient new: %w", err)
	}
	d := &Dynamic{
		log:        log.New("plugins.angulardetector.gcom"),
		store:      store,
		httpClient: cl,
		baseURL:    cfg.GrafanaComURL,
		cacheTTL:   defaultCacheTTL,

		initialRestoreDone: make(chan struct{}),
	}
	// By default, use ourselves as bgJob
	d.bgJob = d
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

// fetchAndStoreDetectors fetches the patterns from GCOM, converts them into detectors, stores the new patterns into
// the store and returns the detectors. If the patterns cannot be converted to detectors, the store is not altered.
// The function returns the resulting detectors.
func (d *Dynamic) fetchAndStoreDetectors(ctx context.Context) ([]angulardetector.AngularDetector, error) {
	// Fetch patterns from GCOM
	patterns, err := d.fetch(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch: %w", err)
	}

	// Convert the patterns to detectors
	newDetectors, err := d.patternsToDetectors(patterns)
	if err != nil {
		return nil, fmt.Errorf("patterns convert to detectors: %w", err)
	}

	// Update store only if the patterns can be converted to detectors
	if err := d.store.Set(ctx, patterns); err != nil {
		return nil, fmt.Errorf("store set: %w", err)
	}

	// Return the new detectors
	return newDetectors, nil
}

func (d *Dynamic) setDetectors(newDetectors []angulardetector.AngularDetector) {
	d.mux.Lock()
	d.detectors = newDetectors
	d.mux.Unlock()
}

// tryUpdateDetectors will attempt to fetch the patterns from GCOM, convert them to detectors,
// store the patterns in the database and update the cached detectors.
func (d *Dynamic) tryUpdateDetectors(ctx context.Context) {
	st := time.Now()
	d.log.Debug("Updating patterns")
	defer func() {
		d.log.Debug("Patterns update finished", "duration", time.Since(st))
	}()

	opCtx, canc := context.WithTimeout(ctx, time.Minute*1)
	defer canc()

	// Fetch new patterns from GCOM, store response in db and get the corresponding detectors
	newDetectors, err := d.fetchAndStoreDetectors(opCtx)
	if err != nil {
		d.log.Error("error while updating patterns", "error", err)
		return
	}

	// Update cached detectors
	d.setDetectors(newDetectors)
}

// backgroundJob is the function executed periodically in the background by the background service.
// It calls tryUpdateDetectors.
func (d *Dynamic) backgroundJob(ctx context.Context) {
	d.tryUpdateDetectors(ctx)
}

// setDetectorsFromCache sets the in-memory detectors from the patterns in the store.
func (d *Dynamic) setDetectorsFromCache(ctx context.Context) error {
	var cachedPatterns GCOMPatterns
	rawCached, err := d.store.Get(ctx)
	switch {
	case errors.Is(err, angularpatternsstore.ErrNoCachedValue):
		// Swallow ErrNoCachedValue without changing cache
		return nil
	case err == nil:
		// Try to unmarshal, convert to detectors and set local cache
		if err := json.Unmarshal([]byte(rawCached), &cachedPatterns); err != nil {
			return fmt.Errorf("json unmarshal: %w", err)
		}
		cachedDetectors, err := d.patternsToDetectors(cachedPatterns)
		if err != nil {
			return fmt.Errorf("convert to detectors: %w", err)
		}
		d.setDetectors(cachedDetectors)
		return nil
	default:
		// Other error
		return fmt.Errorf("get cached value: %w", err)
	}
}

// notifyInitialRestoreDone sets the initial restore as "done"
func (d *Dynamic) notifyInitialRestoreDone() {
	// Notify that the initial restore is done (see docstring for d.initialRestoreDone)
	close(d.initialRestoreDone)
}

// Run is the function implementing the background service and updates the detectors periodically.
func (d *Dynamic) Run(ctx context.Context) error {
	// Set initial value by restoring cache
	opCtx, canc := context.WithTimeout(ctx, time.Minute*1)
	if err := d.setDetectorsFromCache(opCtx); err != nil {
		d.log.Warn("Could not set detectors from cache, ignoring cache", "error", err)
	}
	canc()
	d.notifyInitialRestoreDone()

	// Determine when next run is, and check if we should run immediately
	lastUpdate, err := d.store.GetLastUpdated(ctx)
	if err != nil {
		return fmt.Errorf("get last updated: %w", err)
	}
	nextRunUntil := time.Until(lastUpdate.Add(d.cacheTTL))
	if nextRunUntil <= 0 {
		// Do first run immediately
		d.bgJob.backgroundJob(ctx)
		nextRunUntil = d.cacheTTL
	}

	// Keep running periodically
	ticker := time.NewTicker(nextRunUntil)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			d.bgJob.backgroundJob(ctx)
			// Restore default TTL if we run with a shorter interval the first time
			ticker.Reset(d.cacheTTL)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// ProvideDetectors returns the cached detectors. It returns an empty slice if there's no value.
// TODO: remove context here?
func (d *Dynamic) ProvideDetectors(_ context.Context) []angulardetector.AngularDetector {
	// Wait for channel to be closed, which is done after the restore from db is done
	<-d.initialRestoreDone

	d.mux.RLock()
	r := d.detectors
	d.mux.RUnlock()
	return r
}
