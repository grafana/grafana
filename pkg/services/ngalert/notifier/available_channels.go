package notifier

import (
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
)

// GetAvailableNotifiers returns the metadata of all the notification channels that can be configured.
func GetAvailableNotifiers() []*alerting.NotifierPlugin {
	pushoverSoundOptions := []alerting.SelectOption{
		{
			Value: "default",
			Label: "Default",
		},
		{
			Value: "pushover",
			Label: "Pushover",
		}, {
			Value: "bike",
			Label: "Bike",
		}, {
			Value: "bugle",
			Label: "Bugle",
		}, {
			Value: "cashregister",
			Label: "Cashregister",
		}, {
			Value: "classical",
			Label: "Classical",
		}, {
			Value: "cosmic",
			Label: "Cosmic",
		}, {
			Value: "falling",
			Label: "Falling",
		}, {
			Value: "gamelan",
			Label: "Gamelan",
		}, {
			Value: "incoming",
			Label: "Incoming",
		}, {
			Value: "intermission",
			Label: "Intermission",
		}, {
			Value: "magic",
			Label: "Magic",
		}, {
			Value: "mechanical",
			Label: "Mechanical",
		}, {
			Value: "pianobar",
			Label: "Pianobar",
		}, {
			Value: "siren",
			Label: "Siren",
		}, {
			Value: "spacealarm",
			Label: "Spacealarm",
		}, {
			Value: "tugboat",
			Label: "Tugboat",
		}, {
			Value: "alien",
			Label: "Alien",
		}, {
			Value: "climb",
			Label: "Climb",
		}, {
			Value: "persistent",
			Label: "Persistent",
		}, {
			Value: "echo",
			Label: "Echo",
		}, {
			Value: "updown",
			Label: "Updown",
		}, {
			Value: "none",
			Label: "None",
		},
	}

	pushoverPriorityOptions := []alerting.SelectOption{
		{
			Value: "2",
			Label: "Emergency",
		},
		{
			Value: "1",
			Label: "High",
		},
		{
			Value: "0",
			Label: "Normal",
		},
		{
			Value: "-1",
			Label: "Low",
		},
		{
			Value: "-2",
			Label: "Lowest",
		},
	}

	return []*alerting.NotifierPlugin{
		{
			Type:        "dingding",
			Name:        "DingDing",
			Description: "Sends HTTP POST request to DingDing",
			Heading:     "DingDing settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Url",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxx",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "Message Type",
					Element:      alerting.ElementTypeSelect,
					PropertyName: "msgType",
					SelectOptions: []alerting.SelectOption{
						{
							Value: "link",
							Label: "Link"},
						{
							Value: "actionCard",
							Label: "ActionCard",
						},
					},
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      alerting.ElementTypeTextArea,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
			},
		},
		{
			Type:        "kafka",
			Name:        "Kafka REST Proxy",
			Description: "Sends notifications to Kafka Rest Proxy",
			Heading:     "Kafka settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Kafka REST Proxy",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "http://localhost:8082",
					PropertyName: "kafkaRestProxy",
					Required:     true,
				},
				{
					Label:        "Topic",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "topic1",
					PropertyName: "kafkaTopic",
					Required:     true,
				},
			},
		},
		{
			Type:        "email",
			Name:        "Email",
			Description: "Sends notifications using Grafana server configured SMTP settings",
			Heading:     "Email settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Single email",
					Description:  "Send a single email to all recipients",
					Element:      alerting.ElementTypeCheckbox,
					PropertyName: "singleEmail",
				},
				{
					Label:        "Addresses",
					Description:  "You can enter multiple email addresses using a \";\" separator",
					Element:      alerting.ElementTypeTextArea,
					PropertyName: "addresses",
					Required:     true,
				},
				{ // New in 8.0.
					Label:        "Message",
					Description:  "Optional message to include with the email. You can use template variables",
					Element:      alerting.ElementTypeTextArea,
					PropertyName: "message",
				},
			},
		},
		{
			Type:        "pagerduty",
			Name:        "PagerDuty",
			Description: "Sends notifications to PagerDuty",
			Heading:     "PagerDuty settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Integration Key",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "Pagerduty Integration Key",
					PropertyName: "integrationKey",
					Required:     true,
					Secure:       true,
				},
				{
					Label:   "Severity",
					Element: alerting.ElementTypeSelect,
					SelectOptions: []alerting.SelectOption{
						{
							Value: "critical",
							Label: "Critical",
						},
						{
							Value: "error",
							Label: "Error",
						},
						{
							Value: "warning",
							Label: "Warning",
						},
						{
							Value: "info",
							Label: "Info",
						},
					},
					PropertyName: "severity",
				},
				{ // New in 8.0.
					Label:        "Class",
					Description:  "The class/type of the event, for example 'ping failure' or 'cpu load'",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					PropertyName: "class",
				},
				{ // New in 8.0.
					Label:        "Component",
					Description:  "Component of the source machine that is responsible for the event, for example mysql or eth0",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "Grafana",
					PropertyName: "component",
				},
				{ // New in 8.0.
					Label:        "Group",
					Description:  "Logical grouping of components of a service, for example 'app-stack'",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					PropertyName: "group",
				},
				{ // New in 8.0.
					Label:        "Summary",
					Description:  "You can use templates for summary",
					Element:      alerting.ElementTypeTextArea,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "summary",
				},
			},
		},
		{
			Type:        "victorops",
			Name:        "VictorOps",
			Description: "Sends notifications to VictorOps",
			Heading:     "VictorOps settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Url",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "VictorOps url",
					PropertyName: "url",
					Required:     true,
				},
				{ // New in 8.0.
					Label:        "Message Type",
					Element:      alerting.ElementTypeSelect,
					PropertyName: "messageType",
					SelectOptions: []alerting.SelectOption{
						{
							Value: "CRITICAL",
							Label: "CRITICAL"},
						{
							Value: "WARNING",
							Label: "WARNING",
						},
					},
				},
			},
		},
		{
			Type:        "pushover",
			Name:        "Pushover",
			Description: "Sends HTTP POST request to the Pushover API",
			Heading:     "Pushover settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "API Token",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "Application token",
					PropertyName: "apiToken",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "User key(s)",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "comma-separated list",
					PropertyName: "userKey",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "Device(s) (optional)",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "comma-separated list; leave empty to send to all devices",
					PropertyName: "device",
				},
				{
					Label:         "Alerting priority",
					Element:       alerting.ElementTypeSelect,
					SelectOptions: pushoverPriorityOptions,
					PropertyName:  "priority",
				},
				{
					Label:         "OK priority",
					Element:       alerting.ElementTypeSelect,
					SelectOptions: pushoverPriorityOptions,
					PropertyName:  "okPriority",
				},
				{
					Description:  "How often (in seconds) the Pushover servers will send the same alerting or OK notification to the user.",
					Label:        "Retry (Only used for Emergency Priority)",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "minimum 30 seconds",
					PropertyName: "retry",
				},
				{
					Description:  "How many seconds the alerting or OK notification will continue to be retried.",
					Label:        "Expire (Only used for Emergency Priority)",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "maximum 86400 seconds",
					PropertyName: "expire",
				},
				{
					Label:         "Alerting sound",
					Element:       alerting.ElementTypeSelect,
					SelectOptions: pushoverSoundOptions,
					PropertyName:  "sound",
				},
				{
					Label:         "OK sound",
					Element:       alerting.ElementTypeSelect,
					SelectOptions: pushoverSoundOptions,
					PropertyName:  "okSound",
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      alerting.ElementTypeTextArea,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
			},
		},
		{
			Type:        "slack",
			Name:        "Slack",
			Description: "Sends notifications to Slack",
			Heading:     "Slack settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Recipient",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Specify channel, private group, or IM channel (can be an encoded ID or a name) - required unless you provide a webhook",
					PropertyName: "recipient",
					Required:     true,
					DependsOn:    "secureSettings.url",
				},
				// Logically, this field should be required when not using a webhook, since the Slack API needs a token.
				// However, since the UI doesn't allow to say that a field is required or not depending on another field,
				// we've gone with the compromise of making this field optional and instead return a validation error
				// if it's necessary and missing.
				{
					Label:        "Token",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Provide a Slack API token (starts with \"xoxb\") - required unless you provide a webhook",
					PropertyName: "token",
					Secure:       true,
					Required:     true,
					DependsOn:    "secureSettings.url",
				},
				{
					Label:        "Username",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Set the username for the bot's message",
					PropertyName: "username",
				},
				{
					Label:        "Icon emoji",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Provide an emoji to use as the icon for the bot's message. Overrides the icon URL.",
					PropertyName: "icon_emoji",
				},
				{
					Label:        "Icon URL",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Provide a URL to an image to use as the icon for the bot's message",
					PropertyName: "icon_url",
				},
				{
					Label:        "Mention Users",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Mention one or more users (comma separated) when notifying in a channel, by ID (you can copy this from the user's Slack profile)",
					PropertyName: "mentionUsers",
				},
				{
					Label:        "Mention Groups",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Mention one or more groups (comma separated) when notifying in a channel (you can copy this from the group's Slack profile URL)",
					PropertyName: "mentionGroups",
				},
				{
					Label:   "Mention Channel",
					Element: alerting.ElementTypeSelect,
					SelectOptions: []alerting.SelectOption{
						{
							Value: "",
							Label: "Disabled",
						},
						{
							Value: "here",
							Label: "Every active channel member",
						},
						{
							Value: "channel",
							Label: "Every channel member",
						},
					},
					Description:  "Mention whole channel or just active members when notifying",
					PropertyName: "mentionChannel",
				},
				{
					Label:        "Webhook URL",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Optionally provide a Slack incoming webhook URL for sending messages, in this case the token isn't necessary",
					Placeholder:  "Slack incoming webhook URL",
					PropertyName: "url",
					Secure:       true,
					Required:     true,
					DependsOn:    "secureSettings.token",
				},
				{ // New in 8.4.
					Label:        "Endpoint URL",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Optionally provide a custom Slack message API endpoint for non-webhook requests, default is https://slack.com/api/chat.postMessage",
					Placeholder:  "Slack endpoint url",
					PropertyName: "endpointUrl",
				},
				{ // New in 8.0.
					Label:        "Title",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Templated title of the slack message",
					PropertyName: "title",
					Placeholder:  `{{ template "slack.default.title" . }}`,
				},
				{ // New in 8.0.
					Label:        "Text Body",
					Element:      alerting.ElementTypeTextArea,
					Description:  "Body of the slack message",
					PropertyName: "text",
					Placeholder:  `{{ template "slack.default.text" . }}`,
				},
			},
		},
		{
			Type:        "sensugo",
			Name:        "Sensu Go",
			Description: "Sends HTTP POST request to a Sensu Go API",
			Heading:     "Sensu Go Settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Backend URL",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "http://sensu-api.local:8080",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "API Key",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypePassword,
					Description:  "API key to auth to Sensu Go backend",
					PropertyName: "apikey",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "Proxy entity name",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "default",
					PropertyName: "entity",
				},
				{
					Label:        "Check name",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "default",
					PropertyName: "check",
				},
				{
					Label:        "Handler",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					PropertyName: "handler",
				},
				{
					Label:        "Namespace",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "default",
					PropertyName: "namespace",
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      alerting.ElementTypeTextArea,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
			},
		},
		{
			Type:        "teams",
			Name:        "Microsoft Teams",
			Description: "Sends notifications using Incoming Webhook connector to Microsoft Teams",
			Heading:     "Teams settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "URL",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "Teams incoming webhook url",
					PropertyName: "url",
					Required:     true,
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      alerting.ElementTypeTextArea,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
			},
		},
		{
			Type:        "telegram",
			Name:        "Telegram",
			Description: "Sends notifications to Telegram",
			Heading:     "Telegram API settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "BOT API Token",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "Telegram BOT API Token",
					PropertyName: "bottoken",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "Chat ID",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Integer Telegram Chat Identifier",
					PropertyName: "chatid",
					Required:     true,
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      alerting.ElementTypeTextArea,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
			},
		},
		{
			Type:        "webhook",
			Name:        "webhook",
			Description: "Sends HTTP POST request to a URL",
			Heading:     "Webhook settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Url",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:   "Http Method",
					Element: alerting.ElementTypeSelect,
					SelectOptions: []alerting.SelectOption{
						{
							Value: "POST",
							Label: "POST",
						},
						{
							Value: "PUT",
							Label: "PUT",
						},
					},
					PropertyName: "httpMethod",
				},
				{
					Label:        "Username",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					PropertyName: "username",
				},
				{
					Label:        "Password",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypePassword,
					PropertyName: "password",
					Secure:       true,
				},
				{ // New in 8.0. TODO: How to enforce only numbers?
					Label:        "Max Alerts",
					Description:  "Max alerts to include in a notification. Remaining alerts in the same batch will be ignored above this number. 0 means no limit.",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					PropertyName: "maxAlerts",
				},
			},
		},
		{
			Type:        "wecom",
			Name:        "WeCom",
			Description: "Send alerts generated by Grafana to WeCom",
			Heading:     "WeCom settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Url",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx",
					PropertyName: "url",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "Message",
					Description:  "Custom WeCom message. You can use template variables.",
					Element:      alerting.ElementTypeTextArea,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
			},
		},
		{
			Type:        "prometheus-alertmanager",
			Name:        "Alertmanager",
			Description: "Sends notifications to Alertmanager",
			Heading:     "Alertmanager Settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "URL",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "http://localhost:9093",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "Basic Auth User",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					PropertyName: "basicAuthUser",
				},
				{
					Label:        "Basic Auth Password",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypePassword,
					PropertyName: "basicAuthPassword",
					Secure:       true,
				},
			},
		},
		{
			Type:        "discord",
			Name:        "Discord",
			Heading:     "Discord settings",
			Description: "Sends notifications to Discord",
			Options: []alerting.NotifierOption{
				{
					Label:        "Message Content",
					Description:  "Mention a group using @ or a user using <@ID> when notifying in a channel",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
				{
					Label:        "Webhook URL",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "Discord webhook URL",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "Avatar URL",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					PropertyName: "avatar_url",
				},
				{
					Label:        "Use Discord's Webhook Username",
					Description:  "Use the username configured in Discord's webhook settings. Otherwise, the username will be 'Grafana'",
					Element:      alerting.ElementTypeCheckbox,
					PropertyName: "use_discord_username",
				},
			},
		},
		{
			Type:        "googlechat",
			Name:        "Google Hangouts Chat",
			Description: "Sends notifications to Google Hangouts Chat via webhooks based on the official JSON message format",
			Heading:     "Google Hangouts Chat settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Url",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "Google Hangouts Chat incoming webhook url",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "Message",
					Element:      alerting.ElementTypeTextArea,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
			},
		},
		{
			Type:        "LINE",
			Name:        "LINE",
			Description: "Send notifications to LINE notify",
			Heading:     "LINE notify settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Token",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "LINE notify token key",
					PropertyName: "token",
					Required:     true,
					Secure:       true,
				}},
		},
		{
			Type:        "threema",
			Name:        "Threema Gateway",
			Description: "Sends notifications to Threema using Threema Gateway (Basic IDs)",
			Heading:     "Threema Gateway settings",
			Info: "Notifications can be configured for any Threema Gateway ID of type \"Basic\". End-to-End IDs are not currently supported." +
				"The Threema Gateway ID can be set up at https://gateway.threema.ch/.",
			Options: []alerting.NotifierOption{
				{
					Label:          "Gateway ID",
					Element:        alerting.ElementTypeInput,
					InputType:      alerting.InputTypeText,
					Placeholder:    "*3MAGWID",
					Description:    "Your 8 character Threema Gateway Basic ID (starting with a *).",
					PropertyName:   "gateway_id",
					Required:       true,
					ValidationRule: "\\*[0-9A-Z]{7}",
				},
				{
					Label:          "Recipient ID",
					Element:        alerting.ElementTypeInput,
					InputType:      alerting.InputTypeText,
					Placeholder:    "YOUR3MID",
					Description:    "The 8 character Threema ID that should receive the alerts.",
					PropertyName:   "recipient_id",
					Required:       true,
					ValidationRule: "[0-9A-Z]{8}",
				},
				{
					Label:        "API Secret",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Your Threema Gateway API secret.",
					PropertyName: "api_secret",
					Required:     true,
					Secure:       true,
				},
			},
		},
		{
			Type:        "opsgenie",
			Name:        "OpsGenie",
			Description: "Sends notifications to OpsGenie",
			Heading:     "OpsGenie settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "API Key",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "OpsGenie API Key",
					PropertyName: "apiKey",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "Alert API Url",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Placeholder:  "https://api.opsgenie.com/v2/alerts",
					PropertyName: "apiUrl",
					Required:     true,
				},
				{
					Label:        "Auto close incidents",
					Element:      alerting.ElementTypeCheckbox,
					Description:  "Automatically close alerts in OpsGenie once the alert goes back to ok.",
					PropertyName: "autoClose",
				}, {
					Label:        "Override priority",
					Element:      alerting.ElementTypeCheckbox,
					Description:  "Allow the alert priority to be set using the og_priority annotation",
					PropertyName: "overridePriority",
				},
				{
					Label:   "Send notification tags as",
					Element: alerting.ElementTypeSelect,
					SelectOptions: []alerting.SelectOption{
						{
							Value: channels.OpsgenieSendTags,
							Label: "Tags",
						},
						{
							Value: channels.OpsgenieSendDetails,
							Label: "Extra Properties",
						},
						{
							Value: channels.OpsgenieSendBoth,
							Label: "Tags & Extra Properties",
						},
					},
					Description:  "Send the common annotations to Opsgenie as either Extra Properties, Tags or both",
					PropertyName: "sendTagsAs",
				},
			},
		},
	}
}
