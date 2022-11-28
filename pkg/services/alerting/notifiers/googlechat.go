package notifiers

import (
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "googlechat",
		Name:        "Google Hangouts Chat",
		Description: "Sends notifications to Google Hangouts Chat via webhooks based on the official JSON message format",
		Factory:     newGoogleChatNotifier,
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
		},
	})
}

func newGoogleChatNotifier(model *models.AlertNotification, _ alerting.GetDecryptedValueFn, ns notifications.Service) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	return &GoogleChatNotifier{
		NotifierBase: NewNotifierBase(model, ns),
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

/*
*
Structs used to build a custom Google Hangouts Chat message card.
See: https://developers.google.com/hangouts/chat/reference/message-formats/cards
*/
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

	if gcn.NeedsImage() {
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
	}

	if gcn.isUrlAbsolute(ruleURL) {
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
	} else {
		gcn.log.Warn("Grafana External URL setting is missing or invalid. Skipping 'open in grafana' button to prevent google from displaying empty alerts.", "ruleURL", ruleURL)
	}

	// add text paragraph widget for the build version and timestamp
	widgets = append(widgets, textParagraphWidget{
		Text: text{
			Text: "Grafana v" + setting.BuildVersion + " | " + (time.Now()).Format(time.RFC822),
		},
	})

	// nest the required structs
	res1D := &outerStruct{
		PreviewText:  evalContext.GetNotificationTitle(),
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

	if err := gcn.NotificationService.SendWebhookSync(evalContext.Ctx, cmd); err != nil {
		gcn.log.Error("Failed to send Google Hangouts Chat alert", "error", err, "webhook", gcn.Name)
		return err
	}

	return nil
}

func (gcn *GoogleChatNotifier) isUrlAbsolute(urlToCheck string) bool {
	parsed, err := url.Parse(urlToCheck)
	if err != nil {
		gcn.log.Warn("Could not parse URL", "urlToCheck", urlToCheck)
		return false
	}

	return parsed.IsAbs()
}
