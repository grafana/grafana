package model

import "github.com/grafana/grafana/pkg/services/rendering"

type PreviewRequest struct {
	DashboardURL string `json:"dashboardUrl"`
}
type PreviewResponse struct {
	PreviewURL string `json:"previewUrl"`
}

type EventChallengeAck struct {
	Challenge string `json:"challenge"`
}

// Authorization represents the "authorizations" field in the payload
type Authorization struct {
	EnterpriseID        interface{} `json:"enterprise_id"`
	TeamID              string      `json:"team_id"`
	UserID              string      `json:"user_id"`
	IsBot               bool        `json:"is_bot"`
	IsEnterpriseInstall bool        `json:"is_enterprise_install"`
}

type EventPayload struct {
	Token              string          `json:"token"`
	TeamID             string          `json:"team_id"`
	APIAppID           string          `json:"api_app_id"`
	Event              Event           `json:"event"`
	Type               string          `json:"type"`
	EventID            string          `json:"event_id"`
	EventTime          int64           `json:"event_time"`
	Authorizations     []Authorization `json:"authorizations"`
	IsExtSharedChannel bool            `json:"is_ext_shared_channel"`
	EventContext       string          `json:"event_context"`
	Challenge          string          `json:"challenge"`
}

// Event represents the "event" field in the payload
type Event struct {
	Type            string `json:"type"`
	User            string `json:"user"`
	Channel         string `json:"channel"`
	MessageTS       string `json:"message_ts"`
	Links           []Link `json:"links"`
	Source          string `json:"source"`
	UnfurlID        string `json:"unfurl_id"`
	IsBotUserMember bool   `json:"is_bot_user_member"`
	EventTS         string `json:"event_ts"`
}

// Link represents the "links" field in the event
type Link struct {
	URL    string `json:"url"`
	Domain string `json:"domain"`
}

type Text struct {
	Type string `json:"type,omitempty"`
	Text string `json:"text,omitempty"`
}

type ImageAccessory struct {
	Type     string `json:"type,omitempty"`
	Title    *Text  `json:"title,omitempty"`
	ImageURL string `json:"image_url,omitempty"`
	AltText  string `json:"alt_text,omitempty"`
}

type Element struct {
	Type  string `json:"type,omitempty"`
	Text  *Text  `json:"text,omitempty"`
	Style string `json:"style,omitempty"`
	Value string `json:"value,omitempty"`
	URL   string `json:"url,omitempty"`
}

type Block struct {
	Type      string          `json:"type,omitempty"`
	Text      *Text           `json:"text,omitempty"`
	Accessory *ImageAccessory `json:"accessory,omitempty"`
	ImageURL  string          `json:"image_url,omitempty"`
	Title     *Text           `json:"title,omitempty"`
	AltText   string          `json:"alt_text,omitempty"`
	Elements  []Element       `json:"elements,omitempty"`
}

type Unfurl struct {
	Blocks []Block `json:"blocks,omitempty"`
}

type Unfurls map[string]Unfurl

type UnfurlEventPayload struct {
	Channel string  `json:"channel,omitempty"`
	TS      string  `json:"ts,omitempty"`
	Unfurls Unfurls `json:"unfurls,omitempty"`
}

type PostMessageRequest struct {
	Channel string  `json:"channel"`
	Blocks  []Block `json:"blocks,omitempty"`
}

type PostMessageResponse struct {
	Ok bool `json:"ok"`
}

type ScreenshotOptions struct {
	AuthOptions  rendering.AuthOpts
	DashboardUID string
	PanelID      int64
	From         string
	To           string
}
