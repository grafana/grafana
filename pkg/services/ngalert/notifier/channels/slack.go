package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	"net/http"
	"regexp"
	"strings"
	"time"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/setting"
)

// SlackNotifier is responsible for sending
// alert notification to Slack.
type SlackNotifier struct {
	old_notifiers.NotifierBase
	URL            string
	Recipient      string
	Username       string
	IconEmoji      string
	IconURL        string
	MentionUsers   []string
	MentionGroups  []string
	MentionChannel string
	Token          string
	Upload         bool
	log            log.Logger
}

var reRecipient *regexp.Regexp = regexp.MustCompile("^((@[a-z0-9][a-zA-Z0-9._-]*)|(#[^ .A-Z]{1,79})|([a-zA-Z0-9]+))$")

// NewSlackNotifier is the constructor for the Slack notifier
func NewSlackNotifier(model *models.AlertNotification) (*SlackNotifier, error) {
	url := model.DecryptedValue("url", model.Settings.Get("url").MustString())
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	recipient := strings.TrimSpace(model.Settings.Get("recipient").MustString())
	if recipient != "" && !reRecipient.MatchString(recipient) {
		return nil, alerting.ValidationError{Reason: fmt.Sprintf("Recipient on invalid format: %q", recipient)}
	}
	username := model.Settings.Get("username").MustString()
	iconEmoji := model.Settings.Get("icon_emoji").MustString()
	iconURL := model.Settings.Get("icon_url").MustString()
	mentionUsersStr := model.Settings.Get("mentionUsers").MustString()
	mentionGroupsStr := model.Settings.Get("mentionGroups").MustString()
	mentionChannel := model.Settings.Get("mentionChannel").MustString()
	token := model.DecryptedValue("token", model.Settings.Get("token").MustString())

	uploadImage := model.Settings.Get("uploadImage").MustBool(true)

	if mentionChannel != "" && mentionChannel != "here" && mentionChannel != "channel" {
		return nil, alerting.ValidationError{
			Reason: fmt.Sprintf("Invalid value for mentionChannel: %q", mentionChannel),
		}
	}
	mentionUsers := []string{}
	for _, u := range strings.Split(mentionUsersStr, ",") {
		u = strings.TrimSpace(u)
		if u != "" {
			mentionUsers = append(mentionUsers, u)
		}
	}
	mentionGroups := []string{}
	for _, g := range strings.Split(mentionGroupsStr, ",") {
		g = strings.TrimSpace(g)
		if g != "" {
			mentionGroups = append(mentionGroups, g)
		}
	}

	return &SlackNotifier{
		NotifierBase:   old_notifiers.NewNotifierBase(model),
		URL:            url,
		Recipient:      recipient,
		Username:       username,
		IconEmoji:      iconEmoji,
		IconURL:        iconURL,
		MentionUsers:   mentionUsers,
		MentionGroups:  mentionGroups,
		MentionChannel: mentionChannel,
		Token:          token,
		Upload:         uploadImage,
		log:            log.New("alerting.notifier.slack"),
	}, nil
}

// request is the request for sending a slack notification.
type request struct {
	Channel     string       `json:"channel,omitempty"`
	Username    string       `json:"username,omitempty"`
	IconEmoji   string       `json:"icon_emoji,omitempty"`
	IconURL     string       `json:"icon_url,omitempty"`
	Attachments []attachment `json:"attachments"`
}

// attachment is used to display a richly-formatted message block.
type attachment struct {
	Title      string              `json:"title,omitempty"`
	TitleLink  string              `json:"title_link,omitempty"`
	Text       string              `json:"text"`
	Fallback   string              `json:"fallback"`
	Fields     []config.SlackField `json:"fields,omitempty"`
	Footer     string              `json:"footer"`
	FooterIcon string              `json:"footer_icon"`
	Color      string              `json:"color,omitempty"`
	Ts         int64               `json:"ts,omitempty"`
}

func getAlertStatusAlert(status model.AlertStatus) string {
	if status == model.AlertFiring {
		return "#D63232"
	}
	return "#36a64f"
}

func (sn *SlackNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	data := notify.GetTemplateData(ctx, &template.Template{}, as, gokit_log.NewNopLogger())
	alerts := types.Alerts(as...)

	title := getTitleFromTemplateData(data)
	att := &attachment{
		Color:      getAlertStatusAlert(alerts.Status()),
		Title:      title,
		Fallback:   title,
		Footer:     "Grafana v" + setting.BuildVersion,
		FooterIcon: "https://grafana.com/assets/img/fav32.png",
		Ts:         time.Now().Unix(),
		TitleLink:  "TODO: rule URL",
		Text:       "TODO",
		Fields:     nil, // TODO.
	}

	req := &request{
		Channel:     sn.Recipient,
		Username:    sn.Username,
		IconEmoji:   sn.IconEmoji,
		IconURL:     sn.IconURL,
		Attachments: []attachment{*att},
	}

	b, err := json.Marshal(&req)
	if err != nil {
		return false, errors.Wrap(err, "marshal json")
	}

	cmd := &models.SendWebhookSync{
		Url:        sn.URL,
		Body:       string(b),
		HttpMethod: http.MethodPost,
	}

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		sn.log.Error("Failed to send slack notification", "error", err, "webhook", sn.Name)
		return false, err
	}

	return true, nil
}

func (sn *SlackNotifier) SendResolved() bool {
	return true
}
