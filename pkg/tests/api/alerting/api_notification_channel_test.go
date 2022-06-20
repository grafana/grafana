package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestTestReceivers(t *testing.T) {
	t.Run("assert no receivers returns 400 Bad Request", func(t *testing.T) {
		// Setup Grafana and its Database
		dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			AppModeProduction:     true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

		createUser(t, env.SQLStore, models.CreateUserCommand{
			DefaultOrgRole: string(models.ROLE_EDITOR),
			Login:          "grafana",
			Password:       "password",
		})

		testReceiversURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/receivers/test", grafanaListedAddr)
		// nolint
		resp := postRequest(t, testReceiversURL, `{
		"receivers": []
	}`, http.StatusBadRequest)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		res := Response{}
		err = json.Unmarshal(b, &res)
		require.NoError(t, err)
		require.NotEmpty(t, res.TraceID)
	})

	t.Run("assert working receiver returns OK", func(t *testing.T) {
		// Setup Grafana and its Database
		dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			AppModeProduction:     true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

		createUser(t, env.SQLStore, models.CreateUserCommand{
			DefaultOrgRole: string(models.ROLE_EDITOR),
			Login:          "grafana",
			Password:       "password",
		})

		mockEmails := &mockEmailHandler{}
		env.NotificationService.EmailHandlerSync = mockEmails.sendEmailCommandHandlerSync

		testReceiversURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/receivers/test", grafanaListedAddr)
		// nolint
		resp := postRequest(t, testReceiversURL, `{
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"uid": "",
					"name": "receiver-1",
					"type": "email",
					"disableResolveMessage": false,
					"settings": {
						"addresses":"example@email.com"
					},
					"secureFields": {}
				}
			]
		}]
	}`, http.StatusOK)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		var result apimodels.TestReceiversResult
		require.NoError(t, json.Unmarshal(b, &result))
		require.Len(t, result.Receivers, 1)
		require.Len(t, result.Receivers[0].Configs, 1)

		expectedJSON := fmt.Sprintf(`{
		"alert": {
			"annotations": {
				"summary": "Notification test",
				"__value_string__": "[ metric='foo' labels={instance=bar} value=10 ]"
			},
			"labels": {
				"alertname": "TestAlert",
				"instance": "Grafana"
			}
		},
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"name": "receiver-1",
					"uid": "%s",
					"status": "ok"
				}
			]
		}],
		"notified_at": "%s"
	}`,
			result.Receivers[0].Configs[0].UID,
			result.NotifiedAt.Format(time.RFC3339Nano))
		require.JSONEq(t, expectedJSON, string(b))

		require.Len(t, mockEmails.emails, 1)
		require.Equal(t, []string{"example@email.com"}, mockEmails.emails[0].To)
	})

	t.Run("assert invalid receiver returns 400 Bad Request", func(t *testing.T) {
		// Setup Grafana and its Database
		dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			AppModeProduction:     true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

		createUser(t, env.SQLStore, models.CreateUserCommand{
			DefaultOrgRole: string(models.ROLE_EDITOR),
			Login:          "grafana",
			Password:       "password",
		})

		mockEmails := &mockEmailHandler{}
		env.NotificationService.EmailHandlerSync = mockEmails.sendEmailCommandHandlerSync

		testReceiversURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/receivers/test", grafanaListedAddr)
		// nolint
		resp := postRequest(t, testReceiversURL, `{
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"uid": "",
					"name": "receiver-1",
					"type": "email",
					"disableResolveMessage": false,
					"settings": {},
					"secureFields": {}
				}
			]
		}]
	}`, http.StatusBadRequest)
		t.Cleanup(func() {
			require.NoError(t, resp.Body.Close())
		})

		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		var result apimodels.TestReceiversResult
		require.NoError(t, json.Unmarshal(b, &result))
		require.Len(t, result.Receivers, 1)
		require.Len(t, result.Receivers[0].Configs, 1)

		expectedJSON := fmt.Sprintf(`{
		"alert": {
			"annotations": {
				"summary": "Notification test",
				"__value_string__": "[ metric='foo' labels={instance=bar} value=10 ]"
			},
			"labels": {
				"alertname": "TestAlert",
				"instance": "Grafana"
			}
		},
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"name": "receiver-1",
					"uid": "%s",
					"status": "failed",
					"error": "the receiver is invalid: failed to validate receiver \"receiver-1\" of type \"email\": could not find addresses in settings"
				}
			]
		}],
		"notified_at": "%s"
	}`,
			result.Receivers[0].Configs[0].UID,
			result.NotifiedAt.Format(time.RFC3339Nano))
		require.JSONEq(t, expectedJSON, string(b))
	})

	t.Run("assert timed out receiver returns 408 Request Timeout", func(t *testing.T) {
		// Setup Grafana and its Database
		dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			AppModeProduction:     true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

		createUser(t, env.SQLStore, models.CreateUserCommand{
			DefaultOrgRole: string(models.ROLE_EDITOR),
			Login:          "grafana",
			Password:       "password",
		})

		mockEmails := &mockEmailHandlerWithTimeout{
			timeout: 5 * time.Second,
		}
		env.NotificationService.EmailHandlerSync = mockEmails.sendEmailCommandHandlerSync

		testReceiversURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/receivers/test", grafanaListedAddr)
		req, err := http.NewRequest(http.MethodPost, testReceiversURL, strings.NewReader(`{
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"uid": "",
					"name": "receiver-1",
					"type": "email",
					"disableResolveMessage": false,
					"settings": {
						"addresses":"example@email.com"
					},
					"secureFields": {}
				}
			]
		}]
	}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Request-Timeout", "1")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		t.Cleanup(func() {
			require.NoError(t, resp.Body.Close())
		})
		require.Equal(t, http.StatusRequestTimeout, resp.StatusCode)

		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		var result apimodels.TestReceiversResult
		require.NoError(t, json.Unmarshal(b, &result))
		require.Len(t, result.Receivers, 1)
		require.Len(t, result.Receivers[0].Configs, 1)

		expectedJSON := fmt.Sprintf(`{
		"alert": {
			"annotations": {
				"summary": "Notification test",
				"__value_string__": "[ metric='foo' labels={instance=bar} value=10 ]"
			},
			"labels": {
				"alertname": "TestAlert",
				"instance": "Grafana"
			}
		},
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"name": "receiver-1",
					"uid": "%s",
					"status": "failed",
					"error": "the receiver timed out: context deadline exceeded"
				}
			]
		}],
		"notified_at": "%s"
	}`,
			result.Receivers[0].Configs[0].UID,
			result.NotifiedAt.Format(time.RFC3339Nano))
		require.JSONEq(t, expectedJSON, string(b))
	})

	t.Run("assert multiple different errors returns 207 Multi Status", func(t *testing.T) {
		// Setup Grafana and its Database
		dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			AppModeProduction:     true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

		createUser(t, env.SQLStore, models.CreateUserCommand{
			DefaultOrgRole: string(models.ROLE_EDITOR),
			Login:          "grafana",
			Password:       "password",
		})

		mockEmails := &mockEmailHandlerWithTimeout{
			timeout: 5 * time.Second,
		}
		env.NotificationService.EmailHandlerSync = mockEmails.sendEmailCommandHandlerSync

		testReceiversURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/receivers/test", grafanaListedAddr)
		req, err := http.NewRequest(http.MethodPost, testReceiversURL, strings.NewReader(`{
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"uid": "",
					"name": "receiver-1",
					"type": "email",
					"disableResolveMessage": false,
					"settings": {},
					"secureFields": {}
				}
			]
		}, {
			"name":"receiver-2",
			"grafana_managed_receiver_configs": [
				{
					"uid": "",
					"name": "receiver-2",
					"type": "email",
					"disableResolveMessage": false,
					"settings": {
						"addresses":"example@email.com"
					},
					"secureFields": {}
				}
			]
		}]
	}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Request-Timeout", "1")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		t.Cleanup(func() {
			require.NoError(t, resp.Body.Close())
		})
		require.Equal(t, http.StatusMultiStatus, resp.StatusCode)

		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		var result apimodels.TestReceiversResult
		require.NoError(t, json.Unmarshal(b, &result))
		require.Len(t, result.Receivers, 2)
		require.Len(t, result.Receivers[0].Configs, 1)
		require.Len(t, result.Receivers[1].Configs, 1)

		expectedJSON := fmt.Sprintf(`{
		"alert": {
			"annotations": {
				"summary": "Notification test",
				"__value_string__": "[ metric='foo' labels={instance=bar} value=10 ]"
			},
			"labels": {
				"alertname": "TestAlert",
				"instance": "Grafana"
			}
		},
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"name": "receiver-1",
					"uid": "%s",
					"status": "failed",
					"error": "the receiver is invalid: failed to validate receiver \"receiver-1\" of type \"email\": could not find addresses in settings"
				}
			]
		}, {
			"name":"receiver-2",
			"grafana_managed_receiver_configs": [
				{
					"name": "receiver-2",
					"uid": "%s",
					"status": "failed",
					"error": "the receiver timed out: context deadline exceeded"
				}
			]
		}],
		"notified_at": "%s"
	}`,
			result.Receivers[0].Configs[0].UID,
			result.Receivers[1].Configs[0].UID,
			result.NotifiedAt.Format(time.RFC3339Nano))
		require.JSONEq(t, expectedJSON, string(b))
	})
}

