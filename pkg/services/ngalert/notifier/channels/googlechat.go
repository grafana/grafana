package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/setting"
)

// GoogleChatNotifier is responsible for sending
// alert notifications to Google chat.
type GoogleChatNotifier struct {
	old_notifiers.NotifierBase
	URL  string
	log  log.Logger
	tmpl *template.Template
}

func NewGoogleChatNotifier(model *NotificationChannelConfig, t *template.Template) (*GoogleChatNotifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, receiverInitError{Cfg: *model, Reason: "could not find url property in settings"}
	}

	return &GoogleChatNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		URL:  url,
		log:  log.New("alerting.notifier.googlechat"),
		tmpl: t,
	}, nil
}

// Notify send an alert notification to Google Chat.
func (gcn *GoogleChatNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	gcn.log.Debug("Executing Google Chat notification")

	var tmplErr error
	tmpl, _ := TmplText(ctx, gcn.tmpl, as, gcn.log, &tmplErr)

	widgets := []widget{}

	if msg := tmpl(`{{ template "default.message" . }}`); msg != "" {
		// Add a text paragraph widget for the message if there is a message.
		// Google Chat API doesn't accept an empty text property.
		widgets = append(widgets, textParagraphWidget{
			Text: text{
				Text: msg,
			},
		})
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
			Text: "Grafana v" + setting.BuildVersion + " | " + (time.Now()).Format(time.RFC822),
		},
	})

	// Nest the required structs.
	res := &outerStruct{
		PreviewText:  tmpl(`{{ template "default.title" . }}`),
		FallbackText: tmpl(`{{ template "default.title" . }}`),
		Cards: []card{
			{
				Header: header{
					Title: tmpl(`{{ template "default.title" . }}`),
				},
				Sections: []section{
					{
						Widgets: widgets,
					},
				},
			},
		},
	}

	u := tmpl(gcn.URL)
	if tmplErr != nil {
		gcn.log.Debug("failed to template GoogleChat message", "err", tmplErr.Error())
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

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		gcn.log.Error("Failed to send Google Hangouts Chat alert", "error", err, "webhook", gcn.Name)
		return false, err
	}

	return true, nil
}

func (gcn *GoogleChatNotifier) SendResolved() bool {
	return !gcn.GetDisableResolveMessage()
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
