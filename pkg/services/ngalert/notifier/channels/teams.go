package channels

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

const (
	ImageSizeSmall  = "small"
	ImageSizeMedium = "medium"
	ImageSizeLarge  = "large"

	TextColorDark      = "dark"
	TextColorLight     = "light"
	TextColorAccent    = "accent"
	TextColorGood      = "good"
	TextColorWarning   = "warning"
	TextColorAttention = "attention"

	TextSizeSmall      = "small"
	TextSizeMedium     = "medium"
	TextSizeLarge      = "large"
	TextSizeExtraLarge = "extraLarge"
	TextSizeDefault    = "default"

	TextWeightLighter = "lighter"
	TextWeightBolder  = "bolder"
	TextWeightDefault = "default"
)

// AdaptiveCardsMessage represents a message for adaptive cards.
type AdaptiveCardsMessage struct {
	Attachments []AdaptiveCardsAttachment `json:"attachments"`
	Summary     string                    `json:"summary,omitempty"` // Summary is the text shown in notifications
	Type        string                    `json:"type"`
}

// NewAdaptiveCardsMessage returns a message prepared for adaptive cards.
// https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using#send-adaptive-cards-using-an-incoming-webhook
func NewAdaptiveCardsMessage(card AdaptiveCard) AdaptiveCardsMessage {
	return AdaptiveCardsMessage{
		Attachments: []AdaptiveCardsAttachment{{
			ContentType: "application/vnd.microsoft.card.adaptive",
			Content:     card,
		}},
		Type: "message",
	}
}

// AdaptiveCardsAttachment contains an adaptive card.
type AdaptiveCardsAttachment struct {
	Content     AdaptiveCard `json:"content"`
	ContentType string       `json:"contentType"`
	ContentURL  string       `json:"contentUrl,omitempty"`
}

// AdapativeCard repesents an Adaptive Card.
// https://adaptivecards.io/explorer/AdaptiveCard.html
type AdaptiveCard struct {
	Body    []AdaptiveCardItem
	Schema  string
	Type    string
	Version string
}

// NewAdaptiveCard returns a prepared Adaptive Card.
func NewAdaptiveCard() AdaptiveCard {
	return AdaptiveCard{
		Body:    make([]AdaptiveCardItem, 0),
		Schema:  "http://adaptivecards.io/schemas/adaptive-card.json",
		Type:    "AdaptiveCard",
		Version: "1.4",
	}
}

func (c *AdaptiveCard) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Body    []AdaptiveCardItem     `json:"body"`
		Schema  string                 `json:"$schema"`
		Type    string                 `json:"type"`
		Version string                 `json:"version"`
		MsTeams map[string]interface{} `json:"msTeams,omitempty"`
	}{
		Body:    c.Body,
		Schema:  c.Schema,
		Type:    c.Type,
		Version: c.Version,
		MsTeams: map[string]interface{}{"width": "Full"},
	})
}

// AppendItem appends an item, such as text or an image, to the Adaptive Card.
func (c *AdaptiveCard) AppendItem(i AdaptiveCardItem) {
	c.Body = append(c.Body, i)
}

// AdaptiveCardItem is an interface for adaptive card items such as containers, elements and inputs.
type AdaptiveCardItem interface {
	MarshalJSON() ([]byte, error)
}

// AdaptiveCardTextBlockItem is a TextBlock.
type AdaptiveCardTextBlockItem struct {
	Color  string
	Size   string
	Text   string
	Weight string
	Wrap   bool
}

func (i AdaptiveCardTextBlockItem) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type   string `json:"type"`
		Text   string `json:"text"`
		Color  string `json:"color,omitempty"`
		Size   string `json:"size,omitempty"`
		Weight string `json:"weight,omitempty"`
		Wrap   bool   `json:"wrap,omitempty"`
	}{
		Type:   "TextBlock",
		Text:   i.Text,
		Color:  i.Color,
		Size:   i.Size,
		Weight: i.Weight,
		Wrap:   i.Wrap,
	})
}

// AdaptiveCardImageSetItem is an ImageSet.
type AdaptiveCardImageSetItem struct {
	Images []AdaptiveCardImageItem
	Size   string
}

// AppendImage appends an image to image set.
func (i *AdaptiveCardImageSetItem) AppendImage(image AdaptiveCardImageItem) {
	i.Images = append(i.Images, image)
}

func (i AdaptiveCardImageSetItem) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type   string                  `json:"type"`
		Images []AdaptiveCardImageItem `json:"images"`
		Size   string                  `json:"imageSize"`
	}{
		Type:   "ImageSet",
		Images: i.Images,
		Size:   i.Size,
	})
}

// AdaptiveCardImageItem is an Image.
type AdaptiveCardImageItem struct {
	AltText string
	Size    string
	URL     string
}

func (i AdaptiveCardImageItem) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type    string                 `json:"type"`
		URL     string                 `json:"url"`
		AltText string                 `json:"altText,omitempty"`
		Size    string                 `json:"size,omitempty"`
		MsTeams map[string]interface{} `json:"msTeams,omitempty"`
	}{
		Type:    "Image",
		URL:     i.URL,
		AltText: i.AltText,
		Size:    i.Size,
		MsTeams: map[string]interface{}{"allowExpand": true},
	})
}

// AdaptiveCardActionSetItem is an ActionSet.
type AdaptiveCardActionSetItem struct {
	Actions []AdaptiveCardActionItem
}

func (i AdaptiveCardActionSetItem) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type    string                   `json:"type"`
		Actions []AdaptiveCardActionItem `json:"actions"`
	}{
		Type:    "ActionSet",
		Actions: i.Actions,
	})
}

