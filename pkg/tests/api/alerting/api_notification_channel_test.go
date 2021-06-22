package alerting

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestNotificationChannels(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		DisableAnonymous:     true,
	})

	s := testinfra.SetUpDatabase(t, dir)
	s.Bus = bus.GetBus()
	grafanaListedAddr := testinfra.StartGrafana(t, dir, path, s)

	mockChannel := newMockNotificationChannel(t, grafanaListedAddr)
	amConfig := getAlertmanagerConfig(mockChannel.server.Addr)

	// Overriding some URLs to send to the mock channel.
	os, opa, ot, opu, ogb, ol, oth := channels.SlackAPIEndpoint, channels.PagerdutyEventAPIURL,
		channels.TelegramAPIURL, channels.PushoverEndpoint, channels.GetBoundary,
		channels.LineNotifyURL, channels.ThreemaGwBaseURL
	originalTemplate := channels.DefaultTemplateString
	channels.DefaultTemplateString = channels.TemplateForTestsString
	t.Cleanup(func() {
		channels.SlackAPIEndpoint, channels.PagerdutyEventAPIURL,
			channels.TelegramAPIURL, channels.PushoverEndpoint, channels.GetBoundary,
			channels.LineNotifyURL, channels.ThreemaGwBaseURL = os, opa, ot, opu, ogb, ol, oth
		channels.DefaultTemplateString = originalTemplate
	})
	channels.SlackAPIEndpoint = fmt.Sprintf("http://%s/slack_recvX/slack_testX", mockChannel.server.Addr)
	channels.PagerdutyEventAPIURL = fmt.Sprintf("http://%s/pagerduty_recvX/pagerduty_testX", mockChannel.server.Addr)
	channels.TelegramAPIURL = fmt.Sprintf("http://%s/telegram_recv/bot%%s", mockChannel.server.Addr)
	channels.PushoverEndpoint = fmt.Sprintf("http://%s/pushover_recv/pushover_test", mockChannel.server.Addr)
	channels.LineNotifyURL = fmt.Sprintf("http://%s/line_recv/line_test", mockChannel.server.Addr)
	channels.ThreemaGwBaseURL = fmt.Sprintf("http://%s/threema_recv/threema_test", mockChannel.server.Addr)
	channels.GetBoundary = func() string { return "abcd" }

	// Create a user to make authenticated requests
	require.NoError(t, createUser(t, s, models.ROLE_EDITOR, "grafana", "password"))

	{
		// There are no notification channel config initially - so it returns the default configuration.
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)
		resp := getRequest(t, alertsURL, http.StatusOK) // nolint
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, defaultAlertmanagerConfigJSON, string(b))
	}

	{
		// Create the namespace we'll save our alerts to.
		_, err := createFolder(t, s, 0, "default")
		require.NoError(t, err)

		// Post the alertmanager config.
		u := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)
		_ = postRequest(t, u, amConfig, http.StatusAccepted) // nolint

		// Verifying that all the receivers and routes have been registered.
		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)
		resp := getRequest(t, alertsURL, http.StatusOK) // nolint
		b := getBody(t, resp.Body)
		re := regexp.MustCompile(`"uid":"([\w|-]*)"`)
		e := getExpAlertmanagerConfigFromAPI(mockChannel.server.Addr)
		require.JSONEq(t, e, string(re.ReplaceAll([]byte(b), []byte(`"uid":""`))))
	}

	{
		// Create rules that will fire as quickly as possible

		originalFunction := store.GenerateNewAlertRuleUID
		t.Cleanup(func() {
			store.GenerateNewAlertRuleUID = originalFunction
		})
		store.GenerateNewAlertRuleUID = func(_ *sqlstore.DBSession, _ int64, ruleTitle string) (string, error) {
			return "UID_" + ruleTitle, nil
		}

		rulesConfig := getRulesConfig(t)
		u := fmt.Sprintf("http://grafana:password@%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		_ = postRequest(t, u, rulesConfig, http.StatusAccepted) // nolint
	}

	// Eventually, we'll get all the desired alerts.
	// nolint:gosec
	require.Eventually(t, func() bool {
		return mockChannel.totalNotifications() == len(alertNames)
	}, 30*time.Second, 1*time.Second)

	mockChannel.matchesExpNotifications(t, expNotifications)

	require.NoError(t, mockChannel.Close())
}

func getAlertmanagerConfig(channelAddr string) string {
	return strings.ReplaceAll(alertmanagerConfig, "CHANNEL_ADDR", channelAddr)
}

func getExpAlertmanagerConfigFromAPI(channelAddr string) string {
	return strings.ReplaceAll(expAlertmanagerConfigFromAPI, "CHANNEL_ADDR", channelAddr)
}

// alertNames are name of alerts to be sent. This should be in sync with
// the routes that we define in Alertmanager config.
// EmailAlert and TelegramAlert are missing because they don't
// send a JSON. Email and POST body are yet to be supported in the tests.
var alertNames = []string{
	"AlertmanagerAlert",
	"OpsGenieAlert",
	"VictorOpsAlert",
	"ThreemaAlert",
	"LineAlert",
	"DiscordAlert",
	"KafkaAlert",
	"GoogleChatAlert",
	"PushoverAlert",
	"SensuGoAlert",
	"TelegramAlert",
	"DingDingAlert",
	"SlackAlert1",
	"SlackAlert2",
	"PagerdutyAlert",
	"TeamsAlert",
	"WebhookAlert",
}

