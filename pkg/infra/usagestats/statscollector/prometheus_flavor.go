package statscollector

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/services/datasources"
)

const promFlavorCacheLifetime = time.Hour

type memoPrometheusFlavor struct {
	variants map[string]int64

	memoized time.Time
}

func (s *Service) collectPrometheusFlavors(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}
	variants, err := s.detectPrometheusVariants(ctx)
	if err != nil {
		return nil, err
	}

	for variant, count := range variants {
		m["stats.ds.prometheus.flavor."+variant+".count"] = count
	}
	return m, nil
}

func (s *Service) detectPrometheusVariants(ctx context.Context) (map[string]int64, error) {
	if s.promFlavorCache.memoized.Add(promFlavorCacheLifetime).After(time.Now()) &&
		s.promFlavorCache.variants != nil {
		return s.promFlavorCache.variants, nil
	}

	dsProm := &datasources.GetDataSourcesByTypeQuery{Type: "prometheus"}
	dataSources, err := s.datasources.GetDataSourcesByType(ctx, dsProm)
	if err != nil {
		s.log.Error("Failed to read all Prometheus data sources", "error", err)
		return nil, err
	}
	dsAmazonProm := &datasources.GetDataSourcesByTypeQuery{Type: "grafana-amazonprometheus-datasource"}
	dataSourcesAmazonProm, err := s.datasources.GetDataSourcesByType(ctx, dsAmazonProm)
	if err != nil {
		s.log.Error("Failed to read all Amazon Prometheus data sources", "error", err)
		return nil, err
	}
	dsAzureProm := &datasources.GetDataSourcesByTypeQuery{Type: "grafana-azureprometheus-datasource"}
	dataSourcesAzureProm, err := s.datasources.GetDataSourcesByType(ctx, dsAzureProm)
	if err != nil {
		s.log.Error("Failed to read all Azure Prometheus data sources", "error", err)
		return nil, err
	}

	allPromDataSources := append(append(dataSources, dataSourcesAmazonProm...), dataSourcesAzureProm...)

	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(10)
	flavors := sync.Map{}

	for _, ds := range allPromDataSources {
		ds := ds
		g.Go(func() error {
			variant, err := s.detectPrometheusVariant(ctx, ds)
			if err != nil {
				return err
			}
			flavors.Store(ds.UID, variant)
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}

	variants := map[string]int64{}

	flavors.Range(func(_, value any) bool {
		variant, ok := value.(string)
		if !ok {
			return true
		}

		if variant == "" {
			return true
		}

		if _, exists := variants[variant]; !exists {
			variants[variant] = 0
		}
		variants[variant] += 1
		return true
	})

	s.promFlavorCache.variants = variants
	s.promFlavorCache.memoized = time.Now()
	return variants, nil
}

func (s *Service) detectPrometheusVariant(ctx context.Context, ds *datasources.DataSource) (string, error) {
	// 5s timeout
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	type buildInfo struct {
		Data struct {
			Application *string        `json:"application"`
			Features    map[string]any `json:"features"`
		} `json:"data"`
	}
	c, err := s.datasources.GetHTTPTransport(ctx, ds, s.httpClientProvider)
	if err != nil {
		s.log.Error("Failed to get HTTP client for Prometheus data source", "error", err)
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ds.URL+"/api/v1/status/buildinfo", nil)
	if err != nil {
		s.log.Error("Failed to create Prometheus build info request", "error", err)
		return "", err
	}

	resp, err := c.RoundTrip(req)
	if err != nil {
		// Possibly configuration error, the risk of a false positive is
		// too high.
		s.log.Debug("Failed to send Prometheus build info request", "error", err)
		return "unreachable", nil
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

	body, err := io.ReadAll(resp.Body)
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
