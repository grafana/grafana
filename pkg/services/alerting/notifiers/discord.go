package notifiers

import (
	"bytes"
	"io"
	"mime/multipart"
	"os"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "discord",
		Name:        "Discord",
		Description: "Sends notifications to Discord",
		Factory:     newDiscordNotifier,
		Heading:     "Discord settings",
		Options: []alerting.NotifierOption{
			{
				Label:        "Message Content",
				Description:  "Mention a group using @ or a user using <@ID> when notifying in a channel",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				PropertyName: "content",
			},
			{
				Label:        "Webhook URL",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "Discord webhook URL",
				PropertyName: "url",
				Required:     true,
			},
		},
	})
}

func newDiscordNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	content := model.Settings.Get("content").MustString()
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find webhook url property in settings"}
	}

	return &DiscordNotifier{
		NotifierBase: NewNotifierBase(model),
		Content:      content,
		WebhookURL:   url,
		log:          log.New("alerting.notifier.discord"),
	}, nil
}

// DiscordNotifier is responsible for sending alert
// notifications to discord.
type DiscordNotifier struct {
	NotifierBase
	Content    string
	WebhookURL string
	log        log.Logger
}

// Notify send an alert notification to Discord.
func (dn *DiscordNotifier) Notify(evalContext *alerting.EvalContext) error {
	dn.log.Info("Sending alert notification to", "webhook_url", dn.WebhookURL)

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		dn.log.Error("Failed get rule link", "error", err)
		return err
	}

	bodyJSON := simplejson.New()
	bodyJSON.Set("username", "Grafana")

	if dn.Content != "" {
		bodyJSON.Set("content", dn.Content)
	}

	fields := make([]map[string]interface{}, 0)

	for _, evt := range evalContext.EvalMatches {
		fields = append(fields, map[string]interface{}{
			"name":   evt.Metric,
			"value":  evt.Value.FullString(),
			"inline": true,
		})
	}

	footer := map[string]interface{}{
		"text":     "Grafana v" + setting.BuildVersion,
		"icon_url": "https://grafana.com/assets/img/fav32.png",
	}

	color, _ := strconv.ParseInt(strings.TrimLeft(evalContext.GetStateModel().Color, "#"), 16, 0)

	embed := simplejson.New()
	embed.Set("title", evalContext.GetNotificationTitle())
	//Discord takes integer for color
	embed.Set("color", color)
	embed.Set("url", ruleURL)
	embed.Set("description", evalContext.Rule.Message)
	embed.Set("type", "rich")
	embed.Set("fields", fields)
	embed.Set("footer", footer)

	var image map[string]interface{}
	var embeddedImage = false

	if dn.NeedsImage() {
		if evalContext.ImagePublicURL != "" {
			image = map[string]interface{}{
				"url": evalContext.ImagePublicURL,
			}
			embed.Set("image", image)
		} else {
			image = map[string]interface{}{
				"url": "attachment://graph.png",
			}
			embed.Set("image", image)
			embeddedImage = true
		}
	}

	bodyJSON.Set("embeds", []interface{}{embed})

	json, _ := bodyJSON.MarshalJSON()

	cmd := &models.SendWebhookSync{
		Url:         dn.WebhookURL,
		HttpMethod:  "POST",
		ContentType: "application/json",
	}

	if !embeddedImage {
		cmd.Body = string(json)
	} else {
		err := dn.embedImage(cmd, evalContext.ImageOnDiskPath, json)
		if err != nil {
			dn.log.Error("failed to embed image", "error", err)
			return err
		}
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		dn.log.Error("Failed to send notification to Discord", "error", err)
		return err
	}

	return nil
}

func (dn *DiscordNotifier) embedImage(cmd *models.SendWebhookSync, imagePath string, existingJSONBody []byte) error {
	f, err := os.Open(imagePath)
	if err != nil {
		if os.IsNotExist(err) {
			cmd.Body = string(existingJSONBody)
			return nil
		}
		if !os.IsNotExist(err) {
			return err
		}
	}

	defer f.Close()

	var b bytes.Buffer
	w := multipart.NewWriter(&b)

	fw, err := w.CreateFormField("payload_json")
	if err != nil {
		return err
	}

	if _, err = fw.Write([]byte(string(existingJSONBody))); err != nil {
		return err
	}

	fw, err = w.CreateFormFile("file", "graph.png")
	if err != nil {
		return err
	}

	if _, err = io.Copy(fw, f); err != nil {
		return err
	}

	w.Close()

	cmd.Body = b.String()
	cmd.ContentType = w.FormDataContentType()

	return nil
}
