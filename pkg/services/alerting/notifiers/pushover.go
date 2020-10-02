package notifiers

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const pushoverEndpoint = "https://api.pushover.net/1/messages.json"

func init() {
	soundOptions := []alerting.SelectOption{
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

	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "pushover",
		Name:        "Pushover",
		Description: "Sends HTTP POST request to the Pushover API",
		Heading:     "Pushover settings",
		Factory:     NewPushoverNotifier,
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
				Label:   "Priority",
				Element: alerting.ElementTypeSelect,
				SelectOptions: []alerting.SelectOption{
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
				},
				PropertyName: "priority",
			},
			{
				Label:        "Retry",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "minimum 30 seconds",
				PropertyName: "retry",
				ShowWhen: alerting.ShowWhen{
					Field: "priority",
					Is:    "2",
				},
			},
			{
				Label:        "Expire",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "maximum 86400 seconds",
				PropertyName: "expire",
				ShowWhen: alerting.ShowWhen{
					Field: "priority",
					Is:    "2",
				},
			},
			{
				Label:         "Alerting sound",
				Element:       alerting.ElementTypeSelect,
				SelectOptions: soundOptions,
				PropertyName:  "sound",
			},
			{
				Label:         "OK sound",
				Element:       alerting.ElementTypeSelect,
				SelectOptions: soundOptions,
				PropertyName:  "okSound",
			},
		},
	})
}

// NewPushoverNotifier is the constructor for the Pushover Notifier
func NewPushoverNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	userKey := model.DecryptedValue("userKey", model.Settings.Get("userKey").MustString())
	APIToken := model.DecryptedValue("apiToken", model.Settings.Get("apiToken").MustString())
	device := model.Settings.Get("device").MustString()
	priority, _ := strconv.Atoi(model.Settings.Get("priority").MustString())
	retry, _ := strconv.Atoi(model.Settings.Get("retry").MustString())
	expire, _ := strconv.Atoi(model.Settings.Get("expire").MustString())
	alertingSound := model.Settings.Get("sound").MustString()
	okSound := model.Settings.Get("okSound").MustString()
	uploadImage := model.Settings.Get("uploadImage").MustBool(true)

	if userKey == "" {
		return nil, alerting.ValidationError{Reason: "User key not given"}
	}
	if APIToken == "" {
		return nil, alerting.ValidationError{Reason: "API token not given"}
	}
	return &PushoverNotifier{
		NotifierBase:  NewNotifierBase(model),
		UserKey:       userKey,
		APIToken:      APIToken,
		Priority:      priority,
		Retry:         retry,
		Expire:        expire,
		Device:        device,
		AlertingSound: alertingSound,
		OkSound:       okSound,
		Upload:        uploadImage,
		log:           log.New("alerting.notifier.pushover"),
	}, nil
}

// PushoverNotifier is responsible for sending
// alert notifications to Pushover
type PushoverNotifier struct {
	NotifierBase
	UserKey       string
	APIToken      string
	Priority      int
	Retry         int
	Expire        int
	Device        string
	AlertingSound string
	OkSound       string
	Upload        bool
	log           log.Logger
}

// Notify sends a alert notification to Pushover
func (pn *PushoverNotifier) Notify(evalContext *alerting.EvalContext) error {
	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		pn.log.Error("Failed get rule link", "error", err)
		return err
	}

	message := evalContext.Rule.Message
	for idx, evt := range evalContext.EvalMatches {
		message += fmt.Sprintf("\n<b>%s</b>: %v", evt.Metric, evt.Value)
		if idx > 4 {
			break
		}
	}
	if evalContext.Error != nil {
		message += fmt.Sprintf("\n<b>Error message:</b> %s", evalContext.Error.Error())
	}

	if message == "" {
		message = "Notification message missing (Set a notification message to replace this text.)"
	}

	headers, uploadBody, err := pn.genPushoverBody(evalContext, message, ruleURL)
	if err != nil {
		pn.log.Error("Failed to generate body for pushover", "error", err)
		return err
	}

	cmd := &models.SendWebhookSync{
		Url:        pushoverEndpoint,
		HttpMethod: "POST",
		HttpHeader: headers,
		Body:       uploadBody.String(),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		pn.log.Error("Failed to send pushover notification", "error", err, "webhook", pn.Name)
		return err
	}

	return nil
}

func (pn *PushoverNotifier) genPushoverBody(evalContext *alerting.EvalContext, message string, ruleURL string) (map[string]string, bytes.Buffer, error) {
	var b bytes.Buffer
	var err error
	w := multipart.NewWriter(&b)

	// Add image only if requested and available
	if pn.Upload && evalContext.ImageOnDiskPath != "" {
		f, err := os.Open(evalContext.ImageOnDiskPath)
		if err != nil {
			return nil, b, err
		}
		defer f.Close()

		fw, err := w.CreateFormFile("attachment", evalContext.ImageOnDiskPath)
		if err != nil {
			return nil, b, err
		}

		_, err = io.Copy(fw, f)
		if err != nil {
			return nil, b, err
		}
	}

	// Add the user token
	err = w.WriteField("user", pn.UserKey)
	if err != nil {
		return nil, b, err
	}

	// Add the api token
	err = w.WriteField("token", pn.APIToken)
	if err != nil {
		return nil, b, err
	}

	// Add priority
	err = w.WriteField("priority", strconv.Itoa(pn.Priority))
	if err != nil {
		return nil, b, err
	}

	if pn.Priority == 2 {
		err = w.WriteField("retry", strconv.Itoa(pn.Retry))
		if err != nil {
			return nil, b, err
		}

		err = w.WriteField("expire", strconv.Itoa(pn.Expire))
		if err != nil {
			return nil, b, err
		}
	}

	// Add device
	if pn.Device != "" {
		err = w.WriteField("device", pn.Device)
		if err != nil {
			return nil, b, err
		}
	}

	// Add sound
	sound := pn.AlertingSound
	if evalContext.Rule.State == models.AlertStateOK {
		sound = pn.OkSound
	}
	if sound != "default" {
		err = w.WriteField("sound", sound)
		if err != nil {
			return nil, b, err
		}
	}

	// Add title
	err = w.WriteField("title", evalContext.GetNotificationTitle())
	if err != nil {
		return nil, b, err
	}

	// Add URL
	err = w.WriteField("url", ruleURL)
	if err != nil {
		return nil, b, err
	}
	// Add URL title
	err = w.WriteField("url_title", "Show dashboard with alert")
	if err != nil {
		return nil, b, err
	}

	// Add message
	err = w.WriteField("message", message)
	if err != nil {
		return nil, b, err
	}

	// Mark as html message
	err = w.WriteField("html", "1")
	if err != nil {
		return nil, b, err
	}

	w.Close()
	headers := map[string]string{
		"Content-Type": w.FormDataContentType(),
	}
	return headers, b, nil
}
