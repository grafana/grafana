package notifiers

import (
	"fmt"
	"net/url"

	"bytes"
	"io"
	"mime/multipart"
	"os"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "LINE",
		Name:        "LINE",
		Description: "Send notifications to LINE notify",
		Factory:     NewLINENotifier,
		OptionsTemplate: `
    <div class="gf-form-group">
      <h3 class="page-heading">LINE notify settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-14">Token</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.token" placeholder="LINE notify token key"></input>
      </div>
    </div>
`,
	})
}

const (
	lineNotifyUrl string = "https://notify-api.line.me/api/notify"
)

func NewLINENotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	token := model.Settings.Get("token").MustString()
	if token == "" {
		return nil, alerting.ValidationError{Reason: "Could not find token in settings"}
	}

	return &LineNotifier{
		NotifierBase: NewNotifierBase(model),
		Token:        token,
		log:          log.New("alerting.notifier.line"),
	}, nil
}

type LineNotifier struct {
	NotifierBase
	Token string
	log   log.Logger
}

func (this *LineNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Executing line notification", "ruleId", evalContext.Rule.Id, "notification", this.Name)

	var err error
	switch evalContext.Rule.State {
	case m.AlertStateAlerting:
		err = this.createAlert(evalContext)
	}
	return err
}

func (this *LineNotifier) createAlert(evalContext *alerting.EvalContext) error {
	this.log.Info("Creating Line notify", "ruleId", evalContext.Rule.Id, "notification", this.Name)
	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}

	message := fmt.Sprintf("%s - %s\n%s", evalContext.Rule.Name, ruleUrl, evalContext.Rule.Message)
	var body string
	headers := map[string]string{
		"Content-Type":  "application/x-www-form-urlencoded;charset=UTF-8",
		"Authorization": fmt.Sprintf("Bearer %s", this.Token),
	}

	form := url.Values{}
	form.Add("message", message)
	body = form.Encode()
	// add image url if external image uploader is set
	if evalContext.ImagePublicUrl != "" {
		form.Add("imageThumbnail", evalContext.ImagePublicUrl)
		form.Add("imageFullsize", evalContext.ImagePublicUrl)
	} else {
		// upload image to line server
		file := evalContext.ImageOnDiskPath
		var b bytes.Buffer
		w := multipart.NewWriter(&b)
		f, err := os.Open(file)
		if err != nil {
			return err
		}
		defer f.Close()
		fw, err := w.CreateFormFile("imageFile", file)
		if err != nil {
			return err
		}
		_, err = io.Copy(fw, f)
		if err != nil {
			return err
		}
		err = w.WriteField("message", message)
		if err != nil {
			return err
		}
		w.Close()
		headers["Content-Type"] = w.FormDataContentType()
		body = b.String()
	}

	cmd := &m.SendWebhookSync{
		Url:        lineNotifyUrl,
		HttpMethod: "POST",
		HttpHeader: headers,
		Body:       body,
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send notification to LINE", "error", err, "body", body)
		return err
	}

	return nil
}
