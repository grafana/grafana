package notifiers

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"io/ioutil"
	"os"
)

// WeComRobotNotifier is responsible for sending alert notification to WeCom group robot
type WeComRobotNotifier struct {
	NotifierBase
	Webhook string
	log     log.Logger
}

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "wecom robot",
		Name:        "WeCom Robot",
		Description: "Sends notifications using WeCom group robot",
		Factory:     newWeComRobotNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Webhook",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "Your WeCom Group Robot Webhook URL",
				PropertyName: "webhook",
				Required:     true,
			},
		},
	})
}

func newWeComRobotNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	webhook := model.Settings.Get("webhook").MustString()
	if webhook == "" {
		return nil, alerting.ValidationError{Reason: "Could not find webhook in settings"}
	}
	return &WeComRobotNotifier{
		NotifierBase: NewNotifierBase(model),
		Webhook:      model.Settings.Get("webhook").MustString(),
		log:          log.New("alerting.notifier.wecom_robot"),
	}, nil
}

// Notify sends the alert notification to WeCom group robot
func (w *WeComRobotNotifier) Notify(evalContext *alerting.EvalContext) error {
	w.log.Info("Sending WeCom Group Robot")

	content := fmt.Sprintf("# %v\n\n%s**%v**%s\n\n",
		evalContext.GetNotificationTitle(),
		"<font color=\"warning\">",
		evalContext.Rule.Message,
		"</font>",
	)

	if w.NeedsImage() && evalContext.ImagePublicURL != "" {
		content += fmt.Sprintf("[%s](%s)\n", evalContext.ImagePublicURL, evalContext.ImagePublicURL)
	}

	for index, match := range evalContext.EvalMatches {
		if index == 0 {
			content += "**Metric:**\n"
		}

		if index > 4 {
			content += ">  ...\n"
			break
		}

		content += fmt.Sprintf("> `%s=%s`\n> \n", match.Metric, match.Value)
	}

	body := map[string]interface{}{
		"msgtype": "markdown",
		"markdown": map[string]string{
			"content": content,
		},
	}

	bodyJSON, err := json.Marshal(body)
	if err != nil {
		w.log.Error("Failed to marshal body", "error", err)
		return err
	}

	//fmt.Println(body)

	//fmt.Println(string(bodyJSON))

	msgCmd := &models.SendWebhookSync{
		Url:  w.Webhook,
		Body: string(bodyJSON),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, msgCmd); err != nil {
		w.log.Error("Failed to send WeCom", "error", err)
		return err
	}

	// Push local image to wecom group
	if w.NeedsImage() && evalContext.ImagePublicURL == "" {
		var filePath string

		if _, err := os.Stat(evalContext.ImageOnDiskPath); err != nil {
			return nil
		}

		filePath = evalContext.ImageOnDiskPath

		//fmt.Println(evalContext.ImageOnDiskPath)
		imgFile, err := os.Open(filePath)
		defer imgFile.Close()
		if err != nil {
			return err
		}

		f, _ := ioutil.ReadAll(imgFile)

		imgBase64Str := base64.StdEncoding.EncodeToString(f)
		md5Str := fmt.Sprintf("%x", md5.Sum(f))

		imgBody := map[string]interface{}{
			"msgtype": "image",
			"image": map[string]string{
				"base64": imgBase64Str,
				"md5":	md5Str,
			},
		}

		imgBodyJSON, err := json.Marshal(imgBody)
		if err != nil {
			w.log.Error("Failed to marshal body", "error", err)
			return err
		}

		//fmt.Println(imgBody)

		//fmt.Println(string(imgBodyJSON))

		imgCmd := &models.SendWebhookSync{
			Url:  w.Webhook,
			Body: string(imgBodyJSON),
		}

		if err := bus.DispatchCtx(evalContext.Ctx, imgCmd); err != nil {
			fmt.Println("image error", err)
			w.log.Error("Failed to send WeCom", "error", err)
			return err
		}
	}

	return nil
}
