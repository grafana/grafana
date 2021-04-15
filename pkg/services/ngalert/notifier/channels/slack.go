package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/bus"
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
	log         log.Logger
	tmpl        *template.Template
	externalUrl *url.URL

	URL            string
	Username       string
	IconEmoji      string
	IconURL        string
	Recipient      string
	Text           string
	Title          string
	Fallback       string
	MentionUsers   []string
	MentionGroups  []string
	MentionChannel string
	Token          string
}

var reRecipient *regexp.Regexp = regexp.MustCompile("^((@[a-z0-9][a-zA-Z0-9._-]*)|(#[^ .A-Z]{1,79})|([a-zA-Z0-9]+))$")

// NewSlackNotifier is the constructor for the Slack notifier
func NewSlackNotifier(model *models.AlertNotification, t *template.Template, externalUrl *url.URL) (*SlackNotifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	slackURL := model.DecryptedValue("url", model.Settings.Get("url").MustString())
	if slackURL == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	recipient := strings.TrimSpace(model.Settings.Get("recipient").MustString())
	if recipient != "" && !reRecipient.MatchString(recipient) {
		return nil, alerting.ValidationError{Reason: fmt.Sprintf("Recipient on invalid format: %q", recipient)}
	}

	mentionChannel := model.Settings.Get("mentionChannel").MustString()
	if mentionChannel != "" && mentionChannel != "here" && mentionChannel != "channel" {
		return nil, alerting.ValidationError{
			Reason: fmt.Sprintf("Invalid value for mentionChannel: %q", mentionChannel),
		}
	}

	mentionUsersStr := model.Settings.Get("mentionUsers").MustString()
	mentionUsers := []string{}
	for _, u := range strings.Split(mentionUsersStr, ",") {
		u = strings.TrimSpace(u)
		if u != "" {
			mentionUsers = append(mentionUsers, u)
		}
	}

	mentionGroupsStr := model.Settings.Get("mentionGroups").MustString()
	mentionGroups := []string{}
	for _, g := range strings.Split(mentionGroupsStr, ",") {
		g = strings.TrimSpace(g)
		if g != "" {
			mentionGroups = append(mentionGroups, g)
		}
	}

	return &SlackNotifier{
		NotifierBase:   old_notifiers.NewNotifierBase(model),
		URL:            slackURL,
		Recipient:      recipient,
		MentionUsers:   mentionUsers,
		MentionGroups:  mentionGroups,
		MentionChannel: mentionChannel,
		Username:       model.Settings.Get("username").MustString("Grafana"),
		IconEmoji:      model.Settings.Get("icon_emoji").MustString(),
		IconURL:        model.Settings.Get("icon_url").MustString(),
		Token:          model.DecryptedValue("token", model.Settings.Get("token").MustString()),
		Text:           model.Settings.Get("text").MustString(`{{ template "slack.default.text" . }}`),
		Title:          model.Settings.Get("title").MustString(`{{ template "slack.default.title" . }}`),
		Fallback:       model.Settings.Get("fallback").MustString(`{{ template "slack.default.title" . }}`),
		log:            log.New("alerting.notifier.slack"),
		tmpl:           t,
		externalUrl:    externalUrl,
	}, nil
}

// slackMessage is the slackMessage for sending a slack notification.
type slackMessage struct {
	Channel     string                   `json:"channel,omitempty"`
	Username    string                   `json:"username,omitempty"`
	IconEmoji   string                   `json:"icon_emoji,omitempty"`
	IconURL     string                   `json:"icon_url,omitempty"`
	Attachments []attachment             `json:"attachments"`
	Blocks      []map[string]interface{} `json:"blocks"`
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

func (sn *SlackNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	msg, err := sn.buildSlackMessage(ctx, as)
	if err != nil {
		return false, errors.Wrap(err, "build slack message")
	}

	b, err := json.Marshal(msg)
	if err != nil {
		return false, errors.Wrap(err, "marshal json")
	}

	cmd := &models.SendWebhookSync{
		Url:        sn.URL,
		Body:       string(b),
		HttpMethod: http.MethodPost,
	}

	if sn.Token != "" {
		sn.log.Debug("Adding authorization header to HTTP request")
		cmd.HttpHeader = map[string]string{
			"Authorization": fmt.Sprintf("Bearer %s", sn.Token),
		}
	}

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		sn.log.Error("Failed to send slack notification", "error", err, "webhook", sn.Name)
		return false, err
	}

	return true, nil
}

func (sn *SlackNotifier) buildSlackMessage(ctx context.Context, as []*types.Alert) (*slackMessage, error) {
	var tmplErr error
	data := notify.GetTemplateData(ctx, &template.Template{ExternalURL: sn.externalUrl}, as, gokit_log.NewNopLogger())
	alerts := types.Alerts(as...)
	tmpl := notify.TmplText(sn.tmpl, data, &tmplErr)

	req := &slackMessage{
		Channel:   tmpl(sn.Recipient),
		Username:  tmpl(sn.Username),
		IconEmoji: tmpl(sn.IconEmoji),
		IconURL:   tmpl(sn.IconURL),
		Attachments: []attachment{
			{
				Color:      getAlertStatusColor(alerts.Status()),
				Title:      tmpl(sn.Title),
				Fallback:   tmpl(sn.Fallback),
				Footer:     "Grafana v" + setting.BuildVersion,
				FooterIcon: FooterIconURL,
				Ts:         time.Now().Unix(),
				TitleLink:  "TODO: rule URL",
				Text:       tmpl(sn.Text),
				Fields:     nil, // TODO. Should be a config.
			},
		},
	}

	mentionsBuilder := strings.Builder{}
	appendSpace := func() {
		if mentionsBuilder.Len() > 0 {
			mentionsBuilder.WriteString(" ")
		}
	}
	mentionChannel := strings.TrimSpace(sn.MentionChannel)
	if mentionChannel != "" {
		mentionsBuilder.WriteString(fmt.Sprintf("<!%s|%s>", mentionChannel, mentionChannel))
	}
	if len(sn.MentionGroups) > 0 {
		appendSpace()
		for _, g := range sn.MentionGroups {
			mentionsBuilder.WriteString(fmt.Sprintf("<!subteam^%s>", g))
		}
	}
	if len(sn.MentionUsers) > 0 {
		appendSpace()
		for _, u := range sn.MentionUsers {
			mentionsBuilder.WriteString(fmt.Sprintf("<@%s>", u))
		}
	}

	if mentionsBuilder.Len() > 0 {
		req.Blocks = []map[string]interface{}{
			{
				"type": "section",
				"text": map[string]interface{}{
					"type": "mrkdwn",
					"text": mentionsBuilder.String(),
				},
			},
		}
	}

	if tmplErr != nil {
		tmplErr = errors.Wrap(tmplErr, "failed to template Slack message")
	}

	return req, tmplErr
}

func (sn *SlackNotifier) SendResolved() bool {
	return !sn.GetDisableResolveMessage()
}
