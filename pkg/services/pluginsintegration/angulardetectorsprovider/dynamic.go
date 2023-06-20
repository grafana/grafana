package angulardetectorsprovider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angularpatternsstore"
	"github.com/grafana/grafana/pkg/setting"
)

const cacheTTL = time.Hour * 1

type Dynamic struct {
	log   log.Logger
	store *angularpatternsstore.Service

	httpClient *http.Client
	baseURL    string

	detectors []angulardetector.Detector
	mux       sync.Mutex
}

func ProvideDynamic(cfg *setting.Cfg, store *angularpatternsstore.Service) (*Dynamic, error) {
	cl, err := httpclient.New()
	if err != nil {
		return nil, fmt.Errorf("httpclient new: %w", err)
	}
	return &Dynamic{
		log:        log.New("plugins.angulardetector.gcom"),
		store:      store,
		httpClient: cl,
		baseURL:    cfg.GrafanaComURL,
	}, nil
}

// fetch fetches the angular patterns from GCOM and returns them as gcomPatterns.
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

func (d *Dynamic) fetchAndStoreDetectors(ctx context.Context) ([]angulardetector.Detector, error) {
	// Fetch patterns from GCOM
	patterns, err := d.fetch(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch: %w", err)
	}

	// Convert the patterns to detectors
	newDetectors, err := patterns.Detectors()
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

func (d *Dynamic) setDetectors(newDetectors []angulardetector.Detector) {
	d.mux.Lock()
	d.detectors = newDetectors
	d.mux.Unlock()
}

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

func (d *Dynamic) Run(ctx context.Context) error {
	lastUpdate, err := d.store.GetLastUpdated(ctx)
	if err != nil {
		return fmt.Errorf("get last updated: %w", err)
	}

	// Determine when next run is, and check if we should run immediately
	nextRunUntil := time.Until(lastUpdate.Add(cacheTTL))
	if nextRunUntil <= 0 {
		d.tryUpdateDetectors(ctx)
		nextRunUntil = cacheTTL
	}

	// Keep running periodically
	ticker := time.NewTicker(nextRunUntil)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			d.tryUpdateDetectors(ctx)
			// Use default TTL if we run with a shorter interval the first time
			ticker.Reset(cacheTTL)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (d *Dynamic) ProvideDetectors(_ context.Context) []angulardetector.Detector {
	d.mux.Lock()
	r := d.detectors
	d.mux.Unlock()
	return r
}
