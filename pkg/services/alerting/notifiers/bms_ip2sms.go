package notifiers

import (
	"encoding/base64"
	"mime/multipart"
	"encoding/xml"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

var (
	bmsApiUrl = "https://api.lifecell.com.ua/bms2-ip2sms/"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "SMS",
		Name:        "Ukraine lifecell BMS",
		Description: "Sends notifications to SMS channel",
		Factory:     NewBMSNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">BMS API settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-9">Alphaname</span>
        <input type="text" required
					class="gf-form-input"
					ng-model="ctrl.model.settings.alphaname"
					placeholder="Alphaname"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-9">Username</span>
        <input type="text" required
					class="gf-form-input"
					ng-model="ctrl.model.settings.username"
					data-placement="right"
					placeholder="Username">
        </input>
        <info-popover mode="right-absolute">
					Username
        </info-popover>
      </div>

      <div class="gf-form">
        <span class="gf-form-label width-9">Password</span>
        <input type="password" required
					class="gf-form-input"
					ng-model="ctrl.model.settings.password"
					data-placement="right"
					placeholder="Password">
        </input>
        <info-popover mode="right-absolute">
					Password
        </info-popover>
      </div>

      <div class="gf-form">
        <span class="gf-form-label width-9">Msisdn</span>
	<input type="tel" required
					class="gf-form-input"
					ng-model="ctrl.model.settings.msisdn"
					data-placement="right">
					placeholder="380XXXXXXX">
        </input>
        <info-popover mode="right-absolute">
					Msisdn
        </info-popover>
      </div>



    `,
	})

}

type BMSNotifier struct {
	NotifierBase
	Alphaname string
	Username  string
	Password  string
	Msisdn    string
	log       log.Logger
}

type message struct {
	Service service `xml:"service"`
	To      to      `xml:"to"`
	Body    body    `xml:"body"`
}

type service struct {
	Property  string `xml:"id,attr"`
	Property2 string `xml:"source,attr"`
	Property3 string `xml:"validity,attr"`
	Property4 string `xml:"type,attr"`
}

type to struct {
	Msisdn string `xml:",chardata"`
}

type body struct {
	Content_type string `xml:"content-type,attr"`
	Encoding     string `xml:"encoding,attr"`
	Data         string `xml:",chardata"`
}

func NewBMSNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	alphaname := model.Settings.Get("alphaname").MustString()
	username := model.Settings.Get("username").MustString()
	password := model.Settings.Get("password").MustString()
	msisdn := model.Settings.Get("msisdn").MustString()

	if alphaname == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Alphaname in settings"}
	}

	if username == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Username in settings"}
	}

	if password == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Password in settings"}
	}

	if msisdn == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Msisdn in settings"}
	}

	return &BMSNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Alphaname:    alphaname,
		Username:     username,
		Password:     password,
		Msisdn:       msisdn,
		log:          log.New("alerting.notifier.bms-ip2sms"),
	}, nil
}

func (this *BMSNotifier) buildMessage(evalContext *alerting.EvalContext) *m.SendWebhookSync {
	message := fmt.Sprintf("%s\nState: %s\nMessage: %s\n", evalContext.GetNotificationTitle(), evalContext.Rule.Name, evalContext.Rule.Message)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err == nil {
		message = message + fmt.Sprintf("URL: %s\n", ruleUrl)
	}

	metrics := generateMetricsMessageBMS(evalContext)
	if metrics != "" {
		message = message + fmt.Sprintf("\nMetrics:%s", metrics)
	}

	cmd := this.generateBMSCmd(message, "text", "sendMessage", func(w *multipart.Writer) {
		fw, _ := w.CreateFormField("parse_mode")
		fw.Write([]byte("html"))
	})
	return cmd
}

func (this *BMSNotifier) generateBMSCmd(message_txt string, messageField string, apiAction string, extraConf func(writer *multipart.Writer)) *m.SendWebhookSync {

	service_1 := service{"single", this.Alphaname, "+5 min", "SMS"}
	to_1 := to{this.Msisdn}
	body_1 := body{"text/plain", "plain", message_txt}
	mes := message{service_1, to_1, body_1}

	b, err := xml.Marshal(mes)
	if err != nil {
		panic(err)
	}

	body_sms := string(b)

	this.log.Info("Sending bms-ip2sms notification", "Alphaname", this.Alphaname, "username", this.Username, "Msisdn", this.Msisdn)

	auth := this.Username + ":" + this.Password
	auth_header := base64.StdEncoding.EncodeToString([]byte(auth))
	url := bmsApiUrl

	cmd := &m.SendWebhookSync{
		Url:        url,
		Body:       body_sms,
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "text/xml",
			"Authorization": "Basic " + auth_header,
		},
	}
	return cmd
}

func generateMetricsMessageBMS(evalContext *alerting.EvalContext) string {
	metrics := ""
	fieldLimitCount := 4
	for index, evt := range evalContext.EvalMatches {
		metrics += fmt.Sprintf("\n%s: %s", evt.Metric, evt.Value)
		if index > fieldLimitCount {
			break
		}
	}
	return metrics
}

func (this *BMSNotifier) Notify(evalContext *alerting.EvalContext) error {
	var cmd *m.SendWebhookSync
	cmd = this.buildMessage(evalContext)

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send webhook", "error", err, "webhook", this.Name)
		return err
	}

	return nil
}
