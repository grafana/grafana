package alertmanager

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/grafana/e2e"
	gapi "github.com/grafana/grafana-api-golang-client"
	"github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	"github.com/stretchr/testify/require"
)

const (
	defaultNetworkName = "e2e-grafana-am"
)

type AlertRuleConfig struct {
	PendingPeriod                  string
	GroupEvaluationIntervalSeconds int64
}

type NotificationPolicyCfg struct {
	GroupWait      string
	GroupInterval  string
	RepeatInterval string
}

type ProvisionCfg struct {
	AlertRuleConfig
	NotificationPolicyCfg
}

// AlertmanagerScenario is a helper for writing tests which require some number of AM
// configured to communicate with some number of Grafana instances.
type AlertmanagerScenario struct {
	*e2e.Scenario

	Grafanas map[string]*GrafanaService
	Webhook  *WebhookService
	Postgres *PostgresService
	Loki     *LokiService
	Mimir    *MimirService
}

func NewAlertmanagerScenario() (*AlertmanagerScenario, error) {
	s, err := e2e.NewScenario(getNetworkName())
	if err != nil {
		return nil, err
	}

	return &AlertmanagerScenario{
		Scenario: s,
		Grafanas: make(map[string]*GrafanaService),
	}, nil
}

// Setup starts a Grafana AM cluster of size n and all required dependencies
func (s *AlertmanagerScenario) Start(t *testing.T, n int, peerTimeout string, stopOnExtraDedup bool) {
	is := getInstances(n)
	ips := mapInstancePeers(is)

	// start dependencies in one go
	require.NoError(
		t,
		s.StartAndWaitReady([]e2e.Service{
			s.NewWebhookService("webhook"),
			s.NewLokiService("loki"),
			s.NewPostgresService("postgres"),
		}...),
	)

	for i, ps := range ips {
		require.NoError(t, s.StartAndWaitReady(s.NewGrafanaService(i, ps, peerTimeout, stopOnExtraDedup)))
	}

	// wait for instances to come online and cluster to be properly configured
	time.Sleep(30 * time.Second)
}

// Provision provisions all required resources for the test
func (s *AlertmanagerScenario) Provision(t *testing.T, cfg ProvisionCfg) { //}*GrafanaClient {
	c, err := s.NewGrafanaClient("grafana-1", 1)
	require.NoError(t, err)

	dsUID := "integration-testdata"

	// setup resources
	_, err = c.NewDataSource(&gapi.DataSource{
		Name:   "grafana-testdata-datasource",
		Type:   "grafana-testdata-datasource",
		Access: "proxy",
		UID:    dsUID,
	})
	require.NoError(t, err)

	// setup loki for state history
	_, err = c.NewDataSource(&gapi.DataSource{
		Name:   "loki",
		Type:   "loki",
		URL:    "http://loki:3100",
		Access: "proxy",
	})
	require.NoError(t, err)

	_, err = c.NewContactPoint(&gapi.ContactPoint{
		Name: "webhook",
		Type: "webhook",
		Settings: map[string]any{
			"url": "http://webhook:8080/notify",
		},
	})
	require.NoError(t, err)

	require.NoError(t, c.SetNotificationPolicyTree(&gapi.NotificationPolicyTree{
		Receiver:       "webhook",
		GroupWait:      cfg.GroupWait,
		GroupInterval:  cfg.GroupInterval,
		RepeatInterval: cfg.RepeatInterval,
	}))

	f, err := c.NewFolder("integration_test")
	require.NoError(t, err)

	r := &gapi.AlertRule{
		Title:        "integration rule",
		Condition:    "C",
		FolderUID:    f.UID,
		ExecErrState: gapi.ErrError,
		NoDataState:  gapi.NoData,
		For:          cfg.PendingPeriod,
		RuleGroup:    "test",
		Data: []*gapi.AlertQuery{
			{
				RefID: "A",
				RelativeTimeRange: gapi.RelativeTimeRange{
					From: 600,
					To:   0,
				},
				DatasourceUID: dsUID,
				Model: json.RawMessage(fmt.Sprintf(`{
					"refId":"A",
					"datasource": {
						"type": "grafana-testdata-datasource",
						"uid": "%s"
					},
					"hide":false,
					"range":false,
					"instant":true,
					"intervalMs":1000,
					"maxDataPoints":43200,
					"pulseWave": {
						"offCount": 6,
						"offValue": 0,
						"onCount": 10,
						"onValue": 10,
						"timeStep": 10
					},
					"refId": "A",
					"scenarioId": "predictable_pulse",
					"seriesCount": 1
					}`, dsUID)),
			},
			{
				RefID: "B",
				RelativeTimeRange: gapi.RelativeTimeRange{
					From: 0,
					To:   0,
				},
				DatasourceUID: "__expr__",
				Model: json.RawMessage(`{
					"conditions": [
						{
							"evaluator": {
								"params": [
									0,
									0
								],
								"type": "gt"
							},
							"operator": {
								"type": "and"
							},
							"query": {
								"params": []
							},
							"reducer": {
								"params": [],
								"type": "avg"
							},
							"type": "query"
						}
					],
					"datasource": {
						"name": "Expression",
						"type": "__expr__",
						"uid": "__expr__"
					},
					"expression": "A",
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"reducer": "last",
					"refId": "B",
					"type": "reduce"
				}`),
			},
			{
				RefID: "C",
				RelativeTimeRange: gapi.RelativeTimeRange{
					From: 0,
					To:   0,
				},
				DatasourceUID: "__expr__",
				Model: json.RawMessage(`{
					"conditions": [
						{
							"evaluator": {
								"params": [
									0,
									0
								],
								"type": "gt"
							},
							"operator": {
								"type": "and"
							},
							"query": {
								"params": [
									"B"
								]
							},
							"reducer": {
								"params": [],
								"type": "last"
							},
							"type": "query"
						}
					],
					"datasource": {
						"type": "__expr__",
						"uid": "__expr__"
					},
					"hide": false,
					"isPaused": false,
					"intervalMs": 1000,
					"maxDataPoints": 43200,
					"refId": "C",
					"expression": "B",
					"type": "threshold"
				}`),
			},
		},
	}
	_, err = c.NewAlertRule(r)
	require.NoError(t, err)

	require.NoError(t, c.SetAlertRuleGroup(gapi.RuleGroup{
		Title:     "test",
		FolderUID: f.UID,
		Interval:  cfg.GroupEvaluationIntervalSeconds,
		Rules:     []gapi.AlertRule{*r},
	}))
}

