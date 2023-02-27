package notifiers

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/notifications"
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
				Label:        "Avatar URL",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Provide a URL to an image to use as the avatar for the bot's message",
				PropertyName: "avatar_url",
			},
			{
				Label:        "Message Content",
				Description:  "Mention a group using <@&ID> or a user using <@ID> when notifying in a channel",
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
			{
				Label:        "Use Discord's Webhook Username",
				Description:  "Use the username configured in Discord's webhook settings. Otherwise, the username will be 'Grafana'",
				Element:      alerting.ElementTypeCheckbox,
				PropertyName: "use_discord_username",
			},
		},
	})
}

func newDiscordNotifier(model *models.AlertNotification, _ alerting.GetDecryptedValueFn, ns notifications.Service) (alerting.Notifier, error) {
	avatar := model.Settings.Get("avatar_url").MustString()
	content := model.Settings.Get("content").MustString()
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find webhook url property in settings"}
	}
	useDiscordUsername := model.Settings.Get("use_discord_username").MustBool(false)

	return &DiscordNotifier{
		NotifierBase:       NewNotifierBase(model, ns),
		Content:            content,
		AvatarURL:          avatar,
		WebhookURL:         url,
		log:                log.New("alerting.notifier.discord"),
		UseDiscordUsername: useDiscordUsername,
	}, nil
}

// DiscordNotifier is responsible for sending alert
// notifications to discord.
type DiscordNotifier struct {
	NotifierBase
	Content            string
	AvatarURL          string
	WebhookURL         string
	log                log.Logger
	UseDiscordUsername bool
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
	if !dn.UseDiscordUsername {
		bodyJSON.Set("username", "Grafana")
	}

	if dn.Content != "" {
		bodyJSON.Set("content", dn.Content)
	}

	if dn.AvatarURL != "" {
		bodyJSON.Set("avatar_url", dn.AvatarURL)
	}

	fields := make([]map[string]interface{}, 0)

	for _, evt := range evalContext.EvalMatches {
		fields = append(fields, map[string]interface{}{
			// Discord uniquely does not send the alert if the metric field is empty,
			// which it can be in some cases
			"name":   notEmpty(evt.Metric),
			"value":  evt.Value.FullString(),
			"inline": true,
		})
	}

	footer := map[string]interface{}{
		"text":     "Grafana v" + setting.BuildVersion,
		"icon_url": "https://grafana.com/static/assets/img/fav32.png",
	}

	color, _ := strconv.ParseInt(strings.TrimLeft(evalContext.GetStateModel().Color, "#"), 16, 0)

	embed := simplejson.New()
	embed.Set("title", evalContext.GetNotificationTitle())
	// Discord takes integer for color
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

	cmd := &notifications.SendWebhookSync{
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

	if err := dn.NotificationService.SendWebhookSync(evalContext.Ctx, cmd); err != nil {
		dn.log.Error("Failed to send notification to Discord", "error", err)
		return err
	}

	return nil
}

func (dn *DiscordNotifier) embedImage(cmd *notifications.SendWebhookSync, imagePath string, existingJSONBody []byte) error {
	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `imagePath` comes
	// from the alert `evalContext` that generates the images.
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
	defer func() {
		if err := f.Close(); err != nil {
			dn.log.Warn("Failed to close file", "path", imagePath, "err", err)
		}
	}()

	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	defer func() {
		if err := w.Close(); err != nil {
			// Should be OK since we already close it on non-error path
			dn.log.Warn("Failed to close multipart writer", "err", err)
		}
	}()
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

	if err := w.Close(); err != nil {
		return fmt.Errorf("failed to close multipart writer: %w", err)
	}

	cmd.Body = b.String()
	cmd.ContentType = w.FormDataContentType()

	return nil
}

func notEmpty(metric string) string {
	if metric == "" {
		return "<NO_METRIC_NAME>"
	}

	return metric
}
