package alerting

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestAvailableChannels(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		AnonymousUserRole:    models.ROLE_EDITOR,
	})

	store := testinfra.SetUpDatabase(t, dir)
	grafanaListedAddr := testinfra.StartGrafana(t, dir, path, store)

	alertsURL := fmt.Sprintf("http://%s/api/alert-notifiers", grafanaListedAddr)
	// nolint:gosec
	resp, err := http.Get(alertsURL)
	require.NoError(t, err)
	t.Cleanup(func() {
		err := resp.Body.Close()
		require.NoError(t, err)
	})
	b, err := ioutil.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)
	require.JSONEq(t, expAvailableChannelJsonOutput, string(b))
}

var expAvailableChannelJsonOutput = `
[
  {
    "type": "dingding",
    "name": "DingDing",
    "heading": "DingDing settings",
    "description": "Sends HTTP POST request to DingDing",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "Url",
        "description": "",
        "placeholder": "https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxx",
        "propertyName": "url",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": true,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "select",
        "inputType": "",
        "label": "Message Type",
        "description": "",
        "placeholder": "",
        "propertyName": "msgType",
        "selectOptions": [
          {
            "value": "link",
            "label": "Link"
          },
          {
            "value": "actionCard",
            "label": "ActionCard"
          }
        ],
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "textarea",
        "inputType": "",
        "label": "Message",
        "description": "",
        "placeholder": "{{ template \"default.message\" . }}",
        "propertyName": "message",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      }
    ]
  },
  {
    "type": "email",
    "name": "Email",
    "heading": "Email settings",
    "description": "Sends notifications using Grafana server configured SMTP settings",
    "info": "",
    "options": [
      {
        "element": "checkbox",
        "inputType": "",
        "label": "Single email",
        "description": "Send a single email to all recipients",
        "placeholder": "",
        "propertyName": "singleEmail",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "textarea",
        "inputType": "",
        "label": "Addresses",
        "description": "You can enter multiple email addresses using a \";\" separator",
        "placeholder": "",
        "propertyName": "addresses",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": true,
        "validationRule": "",
        "secure": false
      }
    ]
  },
  {
    "type": "pagerduty",
    "name": "PagerDuty",
    "heading": "PagerDuty settings",
    "description": "Sends notifications to PagerDuty",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "Integration Key",
        "description": "",
        "placeholder": "Pagerduty Integration Key",
        "propertyName": "integrationKey",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": true,
        "validationRule": "",
        "secure": true
      },
      {
        "element": "select",
        "inputType": "",
        "label": "Severity",
        "description": "",
        "placeholder": "",
        "propertyName": "severity",
        "selectOptions": [
          {
            "value": "critical",
            "label": "Critical"
          },
          {
            "value": "error",
            "label": "Error"
          },
          {
            "value": "warning",
            "label": "Warning"
          },
          {
            "value": "info",
            "label": "Info"
          }
        ],
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Class",
        "description": "The class/type of the event, for example 'ping failure' or 'cpu load'",
        "placeholder": "",
        "propertyName": "class",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Component",
        "description": "Component of the source machine that is responsible for the event, for example mysql or eth0",
        "placeholder": "Grafana",
        "propertyName": "component",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Group",
        "description": "Logical grouping of components of a service, for example 'app-stack'",
        "placeholder": "",
        "propertyName": "group",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "textarea",
        "inputType": "",
        "label": "Summary",
        "description": "You can use templates for summary",
        "placeholder": "{{ template \"default.message\" . }}",
        "propertyName": "summary",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      }
    ]
  },
  {
    "type": "slack",
    "name": "Slack",
    "heading": "Slack settings",
    "description": "Sends notifications to Slack",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "Recipient",
        "description": "Specify channel or user, use #channel-name, @username (has to be all lowercase, no whitespace), or user/channel Slack ID - required unless you provide a webhook",
        "placeholder": "",
        "propertyName": "recipient",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Token",
        "description": "Provide a Slack API token (starts with \"xoxb\") - required unless you provide a webhook",
        "placeholder": "",
        "propertyName": "token",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": true
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Username",
        "description": "Set the username for the bot's message",
        "placeholder": "",
        "propertyName": "username",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Icon emoji",
        "description": "Provide an emoji to use as the icon for the bot's message. Overrides the icon URL.",
        "placeholder": "",
        "propertyName": "icon_emoji",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Icon URL",
        "description": "Provide a URL to an image to use as the icon for the bot's message",
        "placeholder": "",
        "propertyName": "icon_url",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Mention Users",
        "description": "Mention one or more users (comma separated) when notifying in a channel, by ID (you can copy this from the user's Slack profile)",
        "placeholder": "",
        "propertyName": "mentionUsers",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Mention Groups",
        "description": "Mention one or more groups (comma separated) when notifying in a channel (you can copy this from the group's Slack profile URL)",
        "placeholder": "",
        "propertyName": "mentionGroups",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "select",
        "inputType": "",
        "label": "Mention Channel",
        "description": "Mention whole channel or just active members when notifying",
        "placeholder": "",
        "propertyName": "mentionChannel",
        "selectOptions": [
          {
            "value": "",
            "label": "Disabled"
          },
          {
            "value": "here",
            "label": "Every active channel member"
          },
          {
            "value": "channel",
            "label": "Every channel member"
          }
        ],
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Webhook URL",
        "description": "Optionally provide a Slack incoming webhook URL for sending messages, in this case the token isn't necessary",
        "placeholder": "Slack incoming webhook URL",
        "propertyName": "url",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": true
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Title",
        "description": "Templated title of the slack message",
        "placeholder": "{{ template \"slack.default.title\" . }}",
        "propertyName": "title",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "textarea",
        "inputType": "",
        "label": "Text Body",
        "description": "Body of the slack message",
        "placeholder": "{{ template \"slack.default.text\" . }}",
        "propertyName": "text",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      }
    ]
  },
  {
    "type": "teams",
    "name": "Microsoft Teams",
    "heading": "Teams settings",
    "description": "Sends notifications using Incoming Webhook connector to Microsoft Teams",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "URL",
        "description": "",
        "placeholder": "Teams incoming webhook url",
        "propertyName": "url",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": true,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "textarea",
        "inputType": "",
        "label": "Message",
        "description": "",
        "placeholder": "{{ template \"default.message\" . }}",
        "propertyName": "message",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      }
    ]
  },
  {
    "type": "telegram",
    "name": "Telegram",
    "heading": "Telegram API settings",
    "description": "Sends notifications to Telegram",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "BOT API Token",
        "description": "",
        "placeholder": "Telegram BOT API Token",
        "propertyName": "bottoken",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": true,
        "validationRule": "",
        "secure": true
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Chat ID",
        "description": "Integer Telegram Chat Identifier",
        "placeholder": "",
        "propertyName": "chatid",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": true,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "textarea",
        "inputType": "",
        "label": "Message",
        "description": "",
        "placeholder": "{{ template \"default.message\" . }}",
        "propertyName": "message",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      }
    ]
  },
  {
    "type": "webhook",
    "name": "webhook",
    "heading": "Webhook settings",
    "description": "Sends HTTP POST request to a URL",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "Url",
        "description": "",
        "placeholder": "",
        "propertyName": "url",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": true,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "select",
        "inputType": "",
        "label": "Http Method",
        "description": "",
        "placeholder": "",
        "propertyName": "httpMethod",
        "selectOptions": [
          {
            "value": "POST",
            "label": "POST"
          },
          {
            "value": "PUT",
            "label": "PUT"
          }
        ],
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Username",
        "description": "",
        "placeholder": "",
        "propertyName": "username",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "password",
        "label": "Password",
        "description": "",
        "placeholder": "",
        "propertyName": "password",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": true
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Max Alerts",
        "description": "Max alerts to include in a notification. Remaining alerts in the same batch will be ignored above this number. 0 means no limit.",
        "placeholder": "",
        "propertyName": "maxAlerts",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": false
      }
    ]
  }
]
`
