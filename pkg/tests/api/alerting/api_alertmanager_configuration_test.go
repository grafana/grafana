package alerting

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationAlertmanagerConfiguration(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		AppModeProduction:     true,
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})
	client := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	cases := []struct {
		name   string
		cfg    apimodels.PostableUserConfig
		expErr string
	}{{
		name: "configuration with default route",
		cfg: apimodels.PostableUserConfig{
			AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
				Config: apimodels.Config{
					Route: &apimodels.Route{
						Receiver: "test",
					},
				},
				Receivers: []*apimodels.PostableApiReceiver{{
					Receiver: config.Receiver{
						Name: "test",
					},
				}},
			},
		},
	}, {
		name: "configuration with UTF-8 matchers",
		cfg: apimodels.PostableUserConfig{
			AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
				Config: apimodels.Config{
					Route: &apimodels.Route{
						Receiver: "test",
						Routes: []*apimodels.Route{{
							GroupBy: []model.LabelName{"foo🙂"},
							Matchers: config.Matchers{{
								Type:  labels.MatchEqual,
								Name:  "foo🙂",
								Value: "bar",
							}, {
								Type:  labels.MatchNotEqual,
								Name:  "_bar1",
								Value: "baz🙂",
							}, {
								Type:  labels.MatchRegexp,
								Name:  "0baz",
								Value: "[a-zA-Z0-9]+,?",
							}, {
								Type:  labels.MatchNotRegexp,
								Name:  "corge",
								Value: "^[0-9]+((,[0-9]{3})*(,[0-9]{0,3})?)?$",
							}, {
								Type:  labels.MatchEqual,
								Name:  "Προμηθέας", // Prometheus in Greek
								Value: "Prom",
							}, {
								Type:  labels.MatchNotEqual,
								Name:  "犬", // Dog in Japanese
								Value: "Shiba Inu",
							}},
						}},
					},
				},
				Receivers: []*apimodels.PostableApiReceiver{{
					Receiver: config.Receiver{
						Name: "test",
					},
				}},
			},
		},
	}, {
		name: "configuration with UTF-8 object matchers",
		cfg: apimodels.PostableUserConfig{
			AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
				Config: apimodels.Config{
					Route: &apimodels.Route{
						Receiver: "test",
						Routes: []*apimodels.Route{{
							GroupBy: []model.LabelName{"foo🙂"},
							ObjectMatchers: apimodels.ObjectMatchers{{
								Type:  labels.MatchEqual,
								Name:  "foo🙂",
								Value: "bar",
							}, {
								Type:  labels.MatchNotEqual,
								Name:  "_bar1",
								Value: "baz🙂",
							}, {
								Type:  labels.MatchRegexp,
								Name:  "0baz",
								Value: "[a-zA-Z0-9]+,?",
							}, {
								Type:  labels.MatchNotRegexp,
								Name:  "corge",
								Value: "^[0-9]+((,[0-9]{3})*(,[0-9]{0,3})?)?$",
							}, {
								Type:  labels.MatchEqual,
								Name:  "Προμηθέας", // Prometheus in Greek
								Value: "Prom",
							}, {
								Type:  labels.MatchNotEqual,
								Name:  "犬", // Dog in Japanese
								Value: "Shiba Inu",
							}},
						}},
					},
				},
				Receivers: []*apimodels.PostableApiReceiver{{
					Receiver: config.Receiver{
						Name: "test",
					},
				}},
			},
		},
	}, {
		name: "configuration with UTF-8 in both matchers and object matchers",
		cfg: apimodels.PostableUserConfig{
			AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
				Config: apimodels.Config{
					Route: &apimodels.Route{
						Receiver: "test",
						Routes: []*apimodels.Route{{
							GroupBy: []model.LabelName{"foo🙂"},
							Matchers: config.Matchers{{
								Type:  labels.MatchEqual,
								Name:  "foo🙂",
								Value: "bar",
							}, {
								Type:  labels.MatchNotEqual,
								Name:  "_bar1",
								Value: "baz🙂",
							}, {
								Type:  labels.MatchRegexp,
								Name:  "0baz",
								Value: "[a-zA-Z0-9]+,?",
							}, {
								Type:  labels.MatchNotRegexp,
								Name:  "corge",
								Value: "^[0-9]+((,[0-9]{3})*(,[0-9]{0,3})?)?$",
							}},
							ObjectMatchers: apimodels.ObjectMatchers{{
								Type:  labels.MatchEqual,
								Name:  "Προμηθέας", // Prometheus in Greek
								Value: "Prom",
							}, {
								Type:  labels.MatchNotEqual,
								Name:  "犬", // Dog in Japanese
								Value: "Shiba Inu",
							}},
						}},
					},
				},
				Receivers: []*apimodels.PostableApiReceiver{{
					Receiver: config.Receiver{
						Name: "test",
					},
				}},
			},
		},
	}, {
		// TODO: Mute time intervals is deprecated in Alertmanager and scheduled to be
		// removed before version 1.0. Remove this test when support for mute time
		// intervals is removed.
		name: "configuration with mute time intervals",
		cfg: apimodels.PostableUserConfig{
			AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
				Config: apimodels.Config{
					Route: &apimodels.Route{
						Receiver: "test",
						Routes: []*apimodels.Route{{
							MuteTimeIntervals: []string{"weekends"},
						}},
					},
					MuteTimeIntervals: []config.MuteTimeInterval{{
						Name: "weekends",
						TimeIntervals: []timeinterval.TimeInterval{{
							Weekdays: []timeinterval.WeekdayRange{{
								InclusiveRange: timeinterval.InclusiveRange{
									Begin: 1,
									End:   5,
								},
							}},
						}},
					}},
				},
				Receivers: []*apimodels.PostableApiReceiver{{
					Receiver: config.Receiver{
						Name: "test",
					},
				}},
			},
		},
	}, {
		name: "configuration with time intervals",
		cfg: apimodels.PostableUserConfig{
			AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
				Config: apimodels.Config{
					Route: &apimodels.Route{
						Receiver: "test",
						Routes: []*apimodels.Route{{
							MuteTimeIntervals: []string{"weekends"},
						}},
					},
					TimeIntervals: []config.TimeInterval{{
						Name: "weekends",
						TimeIntervals: []timeinterval.TimeInterval{{
							Weekdays: []timeinterval.WeekdayRange{{
								InclusiveRange: timeinterval.InclusiveRange{
									Begin: 1,
									End:   5,
								},
							}},
						}},
					}},
				},
				Receivers: []*apimodels.PostableApiReceiver{{
					Receiver: config.Receiver{
						Name: "test",
					},
				}},
			},
		},
	}}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ok, err := client.PostConfiguration(t, tc.cfg)
			if tc.expErr != "" {
				require.EqualError(t, err, tc.expErr)
				require.False(t, ok)
			} else {
				require.NoError(t, err)
				require.True(t, ok)
			}
		})
	}
}

