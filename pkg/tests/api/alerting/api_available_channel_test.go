package alerting

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestAvailableChannels(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		DisableAnonymous:     true,
	})

	store := testinfra.SetUpDatabase(t, dir)
	store.Bus = bus.GetBus()
	grafanaListedAddr := testinfra.StartGrafana(t, dir, path, store)

	// Create a user to make authenticated requests
	require.NoError(t, createUser(t, store, models.ROLE_EDITOR, "grafana", "password"))

	alertsURL := fmt.Sprintf("http://grafana:password@%s/api/alert-notifiers", grafanaListedAddr)
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
    "type": "kafka",
    "name": "Kafka REST Proxy",
    "heading": "Kafka settings",
    "description": "Sends notifications to Kafka Rest Proxy",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "Kafka REST Proxy",
        "description": "",
        "placeholder": "http://localhost:8082",
        "propertyName": "kafkaRestProxy",
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
        "element": "input",
        "inputType": "text",
        "label": "Topic",
        "description": "",
        "placeholder": "topic1",
        "propertyName": "kafkaTopic",
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
      },
      {
        "element": "textarea",
        "inputType": "",
        "label": "Message",
        "description": "Optional message to include with the email. You can use template variables",
        "placeholder": "",
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
    "type": "victorops",
    "name": "VictorOps",
    "heading": "VictorOps settings",
    "description": "Sends notifications to VictorOps",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "Url",
        "description": "",
        "placeholder": "VictorOps url",
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
        "propertyName": "messageType",
        "selectOptions": [
          {
            "value": "CRITICAL",
            "label": "CRITICAL"
          },
          {
            "value": "WARNING",
            "label": "WARNING"
          }
        ],
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
    "type": "pushover",
    "name": "Pushover",
    "description": "Sends HTTP POST request to the Pushover API",
    "heading": "Pushover settings",
    "info": "",
    "options": [
        {
            "element": "input",
            "inputType": "text",
            "label": "API Token",
            "description": "",
            "placeholder": "Application token",
            "propertyName": "apiToken",
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
            "label": "User key(s)",
            "description": "",
            "placeholder": "comma-separated list",
            "propertyName": "userKey",
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
            "label": "Device(s) (optional)",
            "description": "",
            "placeholder": "comma-separated list; leave empty to send to all devices",
            "propertyName": "device",
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
            "label": "Alerting priority",
            "description": "",
            "placeholder": "",
            "propertyName": "priority",
            "selectOptions": [
                {
                    "value": "2",
                    "label": "Emergency"
                },
                {
                    "value": "1",
                    "label": "High"
                },
                {
                    "value": "0",
                    "label": "Normal"
                },
                {
                    "value": "-1",
                    "label": "Low"
                },
                {
                    "value": "-2",
                    "label": "Lowest"
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
            "element": "select",
            "inputType": "",
            "label": "OK priority",
            "description": "",
            "placeholder": "",
            "propertyName": "okPriority",
            "selectOptions": [
                {
                    "value": "2",
                    "label": "Emergency"
                },
                {
                    "value": "1",
                    "label": "High"
                },
                {
                    "value": "0",
                    "label": "Normal"
                },
                {
                    "value": "-1",
                    "label": "Low"
                },
                {
                    "value": "-2",
                    "label": "Lowest"
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
            "label": "Retry (Only used for Emergency Priority)",
            "description": "How often (in seconds) the Pushover servers will send the same alerting or OK notification to the user.",
            "placeholder": "minimum 30 seconds",
            "propertyName": "retry",
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
            "label": "Expire (Only used for Emergency Priority)",
            "description": "How many seconds the alerting or OK notification will continue to be retried.",
            "placeholder": "maximum 86400 seconds",
            "propertyName": "expire",
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
            "label": "Alerting sound",
            "description": "",
            "placeholder": "",
            "propertyName": "sound",
            "selectOptions": [
                {
                    "value": "default",
                    "label": "Default"
                },
                {
                    "value": "pushover",
                    "label": "Pushover"
                },
                {
                    "value": "bike",
                    "label": "Bike"
                },
                {
                    "value": "bugle",
                    "label": "Bugle"
                },
                {
                    "value": "cashregister",
                    "label": "Cashregister"
                },
                {
                    "value": "classical",
                    "label": "Classical"
                },
                {
                    "value": "cosmic",
                    "label": "Cosmic"
                },
                {
                    "value": "falling",
                    "label": "Falling"
                },
                {
                    "value": "gamelan",
                    "label": "Gamelan"
                },
                {
                    "value": "incoming",
                    "label": "Incoming"
                },
                {
                    "value": "intermission",
                    "label": "Intermission"
                },
                {
                    "value": "magic",
                    "label": "Magic"
                },
                {
                    "value": "mechanical",
                    "label": "Mechanical"
                },
                {
                    "value": "pianobar",
                    "label": "Pianobar"
                },
                {
                    "value": "siren",
                    "label": "Siren"
                },
                {
                    "value": "spacealarm",
                    "label": "Spacealarm"
                },
                {
                    "value": "tugboat",
                    "label": "Tugboat"
                },
                {
                    "value": "alien",
                    "label": "Alien"
                },
                {
                    "value": "climb",
                    "label": "Climb"
                },
                {
                    "value": "persistent",
                    "label": "Persistent"
                },
                {
                    "value": "echo",
                    "label": "Echo"
                },
                {
                    "value": "updown",
                    "label": "Updown"
                },
                {
                    "value": "none",
                    "label": "None"
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
            "element": "select",
            "inputType": "",
            "label": "OK sound",
            "description": "",
            "placeholder": "",
            "propertyName": "okSound",
            "selectOptions": [
                {
                    "value": "default",
                    "label": "Default"
                },
                {
                    "value": "pushover",
                    "label": "Pushover"
                },
                {
                    "value": "bike",
                    "label": "Bike"
                },
                {
                    "value": "bugle",
                    "label": "Bugle"
                },
                {
                    "value": "cashregister",
                    "label": "Cashregister"
                },
                {
                    "value": "classical",
                    "label": "Classical"
                },
                {
                    "value": "cosmic",
                    "label": "Cosmic"
                },
                {
                    "value": "falling",
                    "label": "Falling"
                },
                {
                    "value": "gamelan",
                    "label": "Gamelan"
                },
                {
                    "value": "incoming",
                    "label": "Incoming"
                },
                {
                    "value": "intermission",
                    "label": "Intermission"
                },
                {
                    "value": "magic",
                    "label": "Magic"
                },
                {
                    "value": "mechanical",
                    "label": "Mechanical"
                },
                {
                    "value": "pianobar",
                    "label": "Pianobar"
                },
                {
                    "value": "siren",
                    "label": "Siren"
                },
                {
                    "value": "spacealarm",
                    "label": "Spacealarm"
                },
                {
                    "value": "tugboat",
                    "label": "Tugboat"
                },
                {
                    "value": "alien",
                    "label": "Alien"
                },
                {
                    "value": "climb",
                    "label": "Climb"
                },
                {
                    "value": "persistent",
                    "label": "Persistent"
                },
                {
                    "value": "echo",
                    "label": "Echo"
                },
                {
                    "value": "updown",
                    "label": "Updown"
                },
                {
                    "value": "none",
                    "label": "None"
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
    "type": "sensugo",
    "name": "Sensu Go",
    "description": "Sends HTTP POST request to a Sensu Go API",
		"heading":     "Sensu Go Settings",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "Backend URL",
        "description": "",
        "placeholder": "http://sensu-api.local:8080",
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
        "element": "input",
        "inputType": "password",
        "label": "API Key",
        "description": "API key to auth to Sensu Go backend",
        "placeholder": "",
        "propertyName": "apikey",
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
        "label": "Proxy entity name",
        "description": "",
        "placeholder": "default",
        "propertyName": "entity",
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
        "label": "Check name",
        "description": "",
        "placeholder": "default",
        "propertyName": "check",
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
        "label": "Handler",
        "description": "",
        "placeholder": "",
        "propertyName": "handler",
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
        "label": "Namespace",
        "description": "",
        "placeholder": "default",
        "propertyName": "namespace",
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
  },
  {
    "type": "prometheus-alertmanager",
    "name": "Alertmanager",
    "heading": "Alertmanager Settings",
    "description": "Sends notifications to Alertmanager",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "URL",
        "description": "",
	"placeholder": "http://localhost:9093",
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
        "element": "input",
        "inputType": "text",
        "label": "Basic Auth User",
        "description": "",
	"placeholder": "",
        "propertyName": "basicAuthUser",
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
        "label": "Basic Auth Password",
        "description": "",
	"placeholder": "",
        "propertyName": "basicAuthPassword",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": false,
        "validationRule": "",
        "secure": true
      }
    ]
  },
  {
	"type": "discord",
	"name": "Discord",
	"heading": "Discord settings",
	"description": "Sends notifications to Discord",
	"info": "",
	"options": [
      {
		"label": "Message Content",
		"description": "Mention a group using @ or a user using <@ID> when notifying in a channel",
		"element": "input",
		"inputType": "text",
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
	  },
	  {
		"label": "Webhook URL",
		"description": "",
		"element": "input",
		"inputType": "text",
		"placeholder": "Discord webhook URL",
		"propertyName": "url",
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
    "type": "googlechat",
    "name": "Google Hangouts Chat",
    "heading": "Google Hangouts Chat settings",
    "description": "Sends notifications to Google Hangouts Chat via webhooks based on the official JSON message format",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "Url",
        "description": "",
        "placeholder": "Google Hangouts Chat incoming webhook url",
        "propertyName": "url",
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
    "type": "LINE",
    "name": "LINE",
    "heading": "LINE notify settings",
    "description": "Send notifications to LINE notify",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "Token",
        "description": "",
        "placeholder": "LINE notify token key",
        "propertyName": "token",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": true,
        "validationRule": "",
        "secure": true
      }
    ]
  },
  {
    "type": "threema",
    "name": "Threema Gateway",
    "heading": "Threema Gateway settings",
    "description": "Sends notifications to Threema using Threema Gateway (Basic IDs)",
    "info": "Notifications can be configured for any Threema Gateway ID of type \"Basic\". End-to-End IDs are not currently supported.The Threema Gateway ID can be set up at https://gateway.threema.ch/.",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "Gateway ID",
        "description": "Your 8 character Threema Gateway Basic ID (starting with a *).",
        "placeholder": "*3MAGWID",
        "propertyName": "gateway_id",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": true,
        "validationRule": "\\*[0-9A-Z]{7}",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "Recipient ID",
        "description": "The 8 character Threema ID that should receive the alerts.",
        "placeholder": "YOUR3MID",
        "propertyName": "recipient_id",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": true,
        "validationRule": "[0-9A-Z]{8}",
        "secure": false
      },
      {
        "element": "input",
        "inputType": "text",
        "label": "API Secret",
        "description": "Your Threema Gateway API secret.",
        "placeholder": "",
        "propertyName": "api_secret",
        "selectOptions": null,
        "showWhen": {
          "field": "",
          "is": ""
        },
        "required": true,
        "validationRule": "",
        "secure": true
      }
    ]
  },
  {
    "type": "opsgenie",
    "name": "OpsGenie",
    "heading": "OpsGenie settings",
    "description": "Sends notifications to OpsGenie",
    "info": "",
    "options": [
      {
        "element": "input",
        "inputType": "text",
        "label": "API Key",
        "description": "",
        "placeholder": "OpsGenie API Key",
        "propertyName": "apiKey",
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
        "label": "Alert API Url",
        "description": "",
        "placeholder": "https://api.opsgenie.com/v2/alerts",
        "propertyName": "apiUrl",
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
        "element": "checkbox",
        "inputType": "",
        "label": "Auto close incidents",
        "description": "Automatically close alerts in OpsGenie once the alert goes back to ok.",
        "placeholder": "",
        "propertyName": "autoClose",
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
        "element": "checkbox",
        "inputType": "",
        "label": "Override priority",
        "description": "Allow the alert priority to be set using the og_priority annotation",
        "placeholder": "",
        "propertyName": "overridePriority",
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
        "label": "Send notification tags as",
        "description": "Send the common annotations to Opsgenie as either Extra Properties, Tags or both",
        "placeholder": "",
        "propertyName": "sendTagsAs",
        "selectOptions": [
          {
            "value": "tags",
            "label": "Tags"
          },
          {
            "value": "details",
            "label": "Extra Properties"
          },
          {
            "value": "both",
            "label": "Tags & Extra Properties"
          }
        ],
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
