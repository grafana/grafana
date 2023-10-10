package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/web/webtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func BenchmarkPanelTitleSearch(b *testing.B) {
	start := time.Now()
	b.Log("setup start")
	sc := setupDB(b)
	b.Log("setup time:", time.Since(start))

	benchmarks := []struct {
		desc        string
		url         string
		expectedLen int
		features    *featuremgmt.FeatureManager
	}{
		{
			desc:        "search for specific dashboard nested folders feature enabled",
			url:         "/api/search?type=dash-db&query=dashboard_0_0_0_0",
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders, featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "search specific dashboard with nested folders feature disabled",
			url:         "/api/search?type=dash-db&query=dashboard_0_0",
			expectedLen: 1,
			features:    featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery),
		},
		{
			desc:        "search specific panel with nested folders feature disabled and panel title feature enabled / temporary nested feature flag enabled",
			url:         "/api/search?type=dash-db&panelTitle=panel_0_0_0_0",
			expectedLen: 1,
			features: featuremgmt.WithFeatures(
				featuremgmt.FlagNestedFolders,
				featuremgmt.FlagPanelTitleSearchInV1,
				featuremgmt.FlagPermissionsFilterRemoveSubquery,
			),
		},
	}
	for _, bm := range benchmarks {
		b.Run(bm.desc, func(b *testing.B) {
			m := setupServer(b, sc, bm.features)
			req := httptest.NewRequest(http.MethodGet, bm.url, nil)
			req = webtest.RequestWithSignedInUser(req, sc.signedInUser)
			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				rec := httptest.NewRecorder()
				m.ServeHTTP(rec, req)
				require.Equal(b, 200, rec.Code)
				var resp []dtos.FolderSearchHit
				err := json.Unmarshal(rec.Body.Bytes(), &resp)
				require.NoError(b, err)
				assert.Len(b, resp, bm.expectedLen)
			}
		})
	}
}