func TestTestReceiversAlertCustomization(t *testing.T) {
	t.Run("assert custom annotations and labels are sent", func(t *testing.T) {
		// Setup Grafana and its Database
		dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			AppModeProduction:     true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

		createUser(t, env.SQLStore, models.CreateUserCommand{
			DefaultOrgRole: string(models.ROLE_EDITOR),
			Login:          "grafana",
			Password:       "password",
		})

		mockEmails := &mockEmailHandler{}
		env.NotificationService.EmailHandlerSync = mockEmails.sendEmailCommandHandlerSync

		testReceiversURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/receivers/test", grafanaListedAddr)
		// nolint
		resp := postRequest(t, testReceiversURL, `{
		"alert": {
			"annotations": {
				"annotation1": "value1",
				"__value_string__": "[ metric='foo' labels={instance=bar} value=10 ]"
			},
			"labels": {
				"label1": "value1"
			}
		},
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"uid":"",
					"name":"receiver-1",
					"type":"email",
					"disableResolveMessage":false,
					"settings":{
						"addresses":"example@email.com"
					},
					"secureFields":{}
				}
			]
		}]
	}`, http.StatusOK)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		var result apimodels.TestReceiversResult
		require.NoError(t, json.Unmarshal(b, &result))
		require.Len(t, result.Receivers, 1)
		require.Len(t, result.Receivers[0].Configs, 1)

		expectedJSON := fmt.Sprintf(`{
		"alert": {
			"annotations": {
				"annotation1": "value1",
				"summary": "Notification test",
				"__value_string__": "[ metric='foo' labels={instance=bar} value=10 ]"
			},
			"labels": {
				"alertname": "TestAlert",
				"instance": "Grafana",
				"label1": "value1"
			}
		},
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"name": "receiver-1",
					"uid": "%s",
					"status": "ok"
				}
			]
		}],
		"notified_at": "%s"
	}`,
			result.Receivers[0].Configs[0].UID,
			result.NotifiedAt.Format(time.RFC3339Nano))
		require.JSONEq(t, expectedJSON, string(b))

		require.Len(t, mockEmails.emails, 1)
		require.Equal(t, []string{"example@email.com"}, mockEmails.emails[0].To)
	})

	t.Run("assert custom annotations can replace default annotations", func(t *testing.T) {
		// Setup Grafana and its Database
		dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			AppModeProduction:     true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

		createUser(t, env.SQLStore, models.CreateUserCommand{
			DefaultOrgRole: string(models.ROLE_EDITOR),
			Login:          "grafana",
			Password:       "password",
		})

		mockEmails := &mockEmailHandler{}
		env.NotificationService.EmailHandlerSync = mockEmails.sendEmailCommandHandlerSync

		testReceiversURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/receivers/test", grafanaListedAddr)
		// nolint
		resp := postRequest(t, testReceiversURL, `{
		"alert": {
			"annotations": {
				"summary": "This is a custom annotation",
				"__value_string__": "[ metric='foo' labels={instance=bar} value=10 ]"
			}
		},
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"uid":"",
					"name":"receiver-1",
					"type":"email",
					"disableResolveMessage":false,
					"settings":{
						"addresses":"example@email.com"
					},
					"secureFields":{}
				}
			]
		}]
	}`, http.StatusOK)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		var result apimodels.TestReceiversResult
		require.NoError(t, json.Unmarshal(b, &result))
		require.Len(t, result.Receivers, 1)
		require.Len(t, result.Receivers[0].Configs, 1)

		expectedJSON := fmt.Sprintf(`{
		"alert": {
			"annotations": {
				"summary": "This is a custom annotation",
				"__value_string__": "[ metric='foo' labels={instance=bar} value=10 ]"
			},
			"labels": {
				"alertname": "TestAlert",
				"instance": "Grafana"
			}
		},
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"name": "receiver-1",
					"uid": "%s",
					"status": "ok"
				}
			]
		}],
		"notified_at": "%s"
	}`,
			result.Receivers[0].Configs[0].UID,
			result.NotifiedAt.Format(time.RFC3339Nano))
		require.JSONEq(t, expectedJSON, string(b))

		require.Len(t, mockEmails.emails, 1)
		require.Equal(t, []string{"example@email.com"}, mockEmails.emails[0].To)
	})

	t.Run("assert custom labels can replace default label", func(t *testing.T) {
		// Setup Grafana and its Database
		dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			AppModeProduction:     true,
		})

		grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

		createUser(t, env.SQLStore, models.CreateUserCommand{
			DefaultOrgRole: string(models.ROLE_EDITOR),
			Login:          "grafana",
			Password:       "password",
		})

		mockEmails := &mockEmailHandler{}
		env.NotificationService.EmailHandlerSync = mockEmails.sendEmailCommandHandlerSync

		testReceiversURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/receivers/test", grafanaListedAddr)
		// nolint
		resp := postRequest(t, testReceiversURL, `{
		"alert": {
			"labels": {
				"alertname": "This is a custom label"
			}
		},
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"uid":"",
					"name":"receiver-1",
					"type":"email",
					"disableResolveMessage":false,
					"settings":{
						"addresses":"example@email.com"
					},
					"secureFields":{}
				}
			]
		}]
	}`, http.StatusOK)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)

		var result apimodels.TestReceiversResult
		require.NoError(t, json.Unmarshal(b, &result))
		require.Len(t, result.Receivers, 1)
		require.Len(t, result.Receivers[0].Configs, 1)

		expectedJSON := fmt.Sprintf(`{
		"alert": {
			"annotations": {
				"summary": "Notification test",
				"__value_string__": "[ metric='foo' labels={instance=bar} value=10 ]"
			},
			"labels": {
				"alertname": "This is a custom label",
				"instance": "Grafana"
			}
		},
		"receivers": [{
			"name":"receiver-1",
			"grafana_managed_receiver_configs": [
				{
					"name": "receiver-1",
					"uid": "%s",
					"status": "ok"
				}
			]
		}],
		"notified_at": "%s"
	}`,
			result.Receivers[0].Configs[0].UID,
			result.NotifiedAt.Format(time.RFC3339Nano))
		require.JSONEq(t, expectedJSON, string(b))

		require.Len(t, mockEmails.emails, 1)
		require.Equal(t, []string{"example@email.com"}, mockEmails.emails[0].To)
	})
}

