package channels_config

import (
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
)

// GetAvailableNotifiers returns the metadata of all the notification channels that can be configured.
func GetAvailableNotifiers() []*NotifierPlugin {
	pushoverSoundOptions := []SelectOption{
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

	pushoverPriorityOptions := []SelectOption{
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

	return []*NotifierPlugin{
		{
			Type:        "dingding",
			Name:        "DingDing",
			Description: "Sends HTTP POST request to DingDing",
			Heading:     "DingDing settings",
			Options: []NotifierOption{
				{
					Label:        "URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxx",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "Message Type",
					Element:      ElementTypeSelect,
					PropertyName: "msgType",
					SelectOptions: []SelectOption{
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
					Element:      ElementTypeTextArea,
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
			Options: []NotifierOption{
				{
					Label:        "Kafka REST Proxy",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "http://localhost:8082",
					PropertyName: "kafkaRestProxy",
					Required:     true,
				},
				{
					Label:        "Topic",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
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
			Options: []NotifierOption{
				{
					Label:        "Single email",
					Description:  "Send a single email to all recipients",
					Element:      ElementTypeCheckbox,
					PropertyName: "singleEmail",
				},
				{
					Label:        "Addresses",
					Description:  "You can enter multiple email addresses using a \";\" separator",
					Element:      ElementTypeTextArea,
					PropertyName: "addresses",
					Required:     true,
				},
				{ // New in 8.0.
					Label:        "Message",
					Description:  "Optional message to include with the email. You can use template variables",
					Element:      ElementTypeTextArea,
					PropertyName: "message",
				},
				{ // New in 9.0.
					Label:        "Subject",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated subject of the email",
					PropertyName: "subject",
					Placeholder:  `{{ template "default.title" . }}`,
				},
			},
		},
		{
			Type:        "pagerduty",
			Name:        "PagerDuty",
			Description: "Sends notifications to PagerDuty",
			Heading:     "PagerDuty settings",
			Options: []NotifierOption{
				{
					Label:        "Integration Key",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "Pagerduty Integration Key",
					PropertyName: "integrationKey",
					Required:     true,
					Secure:       true,
				},
				{
					Label:   "Severity",
					Element: ElementTypeSelect,
					SelectOptions: []SelectOption{
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
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "class",
				},
				{ // New in 8.0.
					Label:        "Component",
					Description:  "Component of the source machine that is responsible for the event, for example mysql or eth0",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "Grafana",
					PropertyName: "component",
				},
				{ // New in 8.0.
					Label:        "Group",
					Description:  "Logical grouping of components of a service, for example 'app-stack'",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "group",
				},
				{ // New in 8.0.
					Label:        "Summary",
					Description:  "You can use templates for summary",
					Element:      ElementTypeTextArea,
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
			Options: []NotifierOption{
				{
					Label:        "URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "VictorOps url",
					PropertyName: "url",
					Required:     true,
				},
				{ // New in 8.0.
					Label:        "Message Type",
					Element:      ElementTypeSelect,
					PropertyName: "messageType",
					SelectOptions: []SelectOption{
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
			Options: []NotifierOption{
				{
					Label:        "API Token",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "Application token",
					PropertyName: "apiToken",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "User key(s)",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "comma-separated list",
					PropertyName: "userKey",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "Device(s) (optional)",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "comma-separated list; leave empty to send to all devices",
					PropertyName: "device",
				},
				{
					Label:         "Alerting priority",
					Element:       ElementTypeSelect,
					SelectOptions: pushoverPriorityOptions,
					PropertyName:  "priority",
				},
				{
					Label:         "OK priority",
					Element:       ElementTypeSelect,
					SelectOptions: pushoverPriorityOptions,
					PropertyName:  "okPriority",
				},
				{
					Description:  "How often (in seconds) the Pushover servers will send the same alerting or OK notification to the user.",
					Label:        "Retry (Only used for Emergency Priority)",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "minimum 30 seconds",
					PropertyName: "retry",
				},
				{
					Description:  "How many seconds the alerting or OK notification will continue to be retried.",
					Label:        "Expire (Only used for Emergency Priority)",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "maximum 86400 seconds",
					PropertyName: "expire",
				},
				{
					Label:         "Alerting sound",
					Element:       ElementTypeSelect,
					SelectOptions: pushoverSoundOptions,
					PropertyName:  "sound",
				},
				{
					Label:         "OK sound",
					Element:       ElementTypeSelect,
					SelectOptions: pushoverSoundOptions,
					PropertyName:  "okSound",
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      ElementTypeTextArea,
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
			Options: []NotifierOption{
				{
					Label:        "Recipient",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Specify channel, private group, or IM channel (can be an encoded ID or a name) - required unless you provide a webhook",
					PropertyName: "recipient",
					Required:     true,
					DependsOn:    "url",
				},
				// Logically, this field should be required when not using a webhook, since the Slack API needs a token.
				// However, since the UI doesn't allow to say that a field is required or not depending on another field,
				// we've gone with the compromise of making this field optional and instead return a validation error
				// if it's necessary and missing.
				{
					Label:        "Token",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Provide a Slack API token (starts with \"xoxb\") - required unless you provide a webhook",
					PropertyName: "token",
					Secure:       true,
					Required:     true,
					DependsOn:    "url",
				},
				{
					Label:        "Username",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Set the username for the bot's message",
					PropertyName: "username",
				},
				{
					Label:        "Icon emoji",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Provide an emoji to use as the icon for the bot's message. Overrides the icon URL.",
					PropertyName: "icon_emoji",
				},
				{
					Label:        "Icon URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Provide a URL to an image to use as the icon for the bot's message",
					PropertyName: "icon_url",
				},
				{
					Label:        "Mention Users",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Mention one or more users (comma separated) when notifying in a channel, by ID (you can copy this from the user's Slack profile)",
					PropertyName: "mentionUsers",
				},
				{
					Label:        "Mention Groups",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Mention one or more groups (comma separated) when notifying in a channel (you can copy this from the group's Slack profile URL)",
					PropertyName: "mentionGroups",
				},
				{
					Label:   "Mention Channel",
					Element: ElementTypeSelect,
					SelectOptions: []SelectOption{
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
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Optionally provide a Slack incoming webhook URL for sending messages, in this case the token isn't necessary",
					Placeholder:  "Slack incoming webhook URL",
					PropertyName: "url",
					Secure:       true,
					Required:     true,
					DependsOn:    "token",
				},
				{ // New in 8.4.
					Label:        "Endpoint URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Optionally provide a custom Slack message API endpoint for non-webhook requests, default is https://slack.com/api/chat.postMessage",
					Placeholder:  "Slack endpoint url",
					PropertyName: "endpointUrl",
				},
				{ // New in 8.0.
					Label:        "Title",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated title of the slack message",
					PropertyName: "title",
					Placeholder:  `{{ template "slack.default.title" . }}`,
				},
				{ // New in 8.0.
					Label:        "Text Body",
					Element:      ElementTypeTextArea,
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
			Options: []NotifierOption{
				{
					Label:        "Backend URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "http://sensu-api.local:8080",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "API Key",
					Element:      ElementTypeInput,
					InputType:    InputTypePassword,
					Description:  "API key to auth to Sensu Go backend",
					PropertyName: "apikey",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "Proxy entity name",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "default",
					PropertyName: "entity",
				},
				{
					Label:        "Check name",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "default",
					PropertyName: "check",
				},
				{
					Label:        "Handler",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "handler",
				},
				{
					Label:        "Namespace",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "default",
					PropertyName: "namespace",
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      ElementTypeTextArea,
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
			Options: []NotifierOption{
				{
					Label:        "URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "Teams incoming webhook url",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "Title",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated title of the Teams message.",
					PropertyName: "title",
					Placeholder:  `{{ template "default.title" . }}`,
				},
				{
					Label:        "Section Title",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Section title for the Teams message. Leave blank for none.",
					PropertyName: "sectiontitle",
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      ElementTypeTextArea,
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
			Options: []NotifierOption{
				{
					Label:        "BOT API Token",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "Telegram BOT API Token",
					PropertyName: "bottoken",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "Chat ID",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Integer Telegram Chat Identifier",
					PropertyName: "chatid",
					Required:     true,
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      ElementTypeTextArea,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
			},
		},
		{
			Type:        "webhook",
			Name:        "Webhook",
			Description: "Sends HTTP POST request to a URL",
			Heading:     "Webhook settings",
			Options: []NotifierOption{
				{
					Label:        "URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:   "HTTP Method",
					Element: ElementTypeSelect,
					SelectOptions: []SelectOption{
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
					Label:        "HTTP Basic Authentication - Username",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "username",
				},
				{
					Label:        "HTTP Basic Authentication - Password",
					Element:      ElementTypeInput,
					InputType:    InputTypePassword,
					PropertyName: "password",
					Secure:       true,
				},
				{ // New in 9.1
					Label:        "Authorization Header - Scheme",
					Description:  "Optionally provide a scheme for the Authorization Request Header. Default is Bearer.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "authorization_scheme",
					Placeholder:  "Bearer",
				},
				{ // New in 9.1
					Label:        "Authorization Header - Credentials",
					Description:  "Credentials for the Authorization Request header. Only one of HTTP Basic Authentication or Authorization Request Header can be set.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "authorization_credentials",
					Secure:       true,
				},
				{ // New in 8.0. TODO: How to enforce only numbers?
					Label:        "Max Alerts",
					Description:  "Max alerts to include in a notification. Remaining alerts in the same batch will be ignored above this number. 0 means no limit.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "maxAlerts",
				},
			},
		},
		{
			Type:        "wecom",
			Name:        "WeCom",
			Description: "Send alerts generated by Grafana to WeCom",
			Heading:     "WeCom settings",
			Options: []NotifierOption{
				{
					Label:        "URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx",
					PropertyName: "url",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "Message",
					Description:  "Custom WeCom message. You can use template variables.",
					Element:      ElementTypeTextArea,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
				{ // New in 9.1.
					Label:        "Title",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated title of the message",
					PropertyName: "title",
					Placeholder:  `{{ template "default.title" . }}`,
				},
			},
		},
		{
			Type:        "prometheus-alertmanager",
			Name:        "Alertmanager",
			Description: "Sends notifications to Alertmanager",
			Heading:     "Alertmanager Settings",
			Options: []NotifierOption{
				{
					Label:        "URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "http://localhost:9093",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "Basic Auth User",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "basicAuthUser",
				},
				{
					Label:        "Basic Auth Password",
					Element:      ElementTypeInput,
					InputType:    InputTypePassword,
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
			Options: []NotifierOption{
				{
					Label:        "Message Content",
					Description:  "Mention a group using @ or a user using <@ID> when notifying in a channel",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
				{
					Label:        "Webhook URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "Discord webhook URL",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "Avatar URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "avatar_url",
				},
				{
					Label:        "Use Discord's Webhook Username",
					Description:  "Use the username configured in Discord's webhook settings. Otherwise, the username will be 'Grafana'",
					Element:      ElementTypeCheckbox,
					PropertyName: "use_discord_username",
				},
			},
		},
		{
			Type:        "googlechat",
			Name:        "Google Hangouts Chat",
			Description: "Sends notifications to Google Hangouts Chat via webhooks based on the official JSON message format",
			Heading:     "Google Hangouts Chat settings",
			Options: []NotifierOption{
				{
					Label:        "URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "Google Hangouts Chat incoming webhook url",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "Message",
					Element:      ElementTypeTextArea,
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
			Options: []NotifierOption{
				{
					Label:        "Token",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
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
			Options: []NotifierOption{
				{
					Label:          "Gateway ID",
					Element:        ElementTypeInput,
					InputType:      InputTypeText,
					Placeholder:    "*3MAGWID",
					Description:    "Your 8 character Threema Gateway Basic ID (starting with a *).",
					PropertyName:   "gateway_id",
					Required:       true,
					ValidationRule: "\\*[0-9A-Z]{7}",
				},
				{
					Label:          "Recipient ID",
					Element:        ElementTypeInput,
					InputType:      InputTypeText,
					Placeholder:    "YOUR3MID",
					Description:    "The 8 character Threema ID that should receive the alerts.",
					PropertyName:   "recipient_id",
					Required:       true,
					ValidationRule: "[0-9A-Z]{8}",
				},
				{
					Label:        "API Secret",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
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
			Options: []NotifierOption{
				{
					Label:        "API Key",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "OpsGenie API Key",
					PropertyName: "apiKey",
					Required:     true,
					Secure:       true,
				},
				{
					Label:        "Alert API URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "https://api.opsgenie.com/v2/alerts",
					PropertyName: "apiUrl",
					Required:     true,
				},
				{
					Label:        "Message",
					Description:  "Alert text limited to 130 characters.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  `{{ template "default.title" . }}`,
					PropertyName: "message",
				},
				{
					Label:        "Description",
					Description:  "A description of the incident.",
					Element:      ElementTypeTextArea,
					PropertyName: "description",
				},
				{
					Label:        "Auto close incidents",
					Element:      ElementTypeCheckbox,
					Description:  "Automatically close alerts in OpsGenie once the alert goes back to ok.",
					PropertyName: "autoClose",
				}, {
					Label:        "Override priority",
					Element:      ElementTypeCheckbox,
					Description:  "Allow the alert priority to be set using the og_priority annotation",
					PropertyName: "overridePriority",
				},
				{
					Label:   "Send notification tags as",
					Element: ElementTypeSelect,
					SelectOptions: []SelectOption{
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