func TestIntegrationAlertmanagerConfigurationIsTransactional(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting:                 true,
		EnableUnifiedAlerting:                 true,
		NGAlertAlertmanagerConfigPollInterval: 2 * time.Second,
		DisableAnonymous:                      true,
		AppModeProduction:                     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	orgService, err := orgimpl.ProvideService(env.SQLStore, env.Cfg, quotatest.New(false, nil))
	require.NoError(t, err)

	// editor from main organisation requests configuration
	alertConfigURL := fmt.Sprintf("http://editor:editor@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)

	// create user under main organisation
	userID := createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
	})

	// create another organisation
	newOrg, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: "another org", UserID: userID})
	require.NoError(t, err)
	orgID := newOrg.ID

	// create user under different organisation
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor-42",
		Login:          "editor-42",
		OrgID:          orgID,
	})

	// On a blank start with no configuration, it saves and delivers the default configuration.
	{
		resp := getRequest(t, alertConfigURL, http.StatusOK) // nolint
		require.JSONEq(t, defaultAlertmanagerConfigJSON, getBody(t, resp.Body))
	}

	// When creating new configuration, if it fails to apply - it does not save it.
	{
		payload := `
{
	"template_files": {},
	"alertmanager_config": {
		"route": {
			"receiver": "slack.receiver"
		},
		"receivers": [{
			"name": "slack.receiver",
			"grafana_managed_receiver_configs": [{
				"settings": {
					"iconEmoji": "",
					"iconUrl": "",
					"mentionGroups": "",
					"mentionUsers": "",
					"recipient": "#unified-alerting-test",
					"username": ""
				},
				"secureSettings": {},
				"type": "slack",
				"name": "slack.receiver",
				"disableResolveMessage": false,
				"uid": ""
			}]
		}]
	}
}
`
		resp := postRequest(t, alertConfigURL, payload, http.StatusBadRequest) // nolint
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var res map[string]any
		require.NoError(t, json.Unmarshal(b, &res))
		require.Regexp(t, `^failed to save and apply Alertmanager configuration: failed to validate integration "slack.receiver" \(UID [^\)]+\) of type "slack": token must be specified when using the Slack chat API`, res["message"])
		resp = getRequest(t, alertConfigURL, http.StatusOK) // nolint

		require.JSONEq(t, defaultAlertmanagerConfigJSON, getBody(t, resp.Body))
	}

	// editor42 from organisation 42 posts configuration
	alertConfigURL = fmt.Sprintf("http://editor-42:editor-42@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)

	// Before we start operating, make sure we've synced this org.
	require.Eventually(t, func() bool {
		resp, err := http.Get(alertConfigURL) // nolint
		require.NoError(t, err)
		return resp.StatusCode == http.StatusOK
	}, 10*time.Second, 2*time.Second)

	// Post the alertmanager config.
	{
		mockChannel := newMockNotificationChannel(t, grafanaListedAddr)
		amConfig := getAlertmanagerConfig(mockChannel.server.Addr)
		postRequest(t, alertConfigURL, amConfig, http.StatusAccepted) // nolint

		// Verifying that the new configuration is returned
		resp := getRequest(t, alertConfigURL, http.StatusOK) // nolint
		b := getBody(t, resp.Body)
		re := regexp.MustCompile(`"uid":"([\w|-]*)"`)
		e := getExpAlertmanagerConfigFromAPI(mockChannel.server.Addr)
		require.JSONEq(t, e, string(re.ReplaceAll([]byte(b), []byte(`"uid":""`))))
	}

	// verify that main organisation still gets the default configuration
	alertConfigURL = fmt.Sprintf("http://editor:editor@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)
	{
		resp := getRequest(t, alertConfigURL, http.StatusOK) // nolint
		require.JSONEq(t, defaultAlertmanagerConfigJSON, getBody(t, resp.Body))
	}
}
