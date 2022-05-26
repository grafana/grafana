package statscollector

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

const promFlavorCacheLifetime = time.Hour

type memoPrometheusFlavor struct {
	variants map[string]int64

	memoized time.Time
}

func (s *Service) detectPrometheusVariants(ctx context.Context) (map[string]int64, error) {
	if s.promFlavorCache.memoized.Add(promFlavorCacheLifetime).After(time.Now()) &&
		s.promFlavorCache.variants != nil {
		return s.promFlavorCache.variants, nil
	}

	dsProm := &models.GetDataSourcesByTypeQuery{Type: "prometheus"}
	err := s.datasources.GetDataSourcesByType(ctx, dsProm)
	if err != nil {
		s.log.Error("Failed to read all Prometheus data sources", "error", err)
		return nil, err
	}

	variants := map[string]int64{}
	for _, ds := range dsProm.Result {
		variant, err := s.detectPrometheusVariant(ctx, ds)
		if err != nil {
			return nil, err
		}
		if variant == "" {
			continue
		}

		if _, exists := variants[variant]; !exists {
			variants[variant] = 0
		}
		variants[variant] += 1
	}

	s.promFlavorCache.variants = variants
	s.promFlavorCache.memoized = time.Now()
	return variants, nil
}

func (s *Service) detectPrometheusVariant(ctx context.Context, ds *models.DataSource) (string, error) {
	type buildInfo struct {
		Data struct {
			Application *string                `json:"application"`
			Features    map[string]interface{} `json:"features"`
		} `json:"data"`
	}

	c, err := s.datasources.GetHTTPTransport(ctx, ds, s.httpClientProvider)
	if err != nil {
		s.log.Error("Failed to get HTTP client for Prometheus data source", "error", err)
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ds.Url+"/api/v1/status/buildinfo", nil)
	if err != nil {
		s.log.Error("Failed to create Prometheus build info request", "error", err)
		return "", err
	}

	resp, err := c.RoundTrip(req)
	if err != nil {
		// Possibly configuration error, the risk of a false positive is
		// too high.
		s.log.Debug("Failed to send Prometheus build info request", "error", err)
		return "", nil
	}
	defer func() {
		err := resp.Body.Close()
		if err != nil {
			s.log.Error("Got error while closing response body")
		}
	}()

	if resp.StatusCode == 404 {
		return "cortex-like", nil
	}

	if resp.StatusCode != 200 {
		return "unknown", nil
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		s.log.Error("Failed to read Prometheus build info", "error", err)
		return "", err
	}

	bi := &buildInfo{}
	err = json.Unmarshal(body, bi)
	if err != nil {
		s.log.Warn("Failed to read Prometheus build info JSON", "error", err)
		return "", err
	}

	if bi.Data.Application != nil && *bi.Data.Application == "Grafana Mimir" {
		return "mimir", nil
	}

	if bi.Data.Features != nil {
		return "mimir-like", nil
	}

	return "vanilla", nil
}