func TestNotificationChannels(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	mockChannel := newMockNotificationChannel(t, grafanaListedAddr)
	amConfig := getAlertmanagerConfig(mockChannel.server.Addr)
	mockEmail := &mockEmailHandler{}

	// Overriding some URLs to send to the mock channel.
	os, opa, ot, opu, ogb, ol, oth := channels.SlackAPIEndpoint, channels.PagerdutyEventAPIURL,
		channels.TelegramAPIURL, channels.PushoverEndpoint, channels.GetBoundary,
		channels.LineNotifyURL, channels.ThreemaGwBaseURL
	originalTemplate := channels.DefaultTemplateString
	t.Cleanup(func() {
		channels.SlackAPIEndpoint, channels.PagerdutyEventAPIURL,
			channels.TelegramAPIURL, channels.PushoverEndpoint, channels.GetBoundary,
			channels.LineNotifyURL, channels.ThreemaGwBaseURL = os, opa, ot, opu, ogb, ol, oth
		channels.DefaultTemplateString = originalTemplate
	})
	channels.DefaultTemplateString = channels.TemplateForTestsString
	channels.SlackAPIEndpoint = fmt.Sprintf("http://%s/slack_recvX/slack_testX", mockChannel.server.Addr)
	channels.PagerdutyEventAPIURL = fmt.Sprintf("http://%s/pagerduty_recvX/pagerduty_testX", mockChannel.server.Addr)
	channels.TelegramAPIURL = fmt.Sprintf("http://%s/telegram_recv/bot%%s", mockChannel.server.Addr)
	channels.PushoverEndpoint = fmt.Sprintf("http://%s/pushover_recv/pushover_test", mockChannel.server.Addr)
	channels.LineNotifyURL = fmt.Sprintf("http://%s/line_recv/line_test", mockChannel.server.Addr)
	channels.ThreemaGwBaseURL = fmt.Sprintf("http://%s/threema_recv/threema_test", mockChannel.server.Addr)
	channels.GetBoundary = func() string { return "abcd" }

	env.NotificationService.EmailHandlerSync = mockEmail.sendEmailCommandHandlerSync
	// As we are using a NotificationService mock here, but he test expects real NotificationService -
	// we try to issue a real POST request here
	env.NotificationService.WebhookHandler = func(_ context.Context, cmd *models.SendWebhookSync) error {
		if res, err := http.Post(cmd.Url, "", strings.NewReader(cmd.Body)); err == nil {
			_ = res.Body.Close()
		}
		return nil
	}

	// Create a user to make authenticated requests
	createUser(t, env.SQLStore, models.CreateUserCommand{
		DefaultOrgRole: string(models.ROLE_EDITOR),
		Password:       "password",
		Login:          "grafana",
	})

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
		err := createFolder(t, "default", grafanaListedAddr, "grafana", "password")
		require.NoError(t, err)
		reloadCachedPermissions(t, grafanaListedAddr, "grafana", "password")

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
		return mockChannel.totalNotifications() >= len(nonEmailAlertNames) && len(mockEmail.emails) >= 1
	}, 30*time.Second, 1*time.Second)

	mockChannel.matchesExpNotifications(t, expNonEmailNotifications)
	require.Equal(t, expEmailNotifications, mockEmail.emails)
	require.NoError(t, mockChannel.Close())

	{
		// Delete the configuration; so it returns the default configuration.
		u := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)
		req, err := http.NewRequest(http.MethodDelete, u, nil)
		require.NoError(t, err)
		client := &http.Client{}
		resp, err := client.Do(req)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, 202, resp.StatusCode)
		require.JSONEq(t, `{"message":"configuration deleted; the default is applied"}`, string(b))

		alertsURL := fmt.Sprintf("http://grafana:password@%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)
		resp = getRequest(t, alertsURL, http.StatusOK) // nolint
		b, err = ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.JSONEq(t, defaultAlertmanagerConfigJSON, string(b))
	}
}

