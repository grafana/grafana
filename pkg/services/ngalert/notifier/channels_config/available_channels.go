package channels_config

import (
	"fmt"
	"os"
	"strings"

	alertingMqtt "github.com/grafana/alerting/receivers/mqtt"
	alertingOpsgenie "github.com/grafana/alerting/receivers/opsgenie"
	alertingPagerduty "github.com/grafana/alerting/receivers/pagerduty"
	alertingTemplates "github.com/grafana/alerting/templates"
)

// GetAvailableNotifiers returns the metadata of all the notification channels that can be configured.
func GetAvailableNotifiers() []*NotifierPlugin {
	hostname, _ := os.Hostname()

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
				{ // New in 9.3.
					Label:        "Title",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated title of the message",
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
					PropertyName: "title",
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      ElementTypeTextArea,
					Description:  "Custom DingDing message. You can use template variables.",
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
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
					Description:  "Hint: If you are directly using v3 APIs hosted on a Confluent Kafka Server, you must append /kafka to the URL here. Example: https://localhost:8082/kafka",
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
				{
					Label:        "Username",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "username",
					Required:     false,
				},
				{
					Label:        "Password",
					Element:      ElementTypeInput,
					InputType:    InputTypePassword,
					Description:  "The password to use when making a call to the Kafka REST Proxy",
					PropertyName: "password",
					Required:     false,
					Secure:       true,
				},
				{
					Label:        "API version",
					Element:      ElementTypeSelect,
					InputType:    InputTypeText,
					Description:  "The API version to use when contacting the Kafka REST Server. By default v2 will be used.",
					PropertyName: "apiVersion",
					Required:     false,
					SelectOptions: []SelectOption{
						{
							Value: "v2",
							Label: "v2",
						},
						{
							Value: "v3",
							Label: "v3",
						},
					},
				},
				{
					Label:        "Cluster ID",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "v3 APIs require a clusterID to be specified.",
					Placeholder:  "lkc-abcde",
					PropertyName: "kafkaClusterId",
					Required:     true,
					ShowWhen: ShowWhen{
						Field: "apiVersion",
						Is:    "v3",
					},
				},
				{
					Label:        "Description",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated description of the Kafka message",
					PropertyName: "description",
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
				},
				{
					Label:        "Details",
					Element:      ElementTypeTextArea,
					Description:  "Custom details to include with the message. You can use template variables.",
					PropertyName: "details",
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
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
					Description:  "You can enter multiple email addresses using a \";\", \"\\n\" or  \",\" separator",
					Element:      ElementTypeTextArea,
					PropertyName: "addresses",
					Required:     true,
				},
				{ // New in 8.0.
					Label:        "Message",
					Description:  "Optional message. You can use templates to customize this field. Using a custom message will replace the default message",
					Element:      ElementTypeTextArea,
					PropertyName: "message",
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
				},
				{ // New in 9.0.
					Label:        "Subject",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Optional subject. You can use templates to customize this field",
					PropertyName: "subject",
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
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
					Label:        "Severity",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "critical",
					Description:  "Severity of the event. It must be critical, error, warning, info - otherwise, the default is set which is critical. You can use templates",
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
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
					PropertyName: "summary",
				},
				{ // New in 9.4.
					Label:        "Source",
					Description:  "The unique location of the affected system, preferably a hostname or FQDN. You can use templates",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  hostname,
					PropertyName: "source",
				},
				{ // New in 9.4.
					Label:        "Client",
					Description:  "The name of the monitoring client that is triggering this event. You can use templates",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "Grafana",
					PropertyName: "client",
				},
				{ // New in 9.4.
					Label:        "Client URL",
					Description:  "The URL of the monitoring client that is triggering this event. You can use templates",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "{{ .ExternalURL }}",
					PropertyName: "client_url",
				},
				{ // New in 9.5.
					Label:        "Details",
					Description:  "A set of arbitrary key/value pairs that provide further detail about the incident.",
					Element:      ElementTypeKeyValueMap,
					InputType:    InputTypeText,
					PropertyName: "details",
				},
				{ //New in 11.1
					Label:        "URL",
					Description:  "The URL to send API requests to",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  alertingPagerduty.DefaultURL,
					PropertyName: "url",
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
				{ // New in 9.3.
					Label:        "Title",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated title to display",
					PropertyName: "title",
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
				},
				{ // New in 9.3.
					Label:        "Description",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated description of the message",
					PropertyName: "description",
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
				},
			},
		},
		{
			Type:        "oncall",
			Name:        "Grafana OnCall",
			Description: "Sends alerts to Grafana OnCall",
			Heading:     "Grafana OnCall settings",
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
				{ // New in 9.3.
					Label:        "Title",
					Description:  "Templated title of the message.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "title",
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
				},
				{ // New in 9.3.
					Label:        "Message",
					Description:  "Custom message. You can use template variables.",
					Element:      ElementTypeTextArea,
					PropertyName: "message",
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
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
					Placeholder:  "maximum 10800 seconds",
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
				{ // New in 9.3.
					Label:        "Title",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
					PropertyName: "title",
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      ElementTypeTextArea,
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
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
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
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
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
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
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
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
				{
					Label:          "Message Thread ID",
					Element:        ElementTypeInput,
					InputType:      InputTypeText,
					Description:    "Integer Telegram Message Thread Identifier",
					PropertyName:   "message_thread_id",
					Required:       false,
					ValidationRule: "-?[0-9]{1,10}",
				},
				{ // New in 8.0.
					Label:        "Message",
					Element:      ElementTypeTextArea,
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
					PropertyName: "message",
				},
				{
					Label:   "Parse Mode",
					Element: ElementTypeSelect,
					SelectOptions: []SelectOption{
						{
							Value: "None",
							Label: "None",
						},
						{
							Value: "HTML",
							Label: "HTML",
						},
						{
							Value: "Markdown",
							Label: "Markdown",
						},
						{
							Value: "MarkdownV2",
							Label: "Markdown V2",
						},
					},
					Description:  `Mode for parsing entities in the message text. Default is 'HTML'`,
					PropertyName: "parse_mode",
				},
				{
					Label:        "Disable Web Page Preview",
					Description:  "Disables link previews for links in this message",
					Element:      ElementTypeCheckbox,
					PropertyName: "disable_web_page_preview",
				},
				{
					Label:        "Protect Content",
					Description:  "Protects the contents of the sent message from forwarding and saving",
					Element:      ElementTypeCheckbox,
					PropertyName: "protect_content",
				},
				{
					Label:        "Disable Notification",
					Description:  "Sends the message silently. Users will receive a notification with no sound.",
					Element:      ElementTypeCheckbox,
					PropertyName: "disable_notification",
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
				{ // New in 9.3.
					Label:        "Title",
					Description:  "Templated title of the message.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					PropertyName: "title",
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
				},
				{ // New in 9.3.
					Label:        "Message",
					Description:  "Custom message. You can use template variables.",
					Element:      ElementTypeTextArea,
					PropertyName: "message",
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
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
					Label:        "Webhook URL",
					Description:  "Required if using GroupRobot",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx",
					PropertyName: "url",
					Secure:       true,
					Required:     true,
					DependsOn:    "secret",
				},
				{
					Label:        "Agent ID",
					Description:  "Required if using APIAPP, see https://work.weixin.qq.com/wework_admin/frame#apps create ApiApp",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "1000002",
					PropertyName: "agent_id",
					Required:     true,
					DependsOn:    "url",
				},
				{
					Label:        "Corp ID",
					Description:  "Required if using APIAPP, see https://work.weixin.qq.com/wework_admin/frame#profile",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "wwxxxxxxxxx",
					PropertyName: "corp_id",
					Required:     true,
					DependsOn:    "url",
				},
				{
					Label:        "Secret",
					Description:  "Required if using APIAPP",
					Element:      ElementTypeInput,
					InputType:    InputTypePassword,
					Placeholder:  "secret",
					PropertyName: "secret",
					Secure:       true,
					Required:     true,
					DependsOn:    "url",
				},
				{
					Label:        "Message Type",
					Element:      ElementTypeSelect,
					PropertyName: "msgtype",
					SelectOptions: []SelectOption{
						{
							Value: "text",
							Label: "Text",
						},
						{
							Value: "markdown",
							Label: "Markdown",
						},
					},
					Placeholder: "Text",
				},
				{
					Label:        "Message",
					Description:  "Custom WeCom message. You can use template variables.",
					Element:      ElementTypeTextArea,
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
					PropertyName: "message",
				},
				{ // New in 9.1.
					Label:        "Title",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated title of the message",
					PropertyName: "title",
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
				},
				{
					Label:        "To User",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "@all",
					PropertyName: "touser",
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
					Label:        "Title",
					Description:  "Templated title of the message",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
					PropertyName: "title",
				},
				{
					Label:        "Message Content",
					Description:  "Mention a group using @ or a user using <@ID> when notifying in a channel",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
					PropertyName: "message",
				},
				{
					Label:        "Webhook URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "Discord webhook URL",
					PropertyName: "url",
					Required:     true,
					Secure:       true,
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
			Name:        "Google Chat",
			Description: "Sends notifications to Google Chat via webhooks based on the official JSON message format",
			Heading:     "Google Chat settings",
			Options: []NotifierOption{
				{
					Label:        "URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "Google Chat incoming webhook url",
					PropertyName: "url",
					Required:     true,
				},
				{
					Label:        "Title",
					Description:  "Templated title of the message",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
					PropertyName: "title",
				},
				{
					Label:        "Message",
					Element:      ElementTypeTextArea,
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
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
				},
				{ // New in 9.3
					Label:        "Title",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated title of the message",
					PropertyName: "title",
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
				},
				{ // New in 9.3
					Label:        "Description",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated description of the message",
					PropertyName: "description",
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
				},
			},
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
				{ // New in 9.3
					Label:        "Title",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated title of the message.",
					PropertyName: "title",
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
				},
				{ // New in 9.3
					Label:        "Description",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Templated description of the message.",
					PropertyName: "description",
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
				},
			},
		},
		{
			Type:        "mqtt",
			Name:        "MQTT",
			Description: "Sends notifications to an MQTT broker",
			Heading:     "MQTT settings",
			Info:        "The MQTT notifier sends messages to an MQTT broker. The message is sent to the topic specified in the configuration. ",
			Options: []NotifierOption{
				{
					Label:        "Broker URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "tcp://localhost:1883",
					Description:  "The URL of the MQTT broker.",
					PropertyName: "brokerUrl",
					Required:     true,
				},
				{
					Label:        "Topic",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "grafana/alerts",
					Description:  "The topic to which the message will be sent.",
					PropertyName: "topic",
					Required:     true,
				},
				{
					Label:   "Message format",
					Element: ElementTypeSelect,
					SelectOptions: []SelectOption{
						{
							Value: alertingMqtt.MessageFormatJSON,
							Label: "json",
						},
						{
							Value: alertingMqtt.MessageFormatText,
							Label: "text",
						},
					},
					InputType:    InputTypeText,
					Placeholder:  "json",
					Description:  "The format of the message to be sent. If set to 'json', the message will be sent as a JSON object. If set to 'text', the message will be sent as a plain text string. By default json is used.",
					PropertyName: "messageFormat",
					Required:     false,
				},
				{
					Label:        "Client ID",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "",
					Description:  "The client ID to use when connecting to the MQTT broker. If blank, a random client ID is used.",
					PropertyName: "clientId",
					Required:     false,
				},
				{
					Label:        "Message",
					Element:      ElementTypeTextArea,
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
					PropertyName: "message",
				},
				{
					Label:        "Username",
					Description:  "The username to use when connecting to the MQTT broker.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "",
					PropertyName: "username",
					Required:     false,
				},
				{
					Label:        "Password",
					Description:  "The password to use when connecting to the MQTT broker.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "",
					PropertyName: "password",
					Required:     false,
					Secure:       true,
				},
				{
					Label:   "QoS",
					Element: ElementTypeSelect,
					SelectOptions: []SelectOption{
						{
							Value: "0",
							Label: "At most once (0)",
						},
						{
							Value: "1",
							Label: "At least once (1)",
						},
						{
							Value: "2",
							Label: "Exactly once (2)",
						},
					},
					Description:  "The quality of service to use when sending the message.",
					PropertyName: "qos",
					Required:     false,
				},
				{
					Label:        "Retain",
					Description:  "If set to true, the message will be retained by the broker.",
					Element:      ElementTypeCheckbox,
					PropertyName: "retain",
					Required:     false,
				},
				{
					Label:        "TLS",
					PropertyName: "tlsConfig",
					Description:  "TLS configuration options",
					Element:      ElementTypeSubform,
					SubformOptions: []NotifierOption{
						{
							Label:        "Disable certificate verification",
							Element:      ElementTypeCheckbox,
							Description:  "Do not verify the broker's certificate chain and host name.",
							PropertyName: "insecureSkipVerify",
							Required:     false,
						},
						{
							Label:        "CA Certificate",
							Element:      ElementTypeTextArea,
							Description:  "Certificate in PEM format to use when verifying the broker's certificate chain.",
							InputType:    InputTypeText,
							PropertyName: "caCertificate",
							Required:     false,
							Secure:       true,
						},
						{
							Label:        "Client Certificate",
							Element:      ElementTypeTextArea,
							Description:  "Client certificate in PEM format to use when connecting to the broker.",
							InputType:    InputTypeText,
							PropertyName: "clientCertificate",
							Required:     false,
							Secure:       true,
						},
						{
							Label:        "Client Key",
							Element:      ElementTypeTextArea,
							Description:  "Client key in PEM format to use when connecting to the broker.",
							InputType:    InputTypeText,
							PropertyName: "clientKey",
							Required:     false,
							Secure:       true,
						},
					},
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
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
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
					Description:  "Allow the alert priority to be set using the og_priority label.",
					PropertyName: "overridePriority",
				},
				{
					Label:   "Send notification tags as",
					Element: ElementTypeSelect,
					SelectOptions: []SelectOption{
						{
							Value: alertingOpsgenie.SendTags,
							Label: "Tags",
						},
						{
							Value: alertingOpsgenie.SendDetails,
							Label: "Extra Properties",
						},
						{
							Value: alertingOpsgenie.SendBoth,
							Label: "Tags & Extra Properties",
						},
					},
					Description:  "Send the common annotations to Opsgenie as either Extra Properties, Tags or both",
					PropertyName: "sendTagsAs",
				},
				// New in 10.3
				{
					Label:        "Responders",
					PropertyName: "responders",
					Description:  "If the API key belongs to a team, this field is ignored.",
					Element:      ElementSubformArray,
					SubformOptions: []NotifierOption{
						{
							Label:        "Type",
							Description:  fmt.Sprintf("%s or a template", strings.Join(alertingOpsgenie.SupportedResponderTypes, ", ")),
							Element:      ElementTypeInput,
							Required:     true,
							PropertyName: "type",
						},
						{
							Label:        "Name",
							Element:      ElementTypeInput,
							Description:  "Name of the responder. Must be specified if ID and Username are empty or if the type is 'teams'.",
							PropertyName: "name",
						},
						{
							Label:        "ID",
							Element:      ElementTypeInput,
							Description:  "ID of the responder. Must be specified if name and Username are empty.",
							PropertyName: "id",
						},
						{
							Label:        "Username",
							Element:      ElementTypeInput,
							Description:  "User name of the responder. Must be specified if ID and Name are empty.",
							PropertyName: "username",
						},
					},
				},
			},
		},
		{
			Type:        "webex",
			Name:        "Cisco Webex Teams",
			Description: "Sends notifications to Cisco Webex Teams",
			Heading:     "Webex settings",
			Info:        "Notifications can be configured for any Cisco Webex Teams",
			Options: []NotifierOption{
				{
					Label:        "Cisco Webex API URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "https://api.ciscospark.com/v1/messages",
					Description:  "API endpoint at which we'll send webhooks to.",
					PropertyName: "api_url",
				},
				{
					Label:        "Room ID",
					Description:  "The room ID to send messages to.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "GMtOWY0ZGJkNzMyMGFl",
					PropertyName: "room_id",
					Required:     true,
				},
				{
					Label:        "Bot Token",
					Description:  "Non-expiring access token of the bot that will post messages on our behalf.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  `GMtOWY0ZGJkNzMyMGFl-12535454-123213`,
					PropertyName: "bot_token",
					Secure:       true,
					Required:     true,
				},
				{
					Label:        "Notification Template",
					Description:  "Notification template to use. Markdown is supported.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  `{{ template "default.message" . }}`,
					PropertyName: "message",
				},
			},
		},
		{ // Since Grafana 11.1
			Type:        "sns",
			Name:        "AWS SNS",
			Description: "Sends notifications to AWS Simple Notification Service",
			Heading:     "Webex settings",
			Options: []NotifierOption{
				{
					Label:        "The Amazon SNS API URL",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "",
					PropertyName: "api_url",
				},
				{
					Label:        "SigV4 Authentication",
					Description:  "Configures AWS's Signature Verification 4 signing process to sign requests",
					Element:      ElementTypeSubform,
					PropertyName: "sigv4",
					SubformOptions: []NotifierOption{
						{
							Label:        "Region",
							Description:  "The AWS region. If blank, the region from the default credentials chain is used.",
							Element:      ElementTypeInput,
							InputType:    InputTypeText,
							Placeholder:  "",
							PropertyName: "region",
						},
						{
							Label:        "Access Key",
							Description:  "The AWS API access key.",
							Element:      ElementTypeInput,
							InputType:    InputTypeText,
							Placeholder:  "",
							PropertyName: "access_key",
							Secure:       true,
						},
						{
							Label:        "Secret Key",
							Description:  "The AWS API secret key.",
							Element:      ElementTypeInput,
							InputType:    InputTypeText,
							Placeholder:  "",
							PropertyName: "secret_key",
							Secure:       true,
						},
						{
							Label:        "Profile",
							Description:  "Named AWS profile used to authenticate",
							Element:      ElementTypeInput,
							InputType:    InputTypeText,
							Placeholder:  "",
							PropertyName: "profile",
						},
						{
							Label:        "Role ARN",
							Description:  "AWS Role ARN, an alternative to using AWS API keys",
							Element:      ElementTypeInput,
							InputType:    InputTypeText,
							Placeholder:  "",
							PropertyName: "role_arn",
						},
					},
				},
				{
					Label:        "SNS topic ARN",
					Description:  "If you don't specify this value, you must specify a value for the phone_number or target_arn. If you are using a FIFO SNS topic you should set a message group interval longer than 5 minutes to prevent messages with the same group key being deduplicated by the SNS default deduplication window.",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  "",
					PropertyName: "topic_arn",
				},
				{
					Label:        "Phone number",
					Description:  "Phone number if message is delivered via SMS in E.164 format. If you don't specify this value, you must specify a value for the topic_arn or target_arn",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  ``,
					PropertyName: "phone_number",
					Secure:       false,
				},
				{
					Label:        "Target ARN",
					Description:  "The mobile platform endpoint ARN if message is delivered via mobile notifications. If you don't specify this value, you must specify a value for the topic_arn or phone_number",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Placeholder:  ``,
					PropertyName: "target_arn",
				},
				{
					Label:        "Subject",
					Element:      ElementTypeInput,
					InputType:    InputTypeText,
					Description:  "Optional subject. You can use templates to customize this field",
					PropertyName: "subject",
					Placeholder:  alertingTemplates.DefaultMessageTitleEmbed,
				},
				{
					Label:        "Message",
					Description:  "Optional message. You can use templates to customize this field. Using a custom message will replace the default message",
					Element:      ElementTypeTextArea,
					PropertyName: "message",
					Placeholder:  alertingTemplates.DefaultMessageEmbed,
				},
				{
					Label:        "Attributes",
					Description:  "SNS message attributes",
					Element:      ElementTypeKeyValueMap,
					InputType:    InputTypeText,
					PropertyName: "attributes",
				},
			},
		},
	}
}

// GetSecretKeysForContactPointType returns settings keys of contact point of the given type that are expected to be secrets. Returns error is contact point type is not known.
func GetSecretKeysForContactPointType(contactPointType string) ([]string, error) {
	notifiers := GetAvailableNotifiers()
	for _, n := range notifiers {
		if strings.EqualFold(n.Type, contactPointType) {
			return getSecretFields("", n.Options), nil
		}
	}
	return nil, fmt.Errorf("no secrets configured for type '%s'", contactPointType)
}

func getSecretFields(parentPath string, options []NotifierOption) []string {
	var secureFields []string
	for _, field := range options {
		name := field.PropertyName
		if parentPath != "" {
			name = parentPath + "." + name
		}
		if field.Secure {
			secureFields = append(secureFields, name)
			continue
		}
		if len(field.SubformOptions) > 0 {
			secureFields = append(secureFields, getSecretFields(name, field.SubformOptions)...)
		}
	}
	return secureFields
}

// ConfigForIntegrationType returns the config for the given integration type. Returns error is integration type is not known.
func ConfigForIntegrationType(contactPointType string) (*NotifierPlugin, error) {
	notifiers := GetAvailableNotifiers()
	for _, n := range notifiers {
		if strings.EqualFold(n.Type, contactPointType) {
			return n, nil
		}
	}
	return nil, fmt.Errorf("unknown integration type '%s'", contactPointType)
}
