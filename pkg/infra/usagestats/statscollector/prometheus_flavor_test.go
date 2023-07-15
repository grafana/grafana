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
				OrgID:   1,
				Version: 1,
				Name:    "Vanilla",
				Type:    "prometheus",
				Access:  "proxy",
				URL:     vanilla.URL,
			},
			{
				ID:      2,
				OrgID:   1,
				Version: 1,
				Name:    "Mimir",
				Type:    "prometheus",
				Access:  "proxy",
				URL:     mimir.URL,
			},
			{
				ID:      3,
				OrgID:   1,
				Version: 1,
				Name:    "Another Mimir",
				Type:    "prometheus",
				Access:  "proxy",
				URL:     mimir.URL,
			},
			{
				ID:      4,
				OrgID:   1,
				Version: 1,
				Name:    "Cortex",
				Type:    "prometheus",
				Access:  "proxy",
				URL:     cortex.URL,
			},
		}}),
	)

	flavors, err := s.detectPrometheusVariants(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int64(2), flavors["mimir"])
	assert.Equal(t, int64(1), flavors["vanilla"])
	assert.Equal(t, int64(1), flavors["cortex-like"])
}
