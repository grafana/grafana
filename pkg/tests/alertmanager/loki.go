package alertmanager

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/grafana/e2e"
)

const (
	defaultLokiImage = "grafana/loki:latest"
	lokiBinary       = "/usr/bin/loki"
	lokiHTTPPort     = 3100
)

// GetDefaultImage returns the Docker image to use to run the Loki..
func GetLokiImage() string {
	if img := os.Getenv("LOKI_IMAGE"); img != "" {
		return img
	}

	return defaultLokiImage
}

type LokiService struct {
	*e2e.HTTPService
}

func NewLokiService(name string, flags, envVars map[string]string) *LokiService {
	svc := &LokiService{
		HTTPService: e2e.NewHTTPService(
			name,
			GetLokiImage(),
			e2e.NewCommandWithoutEntrypoint(lokiBinary, e2e.BuildArgs(flags)...),
			e2e.NewHTTPReadinessProbe(lokiHTTPPort, "/ready", 200, 299),
			lokiHTTPPort,
		),
	}

	svc.SetEnvVars(envVars)

	return svc
}

type LokiClient struct {
	c http.Client
	u *url.URL
}

func NewLokiClient(u string) (*LokiClient, error) {
	pu, err := url.Parse(u)
	if err != nil {
		return nil, err
	}

	return &LokiClient{
		c: http.Client{},
		u: pu,
	}, nil
}

type LokiQueryResponse struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string `json:"resultType"`
		Result     []struct {
			Stream struct {
				Condition           string `json:"condition"`
				Current             string `json:"current"`
				DashboardUID        string `json:"dashboardUID"`
				Fingerprint         string `json:"fingerprint"`
				FolderUID           string `json:"folderUID"`
				From                string `json:"from"`
				Group               string `json:"group"`
				LabelsAlertname     string `json:"labels_alertname"`
				LabelsGrafanaFolder string `json:"labels_grafana_folder"`
				OrgID               string `json:"orgID"`
				PanelID             string `json:"panelID"`
				Previous            string `json:"previous"`
				RuleID              string `json:"ruleID"`
				RuleTitle           string `json:"ruleTitle"`
				RuleUID             string `json:"ruleUID"`
				SchemaVersion       string `json:"schemaVersion"`
				ServiceName         string `json:"service_name"`
				ValuesB             string `json:"values_B"`
				ValuesC             string `json:"values_C"`
			} `json:"stream"`
			Values [][]string `json:"values"`
		} `json:"result"`
	}
}

type AlertState string

const (
	AlertStateNormal   AlertState = "Normal"
	AlertStatePending  AlertState = "Pending"
	AlertStateAlerting AlertState = "Alerting"
)

type AlertStateResponse struct {
	State     AlertState
	Timestamp time.Time
}

// GetCurrentAlertState fetches the current alert state from loki
func (c *LokiClient) GetCurrentAlertState() (*AlertStateResponse, error) {
	u := c.u.ResolveReference(&url.URL{Path: "/loki/api/v1/query_range"})

	vs := url.Values{}
	vs.Add("query", `{from="state-history"} | json`)
	vs.Add("since", "60s")

	u.RawQuery = vs.Encode()

	resp, err := c.c.Get(u.String())
	if err != nil {
		return nil, err
	}
	//nolint:errcheck
	defer resp.Body.Close()

	res := LokiQueryResponse{}

	if err = json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	if res.Status != "success" {
		return nil, fmt.Errorf("failed to query state from loki")
	}

	if len(res.Data.Result) == 0 {
		return nil, fmt.Errorf("empty result from loki")
	}

	r := res.Data.Result[0]
	it, err := strconv.ParseInt(r.Values[0][0], 10, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to parse timestamp: %v", err)
	}

	return &AlertStateResponse{
		State:     AlertState(r.Stream.Current),
		Timestamp: time.Unix(0, it),
	}, nil
}