func getAlertmanagerConfig(channelAddr string) string {
	return strings.ReplaceAll(alertmanagerConfig, "CHANNEL_ADDR", channelAddr)
}

func getExpAlertmanagerConfigFromAPI(channelAddr string) string {
	return strings.ReplaceAll(expAlertmanagerConfigFromAPI, "CHANNEL_ADDR", channelAddr)
}

// nonEmailAlertNames are name of alerts to be sent for non-email channels. This should be in sync with
// the routes that we define in Alertmanager config.
var nonEmailAlertNames = []string{
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

// emailAlertNames are name of alerts to be sent via email. This should be in sync with
// the routes that we define in Alertmanager config.
var emailAlertNames = []string{
	"EmailAlert",
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
	for _, alertName := range append(nonEmailAlertNames, emailAlertNames...) {
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
	// Spin up a separate webserver to receive notifications emitted by Grafana.
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	nc := &mockNotificationChannel{
		server: &http.Server{
			Addr: listener.Addr().String(),
		},
		receivedNotifications: make(map[string][]string),
		t:                     t,
	}

	nc.server.Handler = nc
	go func() {
		require.EqualError(t, nc.server.Serve(listener), http.ErrServerClosed.Error())
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

type mockEmailHandler struct {
	emails []*models.SendEmailCommandSync
}

func (e *mockEmailHandler) sendEmailCommandHandlerSync(_ context.Context, cmd *models.SendEmailCommandSync) error {
	// We 0 out the start time since that is a variable that we cannot predict.
	alerts := cmd.Data["Alerts"].(channels.ExtendedAlerts)
	for i := range alerts {
		alerts[i].StartsAt = time.Time{}
	}

	e.emails = append(e.emails, cmd)
	return nil
}

// mockEmailHandlerWithTimeout blocks until the timeout has expired.
type mockEmailHandlerWithTimeout struct {
	mockEmailHandler
	timeout time.Duration
}

func (e *mockEmailHandlerWithTimeout) sendEmailCommandHandlerSync(ctx context.Context, cmd *models.SendEmailCommandSync) error {
	select {
	case <-time.After(e.timeout):
		return e.mockEmailHandler.sendEmailCommandHandlerSync(ctx, cmd)
	case <-ctx.Done():
		return ctx.Err()
	}
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
            "type": "LINE",
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
            "type": "LINE",
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

var expEmailNotifications = []*models.SendEmailCommandSync{
	{
		SendEmailCommand: models.SendEmailCommand{
			To:          []string{"test@email.com"},
			SingleEmail: true,
			Template:    "ng_alert_notification",
			Subject:     "[FIRING:1] EmailAlert (default)",
			Data: map[string]interface{}{
				"Title":   "[FIRING:1] EmailAlert (default)",
				"Message": "",
				"Status":  "firing",
				"Alerts": channels.ExtendedAlerts{
					channels.ExtendedAlert{
						Status:       "firing",
						Labels:       template.KV{"alertname": "EmailAlert", "grafana_folder": "default"},
						Annotations:  template.KV{},
						StartsAt:     time.Time{},
						EndsAt:       time.Time{},
						GeneratorURL: "http://localhost:3000/alerting/grafana/UID_EmailAlert/view",
						Fingerprint:  "1e8f5e886dc14813",
						SilenceURL:   "http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%3DEmailAlert&matcher=grafana_folder%3Ddefault",
						DashboardURL: "",
						PanelURL:     "",
						ValueString:  "[ var='A' labels={} value=1 ]",
					},
				},
				"GroupLabels":       template.KV{"alertname": "EmailAlert"},
				"CommonLabels":      template.KV{"alertname": "EmailAlert", "grafana_folder": "default"},
				"CommonAnnotations": template.KV{},
				"ExternalURL":       "http://localhost:3000/",
				"RuleUrl":           "http://localhost:3000/alerting/list",
				"AlertPageUrl":      "http://localhost:3000/alerting/list?alertState=firing&view=state",
			},
		},
	},
}

// expNonEmailNotifications is all the expected notifications (except email).
// The key for the map is taken from the URL. The last 2 components of URL
// split with "/" forms the key for that route.
var expNonEmailNotifications = map[string][]string{
	"slack_recv1/slack_test_without_token": {
		`{
		  "channel": "#test-channel",
		  "username": "Integration Test",
		  "icon_emoji": "🚀",
		  "icon_url": "https://awesomeemoji.com/rocket",
		  "attachments": [
			{
			  "title": "Integration Test [FIRING:1] SlackAlert1 (default)",
			  "title_link": "http://localhost:3000/alerting/list",
			  "text": "Integration Test ",
			  "fallback": "Integration Test [FIRING:1] SlackAlert1 (default)",
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
			  "title": "[FIRING:1] SlackAlert2 (default)",
			  "title_link": "http://localhost:3000/alerting/list",
			  "text": "**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = SlackAlert2\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_SlackAlert2/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%%3DSlackAlert2&matcher=grafana_folder%%3Ddefault\n",
			  "fallback": "[FIRING:1] SlackAlert2 (default)",
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
		  "description": "[FIRING:1] PagerdutyAlert (default)",
		  "event_action": "trigger",
		  "payload": {
			"summary": "Integration Test [FIRING:1] PagerdutyAlert (default)",
			"source": "%s",
			"severity": "warning",
			"class": "testclass",
			"component": "Integration Test",
			"group": "testgroup",
			"custom_details": {
			  "firing": "\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = PagerdutyAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_PagerdutyAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%%3DPagerdutyAlert&matcher=grafana_folder%%3Ddefault\n",
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
			"text": "**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = DingDingAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_DingDingAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%3DDingDingAlert&matcher=grafana_folder%3Ddefault\n",
			"title": "[FIRING:1] DingDingAlert (default)"
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
			  "text": "**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = TeamsAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_TeamsAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%3DTeamsAlert&matcher=grafana_folder%3Ddefault\n",
			  "title": ""
			}
		  ],
		  "summary": "[FIRING:1] TeamsAlert (default)",
		  "themeColor": "#D63232",
		  "title": "[FIRING:1] TeamsAlert (default)"
		}`,
	},
	"webhook_recv/webhook_test": {
		`{
		  "receiver": "webhook_recv",
		  "status": "firing",
		  "orgId": 1,
		  "alerts": [
			{
			  "status": "firing",
			  "labels": {
				"alertname": "WebhookAlert",
				"grafana_folder": "default"
			  },
			  "annotations": {},
			  "startsAt": "%s",
        "valueString": "[ var='A' labels={} value=1 ]",
			  "endsAt": "0001-01-01T00:00:00Z",
			  "generatorURL": "http://localhost:3000/alerting/grafana/UID_WebhookAlert/view",
			  "fingerprint": "15c59b0a380bd9f1",
			  "silenceURL": "http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%%3DWebhookAlert&matcher=grafana_folder%%3Ddefault",
			  "dashboardURL": "",
			  "panelURL": ""
			}
		  ],
		  "groupLabels": {
			"alertname": "WebhookAlert"
		  },
		  "commonLabels": {
			"alertname": "WebhookAlert",
			"grafana_folder": "default"
		  },
		  "commonAnnotations": {},
		  "externalURL": "http://localhost:3000/",
		  "version": "1",
		  "groupKey": "{}/{alertname=\"WebhookAlert\"}:{alertname=\"WebhookAlert\"}",
		  "truncatedAlerts": 0,
		  "title": "[FIRING:1] WebhookAlert (default)",
		  "state": "alerting",
		  "message": "**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = WebhookAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_WebhookAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%%3DWebhookAlert&matcher=grafana_folder%%3Ddefault\n"
		}`,
	},
	"discord_recv/discord_test": {
		`{
		  "content": "**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = DiscordAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_DiscordAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%3DDiscordAlert&matcher=grafana_folder%3Ddefault\n",
		  "embeds": [
			{
			  "color": 14037554,
			  "footer": {
				"icon_url": "https://grafana.com/assets/img/fav32.png",
				"text": "Grafana v"
			  },
			  "title": "[FIRING:1] DiscordAlert (default)",
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
			"output": "**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = SensuGoAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_SensuGoAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%%3DSensuGoAlert&matcher=grafana_folder%%3Ddefault\n",
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
		"--abcd\r\nContent-Disposition: form-data; name=\"user\"\r\n\r\nmysecretkey\r\n--abcd\r\nContent-Disposition: form-data; name=\"token\"\r\n\r\nmysecrettoken\r\n--abcd\r\nContent-Disposition: form-data; name=\"priority\"\r\n\r\n0\r\n--abcd\r\nContent-Disposition: form-data; name=\"sound\"\r\n\r\n\r\n--abcd\r\nContent-Disposition: form-data; name=\"title\"\r\n\r\n[FIRING:1] PushoverAlert (default)\r\n--abcd\r\nContent-Disposition: form-data; name=\"url\"\r\n\r\nhttp://localhost:3000/alerting/list\r\n--abcd\r\nContent-Disposition: form-data; name=\"url_title\"\r\n\r\nShow alert rule\r\n--abcd\r\nContent-Disposition: form-data; name=\"message\"\r\n\r\n**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = PushoverAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_PushoverAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%3DPushoverAlert&matcher=grafana_folder%3Ddefault\n\r\n--abcd\r\nContent-Disposition: form-data; name=\"html\"\r\n\r\n1\r\n--abcd--\r\n",
	},
	"telegram_recv/bot6sh027hs034h": {
		"--abcd\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\ntelegram_chat_id\r\n--abcd\r\nContent-Disposition: form-data; name=\"parse_mode\"\r\n\r\nhtml\r\n--abcd\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\n**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = TelegramAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_TelegramAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%3DTelegramAlert&matcher=grafana_folder%3Ddefault\n\r\n--abcd--\r\n",
	},
	"googlechat_recv/googlechat_test": {
		`{
		  "previewText": "[FIRING:1] GoogleChatAlert (default)",
		  "fallbackText": "[FIRING:1] GoogleChatAlert (default)",
		  "cards": [
			{
			  "header": {
				"title": "[FIRING:1] GoogleChatAlert (default)"
			  },
			  "sections": [
				{
				  "widgets": [
					{
					  "textParagraph": {
						"text": "**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = GoogleChatAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_GoogleChatAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%%3DGoogleChatAlert&matcher=grafana_folder%%3Ddefault\n"
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
				"description": "[FIRING:1] KafkaAlert (default)",
				"details": "**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = KafkaAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_KafkaAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%3DKafkaAlert&matcher=grafana_folder%3Ddefault\n",
				"incident_key": "35c0bdb1715f9162a20d7b2a01cb2e3a4c5b1dc663571701e3f67212b696332f"
			  }
			}
		  ]
		}`,
	},
	"line_recv/line_test": {
		`message=%5BFIRING%3A1%5D+LineAlert+%28default%29%0Ahttp%3A%2Flocalhost%3A3000%2Falerting%2Flist%0A%0A%2A%2AFiring%2A%2A%0A%0AValue%3A+%5B+var%3D%27A%27+labels%3D%7B%7D+value%3D1+%5D%0ALabels%3A%0A+-+alertname+%3D+LineAlert%0A+-+grafana_folder+%3D+default%0AAnnotations%3A%0ASource%3A+http%3A%2F%2Flocalhost%3A3000%2Falerting%2Fgrafana%2FUID_LineAlert%2Fview%0ASilence%3A+http%3A%2F%2Flocalhost%3A3000%2Falerting%2Fsilence%2Fnew%3Falertmanager%3Dgrafana%26matcher%3Dalertname%253DLineAlert%26matcher%3Dgrafana_folder%253Ddefault%0A`,
	},
	"threema_recv/threema_test": {
		`from=%2A1234567&secret=myapisecret&text=%E2%9A%A0%EF%B8%8F+%5BFIRING%3A1%5D+ThreemaAlert+%28default%29%0A%0A%2AMessage%3A%2A%0A%2A%2AFiring%2A%2A%0A%0AValue%3A+%5B+var%3D%27A%27+labels%3D%7B%7D+value%3D1+%5D%0ALabels%3A%0A+-+alertname+%3D+ThreemaAlert%0A+-+grafana_folder+%3D+default%0AAnnotations%3A%0ASource%3A+http%3A%2F%2Flocalhost%3A3000%2Falerting%2Fgrafana%2FUID_ThreemaAlert%2Fview%0ASilence%3A+http%3A%2F%2Flocalhost%3A3000%2Falerting%2Fsilence%2Fnew%3Falertmanager%3Dgrafana%26matcher%3Dalertname%253DThreemaAlert%26matcher%3Dgrafana_folder%253Ddefault%0A%0A%2AURL%3A%2A+http%3A%2Flocalhost%3A3000%2Falerting%2Flist%0A&to=abcdefgh`,
	},
	"victorops_recv/victorops_test": {
		`{
		  "alert_url": "http://localhost:3000/alerting/list",
		  "entity_display_name": "[FIRING:1] VictorOpsAlert (default)",
		  "entity_id": "633ae988fa7074bcb51f3d1c5fef2ba1c5c4ccb45b3ecbf681f7d507b078b1ae",
		  "message_type": "CRITICAL",
		  "monitoring_tool": "Grafana v",
		  "state_message": "**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = VictorOpsAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_VictorOpsAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%%3DVictorOpsAlert&matcher=grafana_folder%%3Ddefault\n",
		  "timestamp": %s
		}`,
	},
	"opsgenie_recv/opsgenie_test": {
		`{
		  "alias": "47e92f0f6ef9fe99f3954e0d6155f8d09c4b9a038d8c3105e82c0cee4c62956e",
		  "description": "[FIRING:1] OpsGenieAlert (default)\nhttp://localhost:3000/alerting/list\n\n**Firing**\n\nValue: [ var='A' labels={} value=1 ]\nLabels:\n - alertname = OpsGenieAlert\n - grafana_folder = default\nAnnotations:\nSource: http://localhost:3000/alerting/grafana/UID_OpsGenieAlert/view\nSilence: http://localhost:3000/alerting/silence/new?alertmanager=grafana&matcher=alertname%3DOpsGenieAlert&matcher=grafana_folder%3Ddefault\n",
		  "details": {
			"url": "http://localhost:3000/alerting/list"
		  },
		  "message": "[FIRING:1] OpsGenieAlert (default)",
		  "source": "Grafana",
		  "tags": ["alertname:OpsGenieAlert","grafana_folder:default"]
		}`,
	},
	// Prometheus Alertmanager.
	"v1/alerts": {
		`[
		  {
			"labels": {
			  "__alert_rule_uid__": "UID_AlertmanagerAlert",
			  "alertname": "AlertmanagerAlert",
			  "grafana_folder": "default"
			},
			"annotations": {
        "__value_string__": "[ var='A' labels={} value=1 ]"
      },
			"startsAt": "%s",
			"endsAt": "0001-01-01T00:00:00Z",
			"generatorURL": "http://localhost:3000/alerting/grafana/UID_AlertmanagerAlert/view",
			"UpdatedAt": "%s",
			"Timeout": false
		  }
		]`,
	},
}