type AdaptiveCardActionItem interface {
	MarshalJSON() ([]byte, error)
}

// AdapativeCardOpenURLActionItem is an Action.OpenUrl action.
type AdaptiveCardOpenURLActionItem struct {
	IconURL string
	Title   string
	URL     string
}

func (i AdaptiveCardOpenURLActionItem) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type    string `json:"type"`
		Title   string `json:"title"`
		URL     string `json:"url"`
		IconURL string `json:"iconUrl,omitempty"`
	}{
		Type:    "Action.OpenUrl",
		Title:   i.Title,
		URL:     i.URL,
		IconURL: i.IconURL,
	})
}

type TeamsConfig struct {
	*NotificationChannelConfig
	URL          string
	Message      string
	Title        string
	SectionTitle string
}

func NewTeamsConfig(config *NotificationChannelConfig) (*TeamsConfig, error) {
	URL := config.Settings.Get("url").MustString()
	if URL == "" {
		return nil, errors.New("could not find url property in settings")
	}
	return &TeamsConfig{
		NotificationChannelConfig: config,
		URL:                       URL,
		Message:                   config.Settings.Get("message").MustString(`{{ template "teams.default.message" .}}`),
		Title:                     config.Settings.Get("title").MustString(DefaultMessageTitleEmbed),
		SectionTitle:              config.Settings.Get("sectiontitle").MustString(""),
	}, nil
}

type TeamsNotifier struct {
	*Base
	URL          string
	Message      string
	Title        string
	SectionTitle string
	tmpl         *template.Template
	log          log.Logger
	ns           notifications.WebhookSender
	images       ImageStore
}

// NewTeamsNotifier is the constructor for Teams notifier.
func NewTeamsNotifier(config *TeamsConfig, ns notifications.WebhookSender, images ImageStore, t *template.Template) *TeamsNotifier {
	return &TeamsNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		URL:          config.URL,
		Message:      config.Message,
		Title:        config.Title,
		SectionTitle: config.SectionTitle,
		log:          log.New("alerting.notifier.teams"),
		ns:           ns,
		images:       images,
		tmpl:         t,
	}
}

func TeamsFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewTeamsConfig(fc.Config)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewTeamsNotifier(cfg, fc.NotificationService, fc.ImageStore, fc.Template), nil
}

func (tn *TeamsNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	var tmplErr error
	tmpl, _ := TmplText(ctx, tn.tmpl, as, tn.log, &tmplErr)

	card := NewAdaptiveCard()
	card.AppendItem(AdaptiveCardTextBlockItem{
		Color:  getTeamsTextColor(types.Alerts(as...)),
		Text:   tmpl(tn.Title),
		Size:   TextSizeLarge,
		Weight: TextWeightBolder,
		Wrap:   true,
	})
	card.AppendItem(AdaptiveCardTextBlockItem{
		Text: tmpl(tn.Message),
		Wrap: true,
	})

	var s AdaptiveCardImageSetItem
	_ = withStoredImages(ctx, tn.log, tn.images,
		func(_ int, image ngmodels.Image) error {
			if image.URL != "" {
				s.AppendImage(AdaptiveCardImageItem{URL: image.URL})
			}
			return nil
		},
		as...)

	if len(s.Images) > 2 {
		s.Size = ImageSizeMedium
		card.AppendItem(s)
	} else if len(s.Images) > 0 {
		s.Size = ImageSizeLarge
		card.AppendItem(s)
	}

	card.AppendItem(AdaptiveCardActionSetItem{
		Actions: []AdaptiveCardActionItem{
			AdaptiveCardOpenURLActionItem{
				Title: "View URL",
				URL:   joinUrlPath(tn.tmpl.ExternalURL.String(), "/alerting/list", tn.log),
			},
		},
	})

	msg := NewAdaptiveCardsMessage(card)
	msg.Summary = tmpl(tn.Title)

	// This check for tmplErr must happen before templating the URL
	if tmplErr != nil {
		tn.log.Warn("failed to template Teams message", "err", tmplErr.Error())
		tmplErr = nil
	}

	u := tmpl(tn.URL)
	if tmplErr != nil {
		tn.log.Warn("failed to template Teams URL", "err", tmplErr.Error(), "fallback", tn.URL)
		u = tn.URL
	}

	b, err := json.Marshal(msg)
	if err != nil {
		return false, fmt.Errorf("failed to marshal JSON: %w", err)
	}

	cmd := &models.SendWebhookSync{Url: u, Body: string(b)}
	// Teams sometimes does not use status codes to show when a request has failed. Instead, the
	// response can contain an error message, irrespective of status code (i.e. https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using?tabs=cURL#rate-limiting-for-connectors)
	cmd.Validation = func(b []byte, statusCode int) error {
		// The request succeeded if the response is "1"
		// https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using?tabs=cURL#send-messages-using-curl-and-powershell
		if !bytes.Equal(b, []byte("1")) {
			return errors.New(string(b))
		}
		return nil
	}

	if err := tn.ns.SendWebhookSync(ctx, cmd); err != nil {
		return false, errors.Wrap(err, "send notification to Teams")
	}

	return true, nil
}

func (tn *TeamsNotifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}

// getTeamsTextColor returns the text color for the message title.
func getTeamsTextColor(alerts model.Alerts) string {
	if getAlertStatusColor(alerts.Status()) == ColorAlertFiring {
		return TextColorAttention
	}
	return TextColorGood
}
