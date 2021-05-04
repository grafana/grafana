package notifier

import "github.com/grafana/grafana/pkg/services/alerting"

// GetAvailableNotifiers returns the metadata of all the notification channels that can be configured.
func GetAvailableNotifiers() []*alerting.NotifierPlugin {
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
			Type:        "slack",
			Name:        "Slack",
			Description: "Sends notifications to Slack",
			Heading:     "Slack settings",
			Options: []alerting.NotifierOption{
				{
					Label:        "Recipient",
					Element:      alerting.ElementTypeInput,
					InputType:    alerting.InputTypeText,
					Description:  "Specify channel or user, use #channel-name, @username (has to be all lowercase, no whitespace), or user/channel Slack ID - required unless you provide a webhook",
					PropertyName: "recipient",
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
	}
}