func getRulesConfig(t *testing.T) string {
	t.Helper()
	interval, err := model.ParseDuration("10s")
	require.NoError(t, err)
	rules := apimodels.PostableRuleGroupConfig{
		Name:     "arulegroup",
		Interval: interval,
	}

	// Create rules that will fire as quickly as possible for all the routes.
	for _, alertName := range alertNames {
		rules.Rules = append(rules.Rules, apimodels.PostableExtendedRuleNode{
			GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
				Title:     alertName,
				Condition: "A",
				Data: []ngmodels.AlertQuery{
					{
						RefID: "A",
						RelativeTimeRange: ngmodels.RelativeTimeRange{
							From: ngmodels.Duration(time.Duration(5) * time.Hour),
							To:   ngmodels.Duration(time.Duration(3) * time.Hour),
						},
						DatasourceUID: "-100",
						Model: json.RawMessage(`{
							"type": "math",
							"expression": "2 + 3 > 1"
						}`),
					},
				},
			},
		})
	}

	b, err := json.Marshal(rules)
	require.NoError(t, err)

	return string(b)
}

type mockNotificationChannel struct {
	t      *testing.T
	server *http.Server

	receivedNotifications    map[string][]string
	receivedNotificationsMtx sync.Mutex
}

func newMockNotificationChannel(t *testing.T, grafanaListedAddr string) *mockNotificationChannel {
	lastDigit := grafanaListedAddr[len(grafanaListedAddr)-1] - 48
	lastDigit = (lastDigit + 1) % 10
	newAddr := fmt.Sprintf("%s%01d", grafanaListedAddr[:len(grafanaListedAddr)-1], lastDigit)

	nc := &mockNotificationChannel{
		server: &http.Server{
			Addr: newAddr,
		},
		receivedNotifications: make(map[string][]string),
		t:                     t,
	}

	nc.server.Handler = nc
	go func() {
		require.Equal(t, http.ErrServerClosed, nc.server.ListenAndServe())
	}()

	return nc
}

func (nc *mockNotificationChannel) ServeHTTP(res http.ResponseWriter, req *http.Request) {
	nc.t.Helper()
	nc.receivedNotificationsMtx.Lock()
	defer nc.receivedNotificationsMtx.Unlock()

	urlParts := strings.Split(req.URL.String(), "/")
	key := fmt.Sprintf("%s/%s", urlParts[len(urlParts)-2], urlParts[len(urlParts)-1])
	body := getBody(nc.t, req.Body)

	nc.receivedNotifications[key] = append(nc.receivedNotifications[key], body)
	res.WriteHeader(http.StatusOK)
}

func (nc *mockNotificationChannel) totalNotifications() int {
	total := 0
	nc.receivedNotificationsMtx.Lock()
	defer nc.receivedNotificationsMtx.Unlock()
	for _, v := range nc.receivedNotifications {
		total += len(v)
	}
	return total
}

func (nc *mockNotificationChannel) matchesExpNotifications(t *testing.T, exp map[string][]string) {
	t.Helper()
	nc.receivedNotificationsMtx.Lock()
	defer nc.receivedNotificationsMtx.Unlock()

	require.Len(t, nc.receivedNotifications, len(exp))

	for expKey, expVals := range exp {
		actVals, ok := nc.receivedNotifications[expKey]
		require.True(t, ok)
		require.Len(t, actVals, len(expVals))
		for i := range expVals {
			expVal := expVals[i]
			var r1, r2 *regexp.Regexp
			switch expKey {
			case "webhook_recv/webhook_test":
				// It has a time component "startsAt".
				r1 = regexp.MustCompile(`.*"startsAt"\s*:\s*"([^"]+)"`)
			case "slack_recvX/slack_testX":
				fallthrough
			case "slack_recv1/slack_test_without_token":
				// It has a time component "ts".
				r1 = regexp.MustCompile(`.*"ts"\s*:\s*([0-9]+)`)
			case "sensugo/events":
				// It has a time component "ts".
				r1 = regexp.MustCompile(`.*"issued"\s*:\s*([0-9]+)`)
			case "pagerduty_recvX/pagerduty_testX":
				// It has a changing "source".
				r1 = regexp.MustCompile(`.*"source"\s*:\s*"([^"]+)"`)
			case "googlechat_recv/googlechat_test":
				// "Grafana v | 25 May 21 17:44 IST"
				r1 = regexp.MustCompile(`.*"text"\s*:\s*"(Grafana v[^"]+)"`)
			case "victorops_recv/victorops_test":
				// It has a time component "timestamp".
				r1 = regexp.MustCompile(`.*"timestamp"\s*:\s*([0-9]+)`)
			case "v1/alerts":
				// It has a changing time fields.
				r1 = regexp.MustCompile(`.*"startsAt"\s*:\s*"([^"]+)"`)
				r2 = regexp.MustCompile(`.*"UpdatedAt"\s*:\s*"([^"]+)"`)
			}
			if r1 != nil {
				parts := r1.FindStringSubmatch(actVals[i])
				require.Len(t, parts, 2)
				if expKey == "v1/alerts" {
					// 2 fields for Prometheus Alertmanager.
					parts2 := r2.FindStringSubmatch(actVals[i])
					require.Len(t, parts2, 2)
					expVal = fmt.Sprintf(expVal, parts[1], parts2[1])
				} else {
					expVal = fmt.Sprintf(expVal, parts[1])
				}
			}

			switch expKey {
			case "line_recv/line_test", "threema_recv/threema_test":
				// POST parameters.
				require.Equal(t, expVal, actVals[i])
			case "pushover_recv/pushover_test", "telegram_recv/bot6sh027hs034h":
				// Multipart data.
				multipartEqual(t, expVal, actVals[i])
			default:
				require.JSONEq(t, expVal, actVals[i])
			}
		}
	}
}

