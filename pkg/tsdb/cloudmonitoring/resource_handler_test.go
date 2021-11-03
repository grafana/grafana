package cloudmonitoring

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/stretchr/testify/require"
)

func Test_parseResourcePath(t *testing.T) {
	tests := []struct {
		name           string
		original       string
		expectedTarget string
		Err            require.ErrorAssertionFunc
	}{
		{
			"Path with a subscription",
			"/cloudmonitoring/v3/projects/foo",
			"/v3/projects/foo",
			require.NoError,
		},
		{
			"Malformed path",
			"/projects?foo",
			"",
			require.Error,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target, err := getTarget(tt.original)
			if target != tt.expectedTarget {
				t.Errorf("Unexpected target %s expecting %s", target, tt.expectedTarget)
			}
			tt.Err(t, err)
		})
	}
}

func Test_doRequest(t *testing.T) {
	// test that it forwards the header and body
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("foo", "bar")
		_, err := w.Write([]byte("result"))
		if err != nil {
			t.Fatal(err)
		}
	}))
	req, err := http.NewRequest(http.MethodGet, srv.URL, nil)
	if err != nil {
		t.Error(err)
	}
	rw := httptest.NewRecorder()
	res := doRequest(rw, req, srv.Client())
	if res.Header().Get("foo") != "bar" {
		t.Errorf("Unexpected headers: %v", res.Header())
	}
	result := rw.Result()
	body, err := ioutil.ReadAll(result.Body)
	if err != nil {
		t.Error(err)
	}
	err = result.Body.Close()
	if err != nil {
		t.Error(err)
	}
	if string(body) != "result" {
		t.Errorf("Unexpected body: %v", string(body))
	}
}

type fakeInstance struct {
	services map[string]datasourceService
}

func (f *fakeInstance) Get(pluginContext backend.PluginContext) (instancemgmt.Instance, error) {
	return &datasourceInfo{
		services: f.services,
	}, nil
}

func (f *fakeInstance) Do(pluginContext backend.PluginContext, fn instancemgmt.InstanceCallbackFunc) error {
	return nil
}

func Test_setRequestVariables(t *testing.T) {
	s := Service{
		im: &fakeInstance{
			services: map[string]datasourceService{
				cloudMonitor: {
					url:    routes[cloudMonitor].url,
					client: &http.Client{},
				},
			},
		},
	}
	req, err := http.NewRequest(http.MethodGet, "http://foo/cloudmonitoring/v3/projects/bar/metricDescriptors", nil)
	if err != nil {
		t.Fatalf("Unexpected error %v", err)
	}
	_, _, err = s.setRequestVariables(req, cloudMonitor)
	if err != nil {
		t.Fatalf("Unexpected error %v", err)
	}
	expectedURL := "https://monitoring.googleapis.com/v3/projects/bar/metricDescriptors"
	if req.URL.String() != expectedURL {
		t.Errorf("Unexpected result URL. Got %s, expecting %s", req.URL.String(), expectedURL)
	}
}
