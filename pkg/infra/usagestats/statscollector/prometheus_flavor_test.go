package statscollector

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/stats/statstest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDetectPrometheusVariant(t *testing.T) {
	vanilla := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprint(w, `{"status":"success","data":{"version":"","revision":"","branch":"","buildUser":"","buildDate":"","goVersion":"go1.17.6"}}`)
	}))
	t.Cleanup(vanilla.Close)

	mimir := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprint(w, `{"status":"success","data":{"application":"Grafana Mimir","version":"2.0.0","revision":"9fd2da5","branch":"HEAD","goVersion":"go1.17.8","features":{"ruler_config_api":"true","alertmanager_config_api":"true","query_sharding":"false","federated_rules":"false"}}}`)
	}))
	t.Cleanup(mimir.Close)

	cortex := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(cortex.Close)

	// Amazon Prometheus is Cortex-like
	amazonPrometheus := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(amazonPrometheus.Close)

	// Azure Prometheus is Cortex-like
	azurePrometheus := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(azurePrometheus.Close)

	sqlStore := dbtest.NewFakeDB()
	statsService := statstest.NewFakeService()
	s := createService(
		t,
		setting.NewCfg(),
		sqlStore,
		statsService,
		withDatasources(mockDatasourceService{datasources: []*datasources.DataSource{
			{
				ID:      1,
				UID:     "vanilla",
				OrgID:   1,
				Version: 1,
				Name:    "Vanilla",
				Type:    "prometheus",
				Access:  "proxy",
				URL:     vanilla.URL,
			},
			{
				ID:      2,
				UID:     "mimir",
				OrgID:   1,
				Version: 1,
				Name:    "Mimir",
				Type:    "prometheus",
				Access:  "proxy",
				URL:     mimir.URL,
			},
			{
				ID:      3,
				UID:     "another-mimir",
				OrgID:   1,
				Version: 1,
				Name:    "Another Mimir",
				Type:    "prometheus",
				Access:  "proxy",
				URL:     mimir.URL,
			},
			{
				ID:      4,
				UID:     "cortex",
				OrgID:   1,
				Version: 1,
				Name:    "Cortex",
				Type:    "prometheus",
				Access:  "proxy",
				URL:     cortex.URL,
			},
			{
				ID:      5,
				UID:     "amazon-prometheus",
				OrgID:   1,
				Version: 1,
				Name:    "Amazon Prometheus",
				Type:    "prometheus",
				Access:  "proxy",
				URL:     amazonPrometheus.URL,
			},
			{
				ID:      6,
				UID:     "azure-prometheus",
				OrgID:   1,
				Version: 1,
				Name:    "Azure Prometheus",
				Type:    "prometheus",
				Access:  "proxy",
				URL:     azurePrometheus.URL,
			},
		}}),
	)

	flavors, err := s.detectPrometheusVariants(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int64(2), flavors["mimir"])
	assert.Equal(t, int64(1), flavors["vanilla"])
	assert.Equal(t, int64(3), flavors["cortex-like"])
}