func multipartEqual(t *testing.T, exp, act string) {
	t.Helper()

	fillMap := func(r *multipart.Reader, m map[string]string) {
		for {
			part, err := r.NextPart()
			if part == nil || errors.Is(err, io.EOF) {
				break
			}
			require.NoError(t, err)
			buf := new(bytes.Buffer)
			_, err = buf.ReadFrom(part)
			require.NoError(t, err)
			m[part.FormName()] = buf.String()
		}
	}

	expReader := multipart.NewReader(strings.NewReader(exp), channels.GetBoundary())
	actReader := multipart.NewReader(strings.NewReader(act), channels.GetBoundary())
	expMap, actMap := make(map[string]string), make(map[string]string)
	fillMap(expReader, expMap)
	fillMap(actReader, actMap)

	require.Equal(t, expMap, actMap)
}

func (nc *mockNotificationChannel) Close() error {
	return nc.server.Close()
}

// alertmanagerConfig has the config for all the notification channels
// that we want to test. It is recommended to use different URL for each
// channel and have 1 route per channel.
// group_wait 0s means the notification is sent as soon as it is received.
const alertmanagerConfig = `
{
  "alertmanager_config": {
    "route": {
      "receiver": "slack_recv1",
      "group_wait": "0s",
      "group_by": [
        "alertname"
      ],
      "routes": [
        {
          "receiver": "email_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"EmailAlert\""
          ]
        },
        {
          "receiver": "slack_recv1",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"SlackAlert1\""
          ]
        },
        {
          "receiver": "slack_recv2",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"SlackAlert2\""
          ]
        },
        {
          "receiver": "pagerduty_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"PagerdutyAlert\""
          ]
        },
        {
          "receiver": "dingding_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"DingDingAlert\""
          ]
        },
        {
          "receiver": "discord_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"DiscordAlert\""
          ]
        },
        {
          "receiver": "sensugo_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"SensuGoAlert\""
          ]
        },
        {
          "receiver": "pushover_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"PushoverAlert\""
          ]
        },
        {
          "receiver": "googlechat_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"GoogleChatAlert\""
          ]
        },
        {
          "receiver": "kafka_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"KafkaAlert\""
          ]
        },
        {
          "receiver": "line_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"LineAlert\""
          ]
        },
        {
          "receiver": "threema_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"ThreemaAlert\""
          ]
        },
        {
          "receiver": "opsgenie_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"OpsGenieAlert\""
          ]
        },
        {
          "receiver": "alertmanager_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"AlertmanagerAlert\""
          ]
        },
        {
          "receiver": "victorops_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"VictorOpsAlert\""
          ]
        },
        {
          "receiver": "teams_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"TeamsAlert\""
          ]
        },
        {
          "receiver": "webhook_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"WebhookAlert\""
          ]
        },
        {
          "receiver": "telegram_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"TelegramAlert\""
          ]
        }
      ]
    },
    "receivers": [
      {
        "name": "email_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "email_test",
            "type": "email",
            "settings": {
              "addresses": "test@email.com",
              "singleEmail": true
            }
          }
        ]
      },
      {
        "name": "dingding_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "dingding_test",
            "type": "dingding",
            "settings": {
              "url": "http://CHANNEL_ADDR/dingding_recv/dingding_test"
            }
          }
        ]
      },
      {
        "name": "discord_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "discord_test",
            "type": "discord",
            "settings": {
              "url": "http://CHANNEL_ADDR/discord_recv/discord_test"
            }
          }
        ]
      },
      {
        "name": "googlechat_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "googlechat_test",
            "type": "googlechat",
            "settings": {
              "url": "http://CHANNEL_ADDR/googlechat_recv/googlechat_test"
            }
          }
        ]
      },
      {
        "name": "kafka_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "kafka_test",
            "type": "kafka",
            "settings": {
              "kafkaRestProxy": "http://CHANNEL_ADDR",
              "kafkaTopic": "my_kafka_topic"
            }
          }
        ]
      },
      {
        "name": "victorops_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "victorops_test",
            "type": "victorops",
            "settings": {
              "url": "http://CHANNEL_ADDR/victorops_recv/victorops_test"
            }
          }
        ]
      },
      {
        "name": "teams_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "teams_test",
            "type": "teams",
            "settings": {
              "url": "http://CHANNEL_ADDR/teams_recv/teams_test"
            }
          }
        ]
      },
      {
        "name": "webhook_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "webhook_test",
            "type": "webhook",
            "settings": {
              "url": "http://CHANNEL_ADDR/webhook_recv/webhook_test",
              "username": "my_username",
              "httpMethod": "POST",
              "maxAlerts": "5"
            },
            "secureSettings": {
              "password": "mysecretpassword"
            }
          }
        ]
      },
      {
        "name": "sensugo_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "sensugo_test",
            "type": "sensugo",
            "settings": {
              "url": "http://CHANNEL_ADDR/sensugo_recv/sensugo_test",
              "namespace": "sensugo"
            },
            "secureSettings": {
              "apikey": "mysecretkey"
            }
          }
        ]
      },
      {
        "name": "pushover_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "pushover_test",
            "type": "pushover",
            "settings": {},
            "secureSettings": {
              "userKey": "mysecretkey",
              "apiToken": "mysecrettoken"
            }
          }
        ]
      },
      {
        "name": "line_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "line_test",
            "type": "line",
            "settings": {},
            "secureSettings": {
              "token": "mysecrettoken"
            }
          }
        ]
      },
      {
        "name": "threema_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "threema_test",
            "type": "threema",
            "settings": {
              "gateway_id": "*1234567",
              "recipient_id": "abcdefgh"
            },
            "secureSettings": {
              "api_secret": "myapisecret"
            }
          }
        ]
      },
      {
        "name": "opsgenie_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "opsgenie_test",
            "type": "opsgenie",
            "settings": {
              "apiUrl": "http://CHANNEL_ADDR/opsgenie_recv/opsgenie_test"
            },
            "secureSettings": {
              "apiKey": "mysecretkey"
            }
          }
        ]
      },
      {
        "name": "alertmanager_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "alertmanager_test",
            "type": "prometheus-alertmanager",
            "settings": {
              "url": "http://CHANNEL_ADDR/alertmanager_recv/alertmanager_test"
            },
            "secureSettings": {}
          }
        ]
      },
      {
        "name": "telegram_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "telegram_test",
            "type": "telegram",
            "settings": {
              "chatid": "telegram_chat_id"
            },
            "secureSettings": {
              "bottoken": "6sh027hs034h"
            }
          }
        ]
      },
      {
        "name": "slack_recv1",
        "grafana_managed_receiver_configs": [
          {
            "name": "slack_test_without_token",
            "type": "slack",
            "settings": {
              "recipient": "#test-channel",
              "mentionChannel": "here",
              "mentionUsers": "user1, user2",
              "mentionGroups": "group1, group2",
              "username": "Integration Test",
              "icon_emoji": "🚀",
              "icon_url": "https://awesomeemoji.com/rocket",
              "text": "Integration Test {{ template \"slack.default.text\" . }}",
              "title": "Integration Test {{ template \"slack.default.title\" . }}",
              "fallback": "Integration Test {{ template \"slack.default.title\" . }}"
            },
            "secureSettings": {
              "url": "http://CHANNEL_ADDR/slack_recv1/slack_test_without_token"
            }
          }
        ]
      },
      {
        "name": "slack_recv2",
        "grafana_managed_receiver_configs": [
          {
            "name": "slack_test_with_token",
            "type": "slack",
            "settings": {
              "recipient": "#test-channel",
              "mentionUsers": "user1, user2",
              "username": "Integration Test"
            },
            "secureSettings": {
              "token": "myfullysecrettoken"
            }
          }
        ]
      },
      {
        "name": "pagerduty_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "pagerduty_test",
            "type": "pagerduty",
            "settings": {
              "severity": "warning",
              "class": "testclass",
              "component": "Integration Test",
              "group": "testgroup",
              "summary": "Integration Test {{ template \"pagerduty.default.description\" . }}"
            },
            "secureSettings": {
              "integrationKey": "pagerduty_recv/pagerduty_test"
            }
          }
        ]
      }
    ]
  }
}
`

