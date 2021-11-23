package cloudmonitoring

import (
	"encoding/json"
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

func fakeResponseFn(input []byte) ([]byte, error) {
	return input, nil
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
	s := Service{}

	rw := httptest.NewRecorder()
	res := s.doRequest(rw, req, srv.Client(), fakeResponseFn)
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

func Test_processData_functions(t *testing.T) {
	// metricDescriptors
	metricDescriptorResp := metricDescriptorResponse{
		Descriptors: []metricDescriptor{
			{
				ValueType:        "INT64",
				MetricKind:       "DELTA",
				Type:             "actions.googleapis.com/smarthome_action/local_event_count",
				Unit:             "1",
				Service:          "foo",
				ServiceShortName: "bar",
				DisplayName:      "Local event count",
				Description:      "baz",
			},
		},
	}
	marshaledMDResponse, _ := json.Marshal(metricDescriptorResp)
	metricDescriptorResult := []metricDescriptor{
		{
			ValueType:        "INT64",
			MetricKind:       "DELTA",
			Type:             "actions.googleapis.com/smarthome_action/local_event_count",
			Unit:             "1",
			Service:          "actions.googleapis.com",
			ServiceShortName: "actions",
			DisplayName:      "Local event count",
			Description:      "baz",
		},
	}
	marshaledMDResult, _ := json.Marshal(metricDescriptorResult)

	// services
	serviceResp := serviceResponse{
		Services: []serviceDescription{
			{
				Name:        "blah/foo",
				DisplayName: "bar",
			},
			{
				Name:        "abc",
				DisplayName: "",
			},
		},
	}
	marshaledServiceResponse, _ := json.Marshal(serviceResp)
	serviceResult := []selectableValue{
		{
			Value: "foo",
			Label: "bar",
		},
		{
			Value: "abc",
			Label: "abc",
		},
	}
	marshaledServiceResult, _ := json.Marshal(serviceResult)

	// slos
	sloResp := sloResponse{
		SLOs: []sloDescription{
			{
				Name:        "blah/foo",
				DisplayName: "bar",
				Goal:        0.1,
			},
			{
				Name:        "abc",
				DisplayName: "xyz",
				Goal:        0.2,
			},
		},
	}
	marshaledSLOResponse, _ := json.Marshal(sloResp)
	sloResult := []selectableValue{
		{
			Value: "foo",
			Label: "bar",
			Goal:  0.1,
		},
		{
			Value: "abc",
			Label: "xyz",
			Goal:  0.2,
		},
	}
	marshaledSLOResult, _ := json.Marshal(sloResult)

	// cloudresourcemanager
	cloudResourceResp := projectResponse{
		Projects: []projectDescription{
			{
				ProjectID: "foo",
				Name:      "bar",
			},
			{
				ProjectID: "abc",
				Name:      "abc",
			},
		},
	}
	marshaledCRResponse, _ := json.Marshal(cloudResourceResp)

	tests := []struct {
		name       string
		responseFn processResponse
		input      []byte
		result     []byte
	}{
		{
			"metricDescriptor",
			processMetricDescriptors,
			marshaledMDResponse,
			marshaledMDResult,
		},
		{
			"services",
			processServices,
			marshaledServiceResponse,
			marshaledServiceResult,
		},
		{
			"slos",
			processSLOs,
			marshaledSLOResponse,
			marshaledSLOResult,
		},
		{
			"cloudresourcemanager",
			processProjects,
			marshaledCRResponse,
			marshaledServiceResult,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			res, err := test.responseFn(test.input)
			if err != nil {
				t.Errorf("Unexpected error %v", err)
			}
			if string(test.result) != string(res) {
				t.Errorf("Unexpected result. Got %s, expecting %s", res, test.result)
			}
		})
	}
}
