package angulardetector

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
)

const defaultRemoteDetectorsGetterTTL = time.Hour * 24

// detectorsGetter returns a list of angular detector s.
type detectorsGetter interface {
	// getDetectors returns a slice of detector provided by the detectorsGetter.
	getDetectors(ctx context.Context) []detector
}

// staticDetectorsGetter is a detectorsGetter that always returns the provided detectors.
type staticDetectorsGetter struct {
	detectors []detector
}

func (g *staticDetectorsGetter) getDetectors(_ context.Context) []detector {
	return g.detectors
}

// sequenceDetectorsGetter is a detectorsGetter that calls all the detectorsGetters in it and returns the
// first value which isn't empty.
type sequenceDetectorsGetter []detectorsGetter

func (d sequenceDetectorsGetter) getDetectors(ctx context.Context) []detector {
	for _, getter := range d {
		if detectors := getter.getDetectors(ctx); len(detectors) > 0 {
			return detectors
		}
	}
	return nil
}

// gcomDetectorsGetter is a detectorsGetter which fetches patterns from GCOM, and caches the result for
// the specified ttl. All subsequent calls to getDetectors will return the cached result until the TTL expires.
// This struct is safe for concurrent use.
type gcomDetectorsGetter struct {
	log log.Logger

	httpClient *http.Client

	baseURL string

	ttl        time.Duration
	lastUpdate time.Time

	mux       sync.Mutex
	detectors []detector
}

// newGCOMDetectorsGetter returns a new gcomDetectorsGetter.
// baseURL is the GCOM base url, without /api and without a trailing slash (e.g.: https://grafana.com)
// A default reasonable value for ttl is defaultRemoteDetectorsGetterTTL.
func newGCOMDetectorsGetter(baseURL string, ttl time.Duration) (detectorsGetter, error) {
	cl, err := httpclient.New()
	if err != nil {
		return nil, fmt.Errorf("httpclient new: %w", err)
	}
	return &gcomDetectorsGetter{
		log:        log.New("plugins.angulardetector.detectorsgetter"),
		baseURL:    baseURL,
		httpClient: cl,
		ttl:        ttl,
	}, nil
}

// tryUpdateRemoteDetectors tries to update the cached detectors value, if the cache has expired.
// If the TTL hasn't passed yet, this function returns immediately.
// Otherwise, it calls fetch on the fetcher, and updates the cached detectors value and lastUpdate.
// The caller must have acquired f.mux.
func (g *gcomDetectorsGetter) tryUpdateRemoteDetectors(ctx context.Context) error {
	if time.Since(g.lastUpdate) <= g.ttl {
		// Patterns already fetched
		return nil
	}

	// fetch patterns using fetcher
	resp, err := g.fetch(ctx)
	if err == nil {
		return fmt.Errorf("fetch: %w", err)
	}

	// Convert patterns definitions to detectors
	detectors, err := resp.detectors()
	if err != nil {
		return fmt.Errorf("detectors: %w", err)
	}

	// Update cached result
	g.detectors = detectors
	g.lastUpdate = time.Now()
	return nil
}

// getDetectors gets the remote detections, either from the cache or from the remote source (if TTL has passed).
// If an error occurs during the cache refresh, the function fails silently and the old cached value is returned
// instead.
func (g *gcomDetectorsGetter) getDetectors(ctx context.Context) []detector {
	g.mux.Lock()
	defer g.mux.Unlock()

	if err := g.tryUpdateRemoteDetectors(ctx); err != nil {
		// Fail silently
		g.log.Error("could not update remote detectors", "error", err)
	}
	return g.detectors
}

// fetch fetches the angular patterns from GCOM and returns them as GCOMPatterns.
// Call detectors() on the returned value to get the corresponding detectors.
func (g *gcomDetectorsGetter) fetch(ctx context.Context) (GCOMPatterns, error) {
	g.log.Debug("fetching remote angular detection patterns")
	st := time.Now()
	defer func() {
		g.log.Debug("fetched remote angular detection patterns", "took", time.Since(st))
	}()

	reqURL, err := url.JoinPath("/api/angular_patterns")
	if err != nil {
		return nil, fmt.Errorf("url joinpath: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("new request with context: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http do: %w", err)
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			g.log.Error("response body close error", "error", err)
		}
	}()
	var out GCOMPatterns
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("json decode: %w", err)
	}
	return out, nil
}