var expAlertmanagerConfigFromAPI = `
{
  "template_files": null,
  "alertmanager_config": {
    "route": {
      "receiver": "slack_recv1",
      "group_wait": "0s",
      "group_by": [
        "alertname"
      ],
      "routes": [
        {
          "receiver": "email_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"EmailAlert\""
          ]
        },
        {
          "receiver": "slack_recv1",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"SlackAlert1\""
          ]
        },
        {
          "receiver": "slack_recv2",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"SlackAlert2\""
          ]
        },
        {
          "receiver": "pagerduty_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"PagerdutyAlert\""
          ]
        },
        {
          "receiver": "dingding_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"DingDingAlert\""
          ]
        },
        {
          "receiver": "discord_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"DiscordAlert\""
          ]
        },
        {
          "receiver": "sensugo_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"SensuGoAlert\""
          ]
        },
        {
          "receiver": "pushover_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"PushoverAlert\""
          ]
        },
        {
          "receiver": "googlechat_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"GoogleChatAlert\""
          ]
        },
        {
          "receiver": "kafka_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"KafkaAlert\""
          ]
        },
        {
          "receiver": "line_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"LineAlert\""
          ]
        },
        {
          "receiver": "threema_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"ThreemaAlert\""
          ]
        },
        {
          "receiver": "opsgenie_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"OpsGenieAlert\""
          ]
        },
        {
          "receiver": "alertmanager_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"AlertmanagerAlert\""
          ]
        },
        {
          "receiver": "victorops_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"VictorOpsAlert\""
          ]
        },
        {
          "receiver": "teams_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"TeamsAlert\""
          ]
        },
        {
          "receiver": "webhook_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"WebhookAlert\""
          ]
        },
        {
          "receiver": "telegram_recv",
          "group_wait": "0s",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"TelegramAlert\""
          ]
        }
      ]
    },
    "templates": null,
    "receivers": [
      {
        "name": "email_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "email_test",
            "type": "email",
            "disableResolveMessage": false,
            "settings": {
              "addresses": "test@email.com",
              "singleEmail": true
            },
            "secureFields": {}
          }
        ]
      },
      {
        "name": "dingding_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "dingding_test",
            "type": "dingding",
            "disableResolveMessage": false,
            "settings": {
              "url": "http://CHANNEL_ADDR/dingding_recv/dingding_test"
            },
            "secureFields": {}
          }
        ]
      },
      {
        "name": "discord_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "discord_test",
            "type": "discord",
            "disableResolveMessage": false,
            "settings": {
              "url": "http://CHANNEL_ADDR/discord_recv/discord_test"
            },
            "secureFields": {}
          }
        ]
      },
      {
        "name": "googlechat_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "googlechat_test",
            "type": "googlechat",
            "disableResolveMessage": false,
            "settings": {
              "url": "http://CHANNEL_ADDR/googlechat_recv/googlechat_test"
            },
            "secureFields": {}
          }
        ]
      },
      {
        "name": "kafka_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "kafka_test",
            "type": "kafka",
            "disableResolveMessage": false,
            "settings": {
              "kafkaRestProxy": "http://CHANNEL_ADDR",
              "kafkaTopic": "my_kafka_topic"
            },
            "secureFields": {}
          }
        ]
      },
      {
        "name": "victorops_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "victorops_test",
            "type": "victorops",
            "disableResolveMessage": false,
            "settings": {
              "url": "http://CHANNEL_ADDR/victorops_recv/victorops_test"
            },
            "secureFields": {}
          }
        ]
      },
      {
        "name": "teams_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "teams_test",
            "type": "teams",
            "disableResolveMessage": false,
            "settings": {
              "url": "http://CHANNEL_ADDR/teams_recv/teams_test"
            },
            "secureFields": {}
          }
        ]
      },
      {
        "name": "webhook_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "webhook_test",
            "type": "webhook",
            "disableResolveMessage": false,
            "settings": {
              "url": "http://CHANNEL_ADDR/webhook_recv/webhook_test",
              "username": "my_username",
              "httpMethod": "POST",
              "maxAlerts": "5"
            },
            "secureFields": {
              "password": true
            }
          }
        ]
      },
      {
        "name": "sensugo_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "sensugo_test",
            "type": "sensugo",
            "disableResolveMessage": false,
            "settings": {
              "url": "http://CHANNEL_ADDR/sensugo_recv/sensugo_test",
              "namespace": "sensugo"
            },
            "secureFields": {
              "apikey": true
            }
          }
        ]
      },
      {
        "name": "pushover_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "pushover_test",
            "type": "pushover",
            "disableResolveMessage": false,
            "settings": {},
            "secureFields": {
              "userKey": true,
              "apiToken": true
            }
          }
        ]
      },
      {
        "name": "line_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "line_test",
            "type": "line",
            "disableResolveMessage": false,
            "settings": {},
            "secureFields": {
              "token": true
            }
          }
        ]
      },
      {
        "name": "threema_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "threema_test",
            "type": "threema",
            "disableResolveMessage": false,
            "settings": {
              "gateway_id": "*1234567",
              "recipient_id": "abcdefgh"
            },
            "secureFields": {
              "api_secret": true
            }
          }
        ]
      },
      {
        "name": "opsgenie_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "opsgenie_test",
            "type": "opsgenie",
            "disableResolveMessage": false,
            "settings": {
              "apiUrl": "http://CHANNEL_ADDR/opsgenie_recv/opsgenie_test"
            },
            "secureFields": {
              "apiKey": true
            }
          }
        ]
      },
      {
        "name": "alertmanager_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "alertmanager_test",
            "type": "prometheus-alertmanager",
            "disableResolveMessage": false,
            "settings": {
              "url": "http://CHANNEL_ADDR/alertmanager_recv/alertmanager_test"
            },
            "secureFields": {}
          }
        ]
      },
      {
        "name": "telegram_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "telegram_test",
            "type": "telegram",
            "disableResolveMessage": false,
            "settings": {
              "chatid": "telegram_chat_id"
            },
            "secureFields": {
              "bottoken": true
            }
          }
        ]
      },
      {
        "name": "slack_recv1",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "slack_test_without_token",
            "type": "slack",
            "disableResolveMessage": false,
            "settings": {
              "fallback": "Integration Test {{ template \"slack.default.title\" . }}",
              "icon_emoji": "🚀",
              "icon_url": "https://awesomeemoji.com/rocket",
              "mentionChannel": "here",
              "mentionGroups": "group1, group2",
              "mentionUsers": "user1, user2",
              "recipient": "#test-channel",
              "text": "Integration Test {{ template \"slack.default.text\" . }}",
              "title": "Integration Test {{ template \"slack.default.title\" . }}",
              "username": "Integration Test"
            },
            "secureFields": {
              "url": true
            }
          }
        ]
      },
      {
        "name": "slack_recv2",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "slack_test_with_token",
            "type": "slack",
            "disableResolveMessage": false,
            "settings": {
              "mentionUsers": "user1, user2",
              "recipient": "#test-channel",
              "username": "Integration Test"
            },
            "secureFields": {
              "token": true
            }
          }
        ]
      },
      {
        "name": "pagerduty_recv",
        "grafana_managed_receiver_configs": [
          {
            "uid": "",
            "name": "pagerduty_test",
            "type": "pagerduty",
            "disableResolveMessage": false,
            "settings": {
              "class": "testclass",
              "component": "Integration Test",
              "group": "testgroup",
              "severity": "warning",
              "summary": "Integration Test {{ template \"pagerduty.default.description\" . }}"
            },
            "secureFields": {
              "integrationKey": true
            }
          }
        ]
      }
    ]
  }
}
`