// NewGrafanaService creates a new Grafana instance.
func (s *AlertmanagerScenario) NewGrafanaService(name string, peers []string, peerTimeout string, stopOnExtraDedup bool) *GrafanaService {
	flags := map[string]string{}

	ft := []string{
		"alertingAlertmanagerExtraDedupStage",
	}
	if stopOnExtraDedup {
		ft = append(ft, "alertingAlertmanagerExtraDedupStageStopPipeline")
	}
	envVars := map[string]string{
		//"GF_LOG_MODE":                                       "file", // disable console logging
		"GF_LOG_LEVEL":                                      "warn",
		"GF_FEATURE_TOGGLES_ENABLE":                         strings.Join(ft, ","),
		"GF_UNIFIED_ALERTING_ENABLED":                       "true",
		"GF_UNIFIED_ALERTING_EXECUTE_ALERTS":                "true",
		"GF_UNIFIED_ALERTING_HA_PEER_TIMEOUT":               peerTimeout,
		"GF_UNIFIED_ALERTING_HA_RECONNECT_TIMEOUT":          "2m",
		"GF_UNIFIED_ALERTING_HA_LISTEN_ADDRESS":             ":9094",
		"GF_UNIFIED_ALERTING_HA_PEERS":                      strings.Join(peers, ","),
		"GF_UNIFIED_ALERTING_STATE_HISTORY_ENABLED":         "true",
		"GF_UNIFIED_ALERTING_STATE_HISTORY_BACKEND":         "loki",
		"GF_UNIFIED_ALERTING_STATE_HISTORY_LOKI_REMOTE_URL": "http://loki:3100",
		"GF_DATABASE_TYPE":                                  "postgres",
		"GF_DATABASE_HOST":                                  "postgres:5432",
		"GF_DATABASE_NAME":                                  "grafana",
		"GF_DATABASE_USER":                                  "postgres",
		"GF_DATABASE_PASSWORD":                              "password",
		"GF_DATABASE_SSL_MODE":                              "disable",
	}

	g := NewGrafanaService(name, flags, envVars)

	s.Grafanas[name] = g
	return g
}

// NewGrafanaService creates a new Grafana API client for the requested instance.
func (s *AlertmanagerScenario) NewGrafanaClient(grafanaName string, orgID int64) (*GrafanaClient, error) {
	g, ok := s.Grafanas[grafanaName]
	if !ok {
		return nil, fmt.Errorf("unknown grafana instance: %s", grafanaName)
	}

	return NewGrafanaClient(g.HTTPEndpoint(), orgID)
}

func (s *AlertmanagerScenario) NewWebhookClient() (*WebhookClient, error) {
	return NewWebhookClient("http://" + s.Webhook.HTTPEndpoint())
}

func (s *AlertmanagerScenario) NewWebhookService(name string) *WebhookService {
	ws := NewWebhookService(name, nil, nil)
	s.Webhook = ws

	return ws
}

func (s *AlertmanagerScenario) NewLokiService(name string) *LokiService {
	ls := NewLokiService(name, map[string]string{"--config.file": "/etc/loki/local-config.yaml"}, nil)
	s.Loki = ls

	return ls
}

func (s *AlertmanagerScenario) NewPostgresService(name string) *PostgresService {
	ps := NewPostgresService(name, map[string]string{"POSTGRES_PASSWORD": "password", "POSTGRES_DB": "grafana"})
	s.Postgres = ps

	return ps
}

func (s *AlertmanagerScenario) NewLokiClient() (*LokiClient, error) {
	return NewLokiClient("http://" + s.Loki.HTTPEndpoint())
}

func getNetworkName() string {
	// If the E2E_NETWORK_NAME is set, use that for the network name.
	// Otherwise, return the default network name.
	if os.Getenv("E2E_NETWORK_NAME") != "" {
		return os.Getenv("E2E_NETWORK_NAME")
	}

	return defaultNetworkName
}

func getInstances(n int) []string {
	is := make([]string, n)

	for i := 0; i < n; i++ {
		is[i] = "grafana-" + strconv.Itoa(i+1)
	}

	return is
}

func getPeers(i string, is []string) []string {
	peers := make([]string, 0, len(is)-1)

	for _, p := range is {
		if p != i {
			peers = append(peers, p+":9094")
		}
	}

	return peers
}

func mapInstancePeers(is []string) map[string][]string {
	mIs := make(map[string][]string, len(is))

	for _, i := range is {
		mIs[i] = getPeers(i, is)
	}

	return mIs
}

func (s *AlertmanagerScenario) NewMimirClient(tenantID string) (client.MimirClient, error) {
	if s.Mimir == nil {
		return nil, fmt.Errorf("mimir service not started")
	}
	return NewMimirClient("http://"+s.Mimir.HTTPEndpoint(), tenantID)
}
