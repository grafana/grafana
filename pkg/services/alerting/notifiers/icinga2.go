package notifiers

import (
	"bytes"
	"encoding/json"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "icinga2",
		Name:        "Icinga2",
		Description: "Sends notifications to Icinga2 via Icinga2-API",
		Factory:     NewIcinga2Notifier,
		OptionsTemplate: `
      <h3 class="page-heading">Icinga2 settings</h3>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-7">Url</span>
		<input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.url" placeholder="Icinga2 API url"></input>
		<info-popover mode="right-absolute">
		Full URL to "process-check-result" Endpoint of your Icinga2 Instance (https://icinga2.example.com:5665/v1/actions/process-check-result)
	  </info-popover>
	  </div>
	  <div class="gf-form max-width-30">
	  <span class="gf-form-label width-7">User</span>
	  <input type="text"
		class="gf-form-input max-width-30"
		ng-model="ctrl.model.settings.user"
		data-placement="right">
	  </input>
	  <info-popover mode="right-absolute">
		User for API login
	  </info-popover>
	</div>
	<div class="gf-form max-width-30">
	<span class="gf-form-label width-7">Password</span>
	<input type="text"
	  class="gf-form-input max-width-30"
	  ng-model="ctrl.model.settings.password"
	  data-placement="right">
	</input>
	<info-popover mode="right-absolute">
	  Password for API login
	</info-popover>
  </div>
	  <div class="gf-form max-width-30">
	  <span class="gf-form-label width-7">HostName</span>
	  <input type="text"
		class="gf-form-input max-width-30"
		ng-model="ctrl.model.settings.hostName"
		data-placement="right">
	  </input>
	  <info-popover mode="right-absolute">
		Set the Hostname to which the passive service is assigned in Icinga2
	  </info-popover>
	</div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-7">ServiceName</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.serviceName"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Set the Servicename to update in Icinga2
        </info-popover>
      </div>
    `,
	})

}

func NewIcinga2Notifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	serviceName := model.Settings.Get("serviceName").MustString()
	hostName := model.Settings.Get("hostName").MustString()
	user := model.Settings.Get("user").MustString()
	password := model.Settings.Get("password").MustString()

	return &Icinga2Notifier{
		NotifierBase: NewNotifierBase(model),
		Url:          url,
		ServiceName:  serviceName,
		HostName:     hostName,
		User:         user,
		Password:     password,
		log:          log.New("alerting.notifier.icinga2"),
	}, nil
}

type Icinga2Notifier struct {
	NotifierBase
	Url         string
	ServiceName string
	HostName    string
	User        string
	Password    string
	log         log.Logger
}

func (this *Icinga2Notifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Executing icinga2 notification", "ruleId", evalContext.Rule.Id, "notification", this.Name)

	var status int

	if evalContext.GetStateModel().Text == "Alerting" {
		status = 2
	} else if evalContext.GetStateModel().Text == "OK" {
		status = 0
	} else if evalContext.GetStateModel().Text == "Pending" {
		status = 1
	} else {
		status = 3
	}

	message := evalContext.GetNotificationTitle()
	if evalContext.Rule.State != m.AlertStateOK { //don't add message when going back to alert state ok.
		message += ": " + evalContext.Rule.Message
	}

	body := map[string]interface{}{
		"pretty":        true,
		"exit_status":   status,
		"plugin_output": message,
		"check_source":  "Grafana v" + setting.BuildVersion,
	}

	data, _ := json.Marshal(&body)
	var b bytes.Buffer

	b.WriteString(this.Url)
	b.WriteString("?service=")
	b.WriteString(this.HostName)
	b.WriteString("!")
	b.WriteString(this.ServiceName)
	cmd := &m.SendWebhookSync{Url: b.String(), HttpMethod: "POST", Body: string(data), User: this.User, Password: this.Password, HttpHeader: map[string]string{"Accept": "application/json"}}
	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send icinga2 notification", "error", err, "webhook", this.Name)
		return err
	}
	return nil
}
