package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

// GoogleChatNotifier is responsible for sending
// alert notifications to Google chat.
type GoogleChatNotifier struct {
	*Base
	URL     string
	log     log.Logger
	ns      notifications.WebhookSender
	images  ImageStore
	tmpl    *template.Template
	content string
}

type GoogleChatConfig struct {
	*NotificationChannelConfig
	URL     string
	Content string
}

func GoogleChatFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewGoogleChatConfig(fc.Config)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewGoogleChatNotifier(cfg, fc.ImageStore, fc.NotificationService, fc.Template), nil
}

func NewGoogleChatConfig(config *NotificationChannelConfig) (*GoogleChatConfig, error) {
	url := config.Settings.Get("url").MustString()
	if url == "" {
		return nil, errors.New("could not find url property in settings")
	}
	return &GoogleChatConfig{
		NotificationChannelConfig: config,
		URL:                       url,
		Content:                   config.Settings.Get("message").MustString(`{{ template "default.message" . }}`),
	}, nil
}

func NewGoogleChatNotifier(config *GoogleChatConfig, images ImageStore, ns notifications.WebhookSender, t *template.Template) *GoogleChatNotifier {
	return &GoogleChatNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		content: config.Content,
		URL:     config.URL,
		log:     log.New("alerting.notifier.googlechat"),
		ns:      ns,
		images:  images,
		tmpl:    t,
	}
}

// Notify send an alert notification to Google Chat.
func (gcn *GoogleChatNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	gcn.log.Debug("Executing Google Chat notification")

	var tmplErr error
	tmpl, _ := TmplText(ctx, gcn.tmpl, as, gcn.log, &tmplErr)

	widgets := []widget{}

	if msg := tmpl(gcn.content); msg != "" {
		// Add a text paragraph widget for the message if there is a message.
		// Google Chat API doesn't accept an empty text property.
		widgets = append(widgets, textParagraphWidget{
			Text: text{
				Text: msg,
			},
		})
	}

	if tmplErr != nil {
		gcn.log.Warn("failed to template Google Chat message", "err", tmplErr.Error())
		tmplErr = nil
	}

	ruleURL := joinUrlPath(gcn.tmpl.ExternalURL.String(), "/alerting/list", gcn.log)
	// Add a button widget (link to Grafana).
	widgets = append(widgets, buttonWidget{
		Buttons: []button{
			{
				TextButton: textButton{
					Text: "OPEN IN GRAFANA",
					OnClick: onClick{
						OpenLink: openLink{
							URL: ruleURL,
						},
					},
				},
			},
		},
	})

	// Add text paragraph widget for the build version and timestamp.
	widgets = append(widgets, textParagraphWidget{
		Text: text{
			Text: "Grafana v" + setting.BuildVersion + " | " + (timeNow()).Format(time.RFC822),
		},
	})

	// Nest the required structs.
	res := &outerStruct{
		PreviewText:  tmpl(DefaultMessageTitleEmbed),
		FallbackText: tmpl(DefaultMessageTitleEmbed),
		Cards: []card{
			{
				Header: header{
					Title: tmpl(DefaultMessageTitleEmbed),
				},
				Sections: []section{
					{
						Widgets: widgets,
					},
				},
			},
		},
	}
	if screenshots := gcn.buildScreenshotCard(ctx, as); screenshots != nil {
		res.Cards = append(res.Cards, *screenshots)
	}

	if tmplErr != nil {
		gcn.log.Warn("failed to template GoogleChat message", "err", tmplErr.Error())
		tmplErr = nil
	}

	u := tmpl(gcn.URL)
	if tmplErr != nil {
		gcn.log.Warn("failed to template GoogleChat URL", "err", tmplErr.Error(), "fallback", gcn.URL)
		u = gcn.URL
	}

	body, err := json.Marshal(res)
	if err != nil {
		return false, fmt.Errorf("marshal json: %w", err)
	}

	cmd := &models.SendWebhookSync{
		Url:        u,
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/json; charset=UTF-8",
		},
		Body: string(body),
	}

	if err := gcn.ns.SendWebhookSync(ctx, cmd); err != nil {
		gcn.log.Error("Failed to send Google Hangouts Chat alert", "error", err, "webhook", gcn.Name)
		return false, err
	}

	return true, nil
}

func (gcn *GoogleChatNotifier) SendResolved() bool {
	return !gcn.GetDisableResolveMessage()
}

func (gcn *GoogleChatNotifier) buildScreenshotCard(ctx context.Context, alerts []*types.Alert) *card {
	card := card{
		Header: header{
			Title: "Screenshots",
		},
		Sections: []section{},
	}
	for _, alert := range alerts {
		imgToken := getTokenFromAnnotations(alert.Annotations)
		if len(imgToken) == 0 {
			continue
		}

		timeoutCtx, cancel := context.WithTimeout(ctx, ImageStoreTimeout)
		imgURL, err := gcn.images.GetURL(timeoutCtx, imgToken)
		cancel()
		if err != nil {
			if !errors.Is(err, ErrImagesUnavailable) {
				// Ignore errors. Don't log "ImageUnavailable", which means the storage doesn't exist.
				gcn.log.Warn("failed to retrieve image url from store", "error", err)
			}
		}

		if len(imgURL) > 0 {
			section := section{
				Widgets: []widget{
					textParagraphWidget{
						Text: text{
							Text: fmt.Sprintf("%s: %s", alert.Status(), alert.Name()),
						},
					},
					imageWidget{
						Image: imageData{
							ImageURL: imgURL,
						},
					},
				},
			}
			card.Sections = append(card.Sections, section)
		}
	}
	if len(card.Sections) == 0 {
		return nil
	}
	return &card
}

// Structs used to build a custom Google Hangouts Chat message card.
// See: https://developers.google.com/hangouts/chat/reference/message-formats/cards
type outerStruct struct {
	PreviewText  string `json:"previewText"`
	FallbackText string `json:"fallbackText"`
	Cards        []card `json:"cards"`
}

type card struct {
	Header   header    `json:"header"`
	Sections []section `json:"sections"`
}

type header struct {
	Title string `json:"title"`
}

type section struct {
	Widgets []widget `json:"widgets"`
}

// "generic" widget used to add different types of widgets (buttonWidget, textParagraphWidget, imageWidget)
type widget interface{}

type buttonWidget struct {
	Buttons []button `json:"buttons"`
}

type textParagraphWidget struct {
	Text text `json:"textParagraph"`
}

type imageWidget struct {
	Image imageData `json:"image"`
}

type imageData struct {
	ImageURL string `json:"imageUrl"`
}

type text struct {
	Text string `json:"text"`
}

type button struct {
	TextButton textButton `json:"textButton"`
}

type textButton struct {
	Text    string  `json:"text"`
	OnClick onClick `json:"onClick"`
}

type onClick struct {
	OpenLink openLink `json:"openLink"`
}

type openLink struct {
	URL string `json:"url"`
}
