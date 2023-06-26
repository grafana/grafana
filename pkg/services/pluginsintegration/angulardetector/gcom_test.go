package angulardetector

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
)

var mockGCOMResponse = []byte(`[{
	"name": "PanelCtrl",
	"type": "contains",
	"pattern": "PanelCtrl"
},
{
    "name": "QueryCtrl",
    "type": "regex",
    "pattern": "[\"']QueryCtrl[\"']"
}]`)

func mockGCOMHTTPHandlerFunc(writer http.ResponseWriter, request *http.Request) {
	if request.URL.Path != "/api/plugins/angular_patterns" {
		writer.WriteHeader(http.StatusNotFound)
		return
	}
	_, _ = writer.Write(mockGCOMResponse)
}

func checkMockGCOMResponse(t *testing.T, detectors []angulardetector.AngularDetector) {
	require.Len(t, detectors, 2)
	d, ok := detectors[0].(*angulardetector.ContainsBytesDetector)
	require.True(t, ok)
	require.Equal(t, []byte(`PanelCtrl`), d.Pattern)
	rd, ok := detectors[1].(*angulardetector.RegexDetector)
	require.True(t, ok)
	require.Equal(t, `["']QueryCtrl["']`, rd.Regex.String())
}

type gcomScenario struct {
	gcomHTTPHandlerFunc http.HandlerFunc
	gcomHTTPCalls       int
}

func (s *gcomScenario) newHTTPTestServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.gcomHTTPCalls++
		s.gcomHTTPHandlerFunc(w, r)
	}))
}

func newDefaultGCOMScenario() *gcomScenario {
	return &gcomScenario{gcomHTTPHandlerFunc: mockGCOMHTTPHandlerFunc}
}

func TestGCOMDetectorsProvider(t *testing.T) {
	t.Run("returns value returned from gcom api", func(t *testing.T) {
		scenario := newDefaultGCOMScenario()
		srv := scenario.newHTTPTestServer()
		t.Cleanup(srv.Close)
		gcomProvider, err := NewGCOMDetectorsProvider(srv.URL)
		require.NoError(t, err)
		detectors := gcomProvider.ProvideDetectors(context.Background())
		require.Equal(t, 1, scenario.gcomHTTPCalls, "gcom api should be called")
		checkMockGCOMResponse(t, detectors)
	})

	t.Run("error handling", func(t *testing.T) {
		for _, tc := range []struct {
			*gcomScenario
			name string
		}{
			{name: "http error 500", gcomScenario: &gcomScenario{
				gcomHTTPHandlerFunc: func(writer http.ResponseWriter, request *http.Request) {
					writer.WriteHeader(http.StatusInternalServerError)
				},
			}},
			{name: "invalid json", gcomScenario: &gcomScenario{
				gcomHTTPHandlerFunc: func(writer http.ResponseWriter, request *http.Request) {
					_, _ = writer.Write([]byte(`not json`))
				},
			}},
			{name: "invalid regex", gcomScenario: &gcomScenario{
				gcomHTTPHandlerFunc: func(writer http.ResponseWriter, request *http.Request) {
					_, _ = writer.Write([]byte(`[{"name": "test", "type": "regex", "pattern": "((("}]`))
				},
			}},
		} {
			t.Run(tc.name, func(t *testing.T) {
				srv := tc.newHTTPTestServer()
				t.Cleanup(srv.Close)
				gcomProvider, err := NewGCOMDetectorsProvider(srv.URL)
				require.NoError(t, err)
				detectors := gcomProvider.ProvideDetectors(context.Background())
				require.Equal(t, 1, tc.gcomHTTPCalls, "gcom should be called")
				require.Empty(t, detectors, "returned AngularDetectors should be empty")
			})
		}
	})

	t.Run("handles gcom timeout", func(t *testing.T) {
		gcomScenario := &gcomScenario{
			gcomHTTPHandlerFunc: func(writer http.ResponseWriter, request *http.Request) {
				time.Sleep(time.Second * 1)
				_, _ = writer.Write([]byte(`[{"name": "test", "type": "regex", "pattern": "((("}]`))
			},
		}
		srv := gcomScenario.newHTTPTestServer()
		t.Cleanup(srv.Close)
		gcomProvider, err := NewGCOMDetectorsProvider(srv.URL)
		require.NoError(t, err)
		// Expired context
		ctx, canc := context.WithTimeout(context.Background(), time.Second*-1)
		defer canc()
		detectors := gcomProvider.ProvideDetectors(ctx)
		require.Zero(t, gcomScenario.gcomHTTPCalls, "gcom should be not called due to request timing out")
		require.Empty(t, detectors, "returned AngularDetectors should be empty")
	})

	t.Run("unknown pattern types do not break decoding", func(t *testing.T) {
		// Tests that we can introduce new pattern types in the future without breaking old Grafana versions.

		scenario := gcomScenario{gcomHTTPHandlerFunc: func(writer http.ResponseWriter, request *http.Request) {
			_, _ = writer.Write([]byte(`[
				{"name": "PanelCtrl", "type": "contains", "pattern": "PanelCtrl"},
				{"name": "Another", "type": "unknown", "pattern": "PanelCtrl"}
			]`))
		}}
		srv := scenario.newHTTPTestServer()
		t.Cleanup(srv.Close)
		gcomProvider, err := NewGCOMDetectorsProvider(srv.URL)
		require.NoError(t, err)
		detectors := gcomProvider.ProvideDetectors(context.Background())
		require.Equal(t, 1, scenario.gcomHTTPCalls, "gcom should be called")
		require.Len(t, detectors, 1, "should have decoded only 1 AngularDetector")
		d, ok := detectors[0].(*angulardetector.ContainsBytesDetector)
		require.True(t, ok, "decoded pattern should be of the correct type")
		require.Equal(t, []byte("PanelCtrl"), d.Pattern, "decoded value for known pattern should be correct")
	})
}
