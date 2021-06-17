package channels

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

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
	log  log.Logger
	tmpl *template.Template

	URL            *url.URL
	Username       string
	IconEmoji      string
	IconURL        string
	Recipient      string
	Text           string
	Title          string
	MentionUsers   []string
	MentionGroups  []string
	MentionChannel string
	Token          string
}

var reRecipient *regexp.Regexp = regexp.MustCompile("^((@[a-z0-9][a-zA-Z0-9._-]*)|(#[^ .A-Z]{1,79})|([a-zA-Z0-9]+))$")

var SlackAPIEndpoint = "https://slack.com/api/chat.postMessage"

// NewSlackNotifier is the constructor for the Slack notifier
func NewSlackNotifier(model *NotificationChannelConfig, t *template.Template) (*SlackNotifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	slackURL := model.DecryptedValue("url", model.Settings.Get("url").MustString())
	if slackURL == "" {
		slackURL = SlackAPIEndpoint
	}
	apiURL, err := url.Parse(slackURL)
	if err != nil {
		return nil, alerting.ValidationError{Reason: fmt.Sprintf("invalid URL %q: %s", slackURL, err)}
	}

	recipient := strings.TrimSpace(model.Settings.Get("recipient").MustString())
	if recipient != "" {
		if !reRecipient.MatchString(recipient) {
			return nil, alerting.ValidationError{Reason: fmt.Sprintf("recipient on invalid format: %q", recipient)}
		}
	} else if apiURL.String() == SlackAPIEndpoint {
		return nil, alerting.ValidationError{
			Reason: "recipient must be specified when using the Slack chat API",
		}
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

	token := model.DecryptedValue("token", model.Settings.Get("token").MustString())
	if token == "" && apiURL.String() == SlackAPIEndpoint {
		return nil, alerting.ValidationError{
			Reason: "token must be specified when using the Slack chat API",
		}
	}

	return &SlackNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		URL:            apiURL,
		Recipient:      recipient,
		MentionUsers:   mentionUsers,
		MentionGroups:  mentionGroups,
		MentionChannel: mentionChannel,
		Username:       model.Settings.Get("username").MustString("Grafana"),
		IconEmoji:      model.Settings.Get("icon_emoji").MustString(),
		IconURL:        model.Settings.Get("icon_url").MustString(),
		Token:          token,
		Text:           model.Settings.Get("text").MustString(`{{ template "default.message" . }}`),
		Title:          model.Settings.Get("title").MustString(`{{ template "default.title" . }}`),
		log:            log.New("alerting.notifier.slack"),
		tmpl:           t,
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

// Notify sends an alert notification to Slack.
func (sn *SlackNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	msg, err := sn.buildSlackMessage(ctx, as)
	if err != nil {
		return false, fmt.Errorf("build slack message: %w", err)
	}

	b, err := json.Marshal(msg)
	if err != nil {
		return false, fmt.Errorf("marshal json: %w", err)
	}

	sn.log.Debug("Sending Slack API request", "url", sn.URL.String(), "data", string(b))
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, sn.URL.String(), bytes.NewReader(b))
	if err != nil {
		return false, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "Grafana")
	if sn.Token == "" {
		if sn.URL.String() == SlackAPIEndpoint {
			panic("Token should be set when using the Slack chat API")
		}
	} else {
		sn.log.Debug("Adding authorization header to HTTP request")
		request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", sn.Token))
	}

	if err := sendSlackRequest(request, sn.log); err != nil {
		return false, err
	}
	return true, nil
}

// sendSlackRequest sends a request to the Slack API.
// Stubbable by tests.
var sendSlackRequest = func(request *http.Request, logger log.Logger) error {
	netTransport := &http.Transport{
		TLSClientConfig: &tls.Config{
			Renegotiation: tls.RenegotiateFreelyAsClient,
		},
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout: 5 * time.Second,
	}
	netClient := &http.Client{
		Timeout:   time.Second * 30,
		Transport: netTransport,
	}
	resp, err := netClient.Do(request)
	if err != nil {
		return err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode/100 != 2 {
		logger.Warn("Slack API request failed", "url", request.URL.String(), "statusCode", resp.Status, "body", string(body))
		return fmt.Errorf("request to Slack API failed with status code %d", resp.StatusCode)
	}

	var rslt map[string]interface{}
	// Slack responds to some requests with a JSON document, that might contain an error
	if err := json.Unmarshal(body, &rslt); err == nil {
		if !rslt["ok"].(bool) {
			errMsg := rslt["error"].(string)
			logger.Warn("Sending Slack API request failed", "url", request.URL.String(), "statusCode", resp.Status,
				"err", errMsg)
			return fmt.Errorf("failed to make Slack API request: %s", errMsg)
		}
	}

	logger.Debug("Sending Slack API request succeeded", "url", request.URL.String(), "statusCode", resp.Status)
	return nil
}

func (sn *SlackNotifier) buildSlackMessage(ctx context.Context, as []*types.Alert) (*slackMessage, error) {
	alerts := types.Alerts(as...)
	var tmplErr error
	tmpl, _ := TmplText(ctx, sn.tmpl, as, sn.log, &tmplErr)

	ruleURL := joinUrlPath(sn.tmpl.ExternalURL.String(), "/alerting/list", sn.log)

	req := &slackMessage{
		Channel:   tmpl(sn.Recipient),
		Username:  tmpl(sn.Username),
		IconEmoji: tmpl(sn.IconEmoji),
		IconURL:   tmpl(sn.IconURL),
		Attachments: []attachment{
			{
				Color:      getAlertStatusColor(alerts.Status()),
				Title:      tmpl(sn.Title),
				Fallback:   tmpl(sn.Title),
				Footer:     "Grafana v" + setting.BuildVersion,
				FooterIcon: FooterIconURL,
				Ts:         time.Now().Unix(),
				TitleLink:  ruleURL,
				Text:       tmpl(sn.Text),
				Fields:     nil, // TODO. Should be a config.
			},
		},
	}
	if tmplErr != nil {
		sn.log.Debug("failed to template Slack message", "err", tmplErr.Error())
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

	return req, nil
}

func (sn *SlackNotifier) SendResolved() bool {
	return !sn.GetDisableResolveMessage()
}