// expNotifications is all the expected notifications.
// The key for the map is taken from the URL. The last 2 components of URL
// split with "/" forms the key for that route.
var expNotifications = map[string][]string{
	"slack_recv1/slack_test_without_token": {
		`{
		  "channel": "#test-channel",
		  "username": "Integration Test",
		  "icon_emoji": "🚀",
		  "icon_url": "https://awesomeemoji.com/rocket",
		  "attachments": [
			{
			  "title": "Integration Test [FIRING:1] SlackAlert1 ",
			  "title_link": "http://localhost:3000/alerting/list",
			  "text": "Integration Test ",
			  "fallback": "Integration Test [FIRING:1] SlackAlert1 ",
			  "footer": "Grafana v",
			  "footer_icon": "https://grafana.com/assets/img/fav32.png",
			  "color": "#D63232",
			  "ts": %s
			}
		  ],
		  "blocks": [
			{
			  "text": {
				"text": "<!here|here> <!subteam^group1><!subteam^group2> <@user1><@user2>",
				"type": "mrkdwn"
			  },
			  "type": "section"
			}
		  ]
		}`,
	},
	"slack_recvX/slack_testX": {
		`{
		  "channel": "#test-channel",
		  "username": "Integration Test",
		  "attachments": [
			{
			  "title": "[FIRING:1] SlackAlert2 ",
			  "title_link": "http://localhost:3000/alerting/list",
			  "text": "**Firing**\n\nLabels:\n - alertname = SlackAlert2\nAnnotations:\nSource: http://localhost:3000/alerting/UID_SlackAlert2/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%%3DSlackAlert2\n",
			  "fallback": "[FIRING:1] SlackAlert2 ",
			  "footer": "Grafana v",
			  "footer_icon": "https://grafana.com/assets/img/fav32.png",
			  "color": "#D63232",
			  "ts": %s
			}
		  ],
		  "blocks": [
			{
			  "text": {
				"text": "<@user1><@user2>",
				"type": "mrkdwn"
			  },
			  "type": "section"
			}
		  ]
		}`,
	},
	"pagerduty_recvX/pagerduty_testX": {
		`{
		  "routing_key": "pagerduty_recv/pagerduty_test",
		  "dedup_key": "234edb34441f942f713f3c2ccf58b1d719d921b4cbe34e57a1630f1dee847e3b",
		  "description": "[FIRING:1] PagerdutyAlert ",
		  "event_action": "trigger",
		  "payload": {
			"summary": "Integration Test [FIRING:1] PagerdutyAlert ",
			"source": "%s",
			"severity": "warning",
			"class": "testclass",
			"component": "Integration Test",
			"group": "testgroup",
			"custom_details": {
			  "firing": "\nLabels:\n - alertname = PagerdutyAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_PagerdutyAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%%3DPagerdutyAlert\n",
			  "num_firing": "1",
			  "num_resolved": "0",
			  "resolved": ""
			}
		  },
		  "client": "Grafana",
		  "client_url": "http://localhost:3000/",
		  "links": [
			{
			  "href": "http://localhost:3000/",
			  "text": "External URL"
			}
		  ]
		}`,
	},
	"dingding_recv/dingding_test": {
		`{
		  "link": {
			"messageUrl": "dingtalk://dingtalkclient/page/link?pc_slide=false&url=http%3A%2F%2Flocalhost%3A3000%2Falerting%2Flist",
			"text": "**Firing**\n\nLabels:\n - alertname = DingDingAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_DingDingAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DDingDingAlert\n",
			"title": "[FIRING:1] DingDingAlert "
		  },
		  "msgtype": "link"
		}`,
	},
	"teams_recv/teams_test": {
		`{
		  "@context": "http://schema.org/extensions",
		  "@type": "MessageCard",
		  "potentialAction": [
			{
			  "@context": "http://schema.org",
			  "@type": "OpenUri",
			  "name": "View Rule",
			  "targets": [
				{
				  "os": "default",
				  "uri": "http://localhost:3000/alerting/list"
				}
			  ]
			}
		  ],
		  "sections": [
			{
			  "text": "**Firing**\n\nLabels:\n - alertname = TeamsAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_TeamsAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DTeamsAlert\n",
			  "title": "Details"
			}
		  ],
		  "summary": "[FIRING:1] TeamsAlert ",
		  "themeColor": "#D63232",
		  "title": "[FIRING:1] TeamsAlert "
		}`,
	},
	"webhook_recv/webhook_test": {
		`{
		  "receiver": "webhook_recv",
		  "status": "firing",
		  "alerts": [
			{
			  "status": "firing",
			  "labels": {
				"alertname": "WebhookAlert"
			  },
			  "annotations": {},
			  "startsAt": "%s",
			  "endsAt": "0001-01-01T00:00:00Z",
			  "generatorURL": "http://localhost:3000/alerting/UID_WebhookAlert/edit",
			  "fingerprint": "7611eef9e67f6e50",
			  "silenceURL": "http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%%3DWebhookAlert",
			  "dashboardURL": "",
			  "panelURL": ""
			}
		  ],
		  "groupLabels": {
			"alertname": "WebhookAlert"
		  },
		  "commonLabels": {
			"alertname": "WebhookAlert"
		  },
		  "commonAnnotations": {},
		  "externalURL": "http://localhost:3000/",
		  "version": "1",
		  "groupKey": "{}/{alertname=\"WebhookAlert\"}:{alertname=\"WebhookAlert\"}",
		  "truncatedAlerts": 0,
		  "title": "[FIRING:1] WebhookAlert ",
		  "state": "alerting",
		  "message": "**Firing**\n\nLabels:\n - alertname = WebhookAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_WebhookAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%%3DWebhookAlert\n"
		}`,
	},
	"discord_recv/discord_test": {
		`{
		  "content": "**Firing**\n\nLabels:\n - alertname = DiscordAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_DiscordAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DDiscordAlert\n",
		  "embeds": [
			{
			  "color": 14037554,
			  "footer": {
				"icon_url": "https://grafana.com/assets/img/fav32.png",
				"text": "Grafana v"
			  },
			  "title": "[FIRING:1] DiscordAlert ",
			  "type": "rich",
			  "url": "http://localhost:3000/alerting/list"
			}
		  ],
		  "username": "Grafana"
		}`,
	},
	"sensugo/events": {
		`{
		  "check": {
			"handlers": null,
			"interval": 86400,
			"issued": %s,
			"metadata": {
			  "labels": {
				"ruleURL": "http://localhost:3000/alerting/list"
			  },
			  "name": "default"
			},
			"output": "**Firing**\n\nLabels:\n - alertname = SensuGoAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_SensuGoAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%%3DSensuGoAlert\n",
			"status": 2
		  },
		  "entity": {
			"metadata": {
			  "name": "default",
			  "namespace": "sensugo"
			}
		  },
		  "ruleUrl": "http://localhost:3000/alerting/list"
		}`,
	},
	"pushover_recv/pushover_test": {
		"--abcd\r\nContent-Disposition: form-data; name=\"user\"\r\n\r\nmysecretkey\r\n--abcd\r\nContent-Disposition: form-data; name=\"token\"\r\n\r\nmysecrettoken\r\n--abcd\r\nContent-Disposition: form-data; name=\"priority\"\r\n\r\n0\r\n--abcd\r\nContent-Disposition: form-data; name=\"sound\"\r\n\r\n\r\n--abcd\r\nContent-Disposition: form-data; name=\"title\"\r\n\r\n[FIRING:1] PushoverAlert \r\n--abcd\r\nContent-Disposition: form-data; name=\"url\"\r\n\r\nhttp://localhost:3000/alerting/list\r\n--abcd\r\nContent-Disposition: form-data; name=\"url_title\"\r\n\r\nShow alert rule\r\n--abcd\r\nContent-Disposition: form-data; name=\"message\"\r\n\r\n**Firing**\n\nLabels:\n - alertname = PushoverAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_PushoverAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DPushoverAlert\n\r\n--abcd\r\nContent-Disposition: form-data; name=\"html\"\r\n\r\n1\r\n--abcd--\r\n",
	},
	"telegram_recv/bot6sh027hs034h": {
		"--abcd\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\ntelegram_chat_id\r\n--abcd\r\nContent-Disposition: form-data; name=\"parse_mode\"\r\n\r\nhtml\r\n--abcd\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\n**Firing**\n\nLabels:\n - alertname = TelegramAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_TelegramAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DTelegramAlert\n\r\n--abcd--\r\n",
	},
	"googlechat_recv/googlechat_test": {
		`{
		  "previewText": "[FIRING:1] GoogleChatAlert ",
		  "fallbackText": "[FIRING:1] GoogleChatAlert ",
		  "cards": [
			{
			  "header": {
				"title": "[FIRING:1] GoogleChatAlert "
			  },
			  "sections": [
				{
				  "widgets": [
					{
					  "textParagraph": {
						"text": "**Firing**\n\nLabels:\n - alertname = GoogleChatAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_GoogleChatAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%%3DGoogleChatAlert\n"
					  }
					},
					{
					  "buttons": [
						{
						  "textButton": {
							"text": "OPEN IN GRAFANA",
							"onClick": {
							  "openLink": {
								"url": "http://localhost:3000/alerting/list"
							  }
							}
						  }
						}
					  ]
					},
					{
					  "textParagraph": {
						"text": "%s"
					  }
					}
				  ]
				}
			  ]
			}
		  ]
		}`,
	},
	"topics/my_kafka_topic": {
		`{
		  "records": [
			{
			  "value": {
				"alert_state": "alerting",
				"client": "Grafana",
				"client_url": "http://localhost:3000/alerting/list",
				"description": "[FIRING:1] KafkaAlert ",
				"details": "**Firing**\n\nLabels:\n - alertname = KafkaAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_KafkaAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DKafkaAlert\n",
				"incident_key": "35c0bdb1715f9162a20d7b2a01cb2e3a4c5b1dc663571701e3f67212b696332f"
			  }
			}
		  ]
		}`,
	},
	"line_recv/line_test": {
		`message=%5BFIRING%3A1%5D+LineAlert+%0Ahttp%3A%2Flocalhost%3A3000%2Falerting%2Flist%0A%0A%2A%2AFiring%2A%2A%0A%0ALabels%3A%0A+-+alertname+%3D+LineAlert%0AAnnotations%3A%0ASource%3A+http%3A%2F%2Flocalhost%3A3000%2Falerting%2FUID_LineAlert%2Fedit%0ASilence%3A+http%3A%2F%2Flocalhost%3A3000%2Falerting%2Fsilence%2Fnew%3Falertmanager%3Dgrafana%26matchers%3Dalertname%253DLineAlert%0A`,
	},
	"threema_recv/threema_test": {
		`from=%2A1234567&secret=myapisecret&text=%E2%9A%A0%EF%B8%8F+%5BFIRING%3A1%5D+ThreemaAlert+%0A%0A%2AMessage%3A%2A%0A%2A%2AFiring%2A%2A%0A%0ALabels%3A%0A+-+alertname+%3D+ThreemaAlert%0AAnnotations%3A%0ASource%3A+http%3A%2F%2Flocalhost%3A3000%2Falerting%2FUID_ThreemaAlert%2Fedit%0ASilence%3A+http%3A%2F%2Flocalhost%3A3000%2Falerting%2Fsilence%2Fnew%3Falertmanager%3Dgrafana%26matchers%3Dalertname%253DThreemaAlert%0A%0A%2AURL%3A%2A+http%3A%2Flocalhost%3A3000%2Falerting%2Flist%0A&to=abcdefgh`,
	},
	"victorops_recv/victorops_test": {
		`{
		  "alert_url": "http://localhost:3000/alerting/list",
		  "entity_display_name": "[FIRING:1] VictorOpsAlert ",
		  "entity_id": "633ae988fa7074bcb51f3d1c5fef2ba1c5c4ccb45b3ecbf681f7d507b078b1ae",
		  "message_type": "CRITICAL",
		  "monitoring_tool": "Grafana v",
		  "state_message": "**Firing**\n\nLabels:\n - alertname = VictorOpsAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_VictorOpsAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%%3DVictorOpsAlert\n",
		  "timestamp": %s
		}`,
	},
	"opsgenie_recv/opsgenie_test": {
		`{
		  "alias": "47e92f0f6ef9fe99f3954e0d6155f8d09c4b9a038d8c3105e82c0cee4c62956e",
		  "description": "[FIRING:1] OpsGenieAlert \nhttp://localhost:3000/alerting/list\n\n**Firing**\n\nLabels:\n - alertname = OpsGenieAlert\nAnnotations:\nSource: http://localhost:3000/alerting/UID_OpsGenieAlert/edit\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matchers=alertname%3DOpsGenieAlert\n",
		  "details": {
			"url": "http://localhost:3000/alerting/list"
		  },
		  "message": "[FIRING:1] OpsGenieAlert ",
		  "source": "Grafana",
		  "tags": ["alertname:OpsGenieAlert"]
		}`,
	},
	// Prometheus Alertmanager.
	"v1/alerts": {
		`[
		  {
			"labels": {
			  "__alert_rule_uid__": "UID_AlertmanagerAlert",
              "__value__": "[ var='A' labels={} value=1 ]",
			  "alertname": "AlertmanagerAlert"
			},
			"annotations": {},
			"startsAt": "%s",
			"endsAt": "0001-01-01T00:00:00Z",
			"generatorURL": "http://localhost:3000/alerting/UID_AlertmanagerAlert/edit",
			"UpdatedAt": "%s",
			"Timeout": false
		  }
		]`,
	},
}
