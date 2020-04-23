package notifiers

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type: "googlechat",
		Name: "Google Hangouts Chat",
		Description: "Sends notifications to Google Hangouts Chat via webhooks based on the official JSON message " +
			"format (https://developers.google.com/hangouts/chat/reference/message-formats/).",
		Factory: newGoogleChatNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Google Hangouts Chat settings</h3>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Url</span>
        <input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.url" placeholder="Google Hangouts Chat incoming webhook url"></input>
      </div>
    `,
	})
}

func newGoogleChatNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	return &GoogleChatNotifier{
		NotifierBase: NewNotifierBase(model),
		URL:          url,
		log:          log.New("alerting.notifier.googlechat"),
	}, nil
}

// GoogleChatNotifier is responsible for sending
// alert notifications to Google chat.
type GoogleChatNotifier struct {
	NotifierBase
	URL string
	log log.Logger
}

/**
Structs used to build a custom Google Hangouts Chat message card.
See: https://developers.google.com/hangouts/chat/reference/message-formats/cards
*/
type outerStruct struct {
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
type widget interface {
}

type buttonWidget struct {
	Buttons []button `json:"buttons"`
}

type textParagraphWidget struct {
	Text text `json:"textParagraph"`
}

type text struct {
	Text string `json:"text"`
}

type imageWidget struct {
	Image image `json:"image"`
}

type image struct {
	ImageURL string `json:"imageUrl"`
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

// Notify send an alert notification to Google Chat.
func (gcn *GoogleChatNotifier) Notify(evalContext *alerting.EvalContext) error {
	gcn.log.Info("Executing Google Chat notification")

	headers := map[string]string{
		"Content-Type": "application/json; charset=UTF-8",
	}

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		gcn.log.Error("evalContext returned an invalid rule URL")
	}

	widgets := []widget{}
	if len(evalContext.Rule.Message) > 0 {
		// add a text paragraph widget for the message if there is a message
		// Google Chat API doesn't accept an empty text property
		widgets = append(widgets, textParagraphWidget{
			Text: text{
				Text: evalContext.Rule.Message,
			},
		})
	}

	// add a text paragraph widget for the fields
	var fields []textParagraphWidget
	fieldLimitCount := 4
	for index, evt := range evalContext.EvalMatches {
		fields = append(fields,
			textParagraphWidget{
				Text: text{
					Text: "<i>" + evt.Metric + ": " + fmt.Sprint(evt.Value) + "</i>",
				},
			},
		)
		if index > fieldLimitCount {
			break
		}
	}
	widgets = append(widgets, fields)

	// if an image exists, add it as an image widget
	if evalContext.ImagePublicURL != "" {
		widgets = append(widgets, imageWidget{
			Image: image{
				ImageURL: evalContext.ImagePublicURL,
			},
		})
	} else {
		gcn.log.Info("Could not retrieve a public image URL.")
	}

	// add a button widget (link to Grafana)
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

	// add text paragraph widget for the build version and timestamp
	widgets = append(widgets, textParagraphWidget{
		Text: text{
			Text: "Grafana v" + setting.BuildVersion + " | " + (time.Now()).Format(time.RFC822),
		},
	})

	// nest the required structs
	res1D := &outerStruct{
		FallbackText: evalContext.GetNotificationTitle(),
		Cards: []card{
			{
				Header: header{
					Title: evalContext.GetNotificationTitle(),
				},
				Sections: []section{
					{
						Widgets: widgets,
					},
				},
			},
		},
	}
	body, _ := json.Marshal(res1D)

	cmd := &models.SendWebhookSync{
		Url:        gcn.URL,
		HttpMethod: "POST",
		HttpHeader: headers,
		Body:       string(body),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		gcn.log.Error("Failed to send Google Hangouts Chat alert", "error", err, "webhook", gcn.Name)
		return err
	}

	return nil
}
