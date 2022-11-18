package channels

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

var SlackAPIEndpoint = "https://slack.com/api/chat.postMessage"

// SlackNotifier is responsible for sending
// alert notification to Slack.
type SlackNotifier struct {
	*Base
	log           log.Logger
	tmpl          *template.Template
	images        ImageStore
	webhookSender notifications.WebhookSender
	settings      slackSettings
}

type slackSettings struct {
	EndpointURL    string                `json:"endpointUrl,omitempty" yaml:"endpointUrl,omitempty"`
	URL            string                `json:"url,omitempty" yaml:"url,omitempty"`
	Token          string                `json:"token,omitempty" yaml:"token,omitempty"`
	Recipient      string                `json:"recipient,omitempty" yaml:"recipient,omitempty"`
	Text           string                `json:"text,omitempty" yaml:"text,omitempty"`
	Title          string                `json:"title,omitempty" yaml:"title,omitempty"`
	Username       string                `json:"username,omitempty" yaml:"username,omitempty"`
	IconEmoji      string                `json:"icon_emoji,omitempty" yaml:"icon_emoji,omitempty"`
	IconURL        string                `json:"icon_url,omitempty" yaml:"icon_url,omitempty"`
	MentionChannel string                `json:"mentionChannel,omitempty" yaml:"mentionChannel,omitempty"`
	MentionUsers   CommaSeparatedStrings `json:"mentionUsers,omitempty" yaml:"mentionUsers,omitempty"`
	MentionGroups  CommaSeparatedStrings `json:"mentionGroups,omitempty" yaml:"mentionGroups,omitempty"`
}

// SlackFactory creates a new NotificationChannel that sends notifications to Slack.
func SlackFactory(fc FactoryConfig) (NotificationChannel, error) {
	ch, err := buildSlackNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return ch, nil
}

func buildSlackNotifier(factoryConfig FactoryConfig) (*SlackNotifier, error) {
	decryptFunc := factoryConfig.DecryptFunc
	var settings slackSettings
	err := factoryConfig.Config.unmarshalSettings(&settings)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	if settings.EndpointURL == "" {
		settings.EndpointURL = SlackAPIEndpoint
	}
	slackURL := decryptFunc(context.Background(), factoryConfig.Config.SecureSettings, "url", settings.URL)
	if slackURL == "" {
		slackURL = settings.EndpointURL
	}
	apiURL, err := url.Parse(slackURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL %q", slackURL)
	}
	settings.URL = apiURL.String()

	settings.Recipient = strings.TrimSpace(settings.Recipient)
	if settings.Recipient == "" && settings.URL == SlackAPIEndpoint {
		return nil, errors.New("recipient must be specified when using the Slack chat API")
	}
	if settings.MentionChannel != "" && settings.MentionChannel != "here" && settings.MentionChannel != "channel" {
		return nil, fmt.Errorf("invalid value for mentionChannel: %q", settings.MentionChannel)
	}
	settings.Token = decryptFunc(context.Background(), factoryConfig.Config.SecureSettings, "token", settings.Token)
	if settings.Token == "" && settings.URL == SlackAPIEndpoint {
		return nil, errors.New("token must be specified when using the Slack chat API")
	}
	if settings.Username == "" {
		settings.Username = "Grafana"
	}
	if settings.Text == "" {
		settings.Text = DefaultMessageEmbed
	}
	if settings.Title == "" {
		settings.Title = DefaultMessageTitleEmbed
	}

	return &SlackNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   factoryConfig.Config.UID,
			Name:                  factoryConfig.Config.Name,
			Type:                  factoryConfig.Config.Type,
			DisableResolveMessage: factoryConfig.Config.DisableResolveMessage,
			Settings:              factoryConfig.Config.Settings,
		}),
		settings: settings,

		images:        factoryConfig.ImageStore,
		webhookSender: factoryConfig.NotificationService,
		log:           log.New("alerting.notifier.slack"),
		tmpl:          factoryConfig.Template,
	}, nil
}

// slackMessage is the slackMessage for sending a slack notification.
type slackMessage struct {
	Channel     string                   `json:"channel,omitempty"`
	Text        string                   `json:"text,omitempty"`
	Username    string                   `json:"username,omitempty"`
	IconEmoji   string                   `json:"icon_emoji,omitempty"`
	IconURL     string                   `json:"icon_url,omitempty"`
	Attachments []attachment             `json:"attachments"`
	Blocks      []map[string]interface{} `json:"blocks,omitempty"`
}

// attachment is used to display a richly-formatted message block.
type attachment struct {
	Title      string              `json:"title,omitempty"`
	TitleLink  string              `json:"title_link,omitempty"`
	Text       string              `json:"text"`
	ImageURL   string              `json:"image_url,omitempty"`
	Fallback   string              `json:"fallback"`
	Fields     []config.SlackField `json:"fields,omitempty"`
	Footer     string              `json:"footer"`
	FooterIcon string              `json:"footer_icon"`
	Color      string              `json:"color,omitempty"`
	Ts         int64               `json:"ts,omitempty"`
	Pretext    string              `json:"pretext,omitempty"`
	MrkdwnIn   []string            `json:"mrkdwn_in,omitempty"`
}

// Notify sends an alert notification to Slack.
func (sn *SlackNotifier) Notify(ctx context.Context, alerts ...*types.Alert) (bool, error) {
	sn.log.Debug("building slack message", "alerts", len(alerts))
	msg, err := sn.buildSlackMessage(ctx, alerts)
	if err != nil {
		return false, fmt.Errorf("build slack message: %w", err)
	}

	b, err := json.Marshal(msg)
	if err != nil {
		return false, fmt.Errorf("marshal json: %w", err)
	}

	sn.log.Debug("sending Slack API request", "url", sn.settings.URL, "data", string(b))
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, sn.settings.URL, bytes.NewReader(b))
	if err != nil {
		return false, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "Grafana")
	if sn.settings.Token == "" {
		if sn.settings.URL == SlackAPIEndpoint {
			panic("Token should be set when using the Slack chat API")
		}
	} else {
		sn.log.Debug("adding authorization header to HTTP request")
		request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", sn.settings.Token))
	}

	if err := sendSlackRequest(request, sn.log); err != nil {
		return false, err
	}

	return true, nil
}

// sendSlackRequest sends a request to the Slack API.
// Stubbable by tests.
var sendSlackRequest = func(request *http.Request, logger log.Logger) (retErr error) {
	defer func() {
		if retErr != nil {
			logger.Warn("failed to send slack request", "error", retErr)
		}
	}()

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
			logger.Warn("failed to close response body", "error", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		logger.Error("Slack API request failed", "url", request.URL.String(), "statusCode", resp.Status, "body", string(body))
		return fmt.Errorf("request to Slack API failed with status code %d", resp.StatusCode)
	}

	// Slack responds to some requests with a JSON document, that might contain an error.
	rslt := struct {
		Ok  bool   `json:"ok"`
		Err string `json:"error"`
	}{}

	// Marshaling can fail if Slack's response body is plain text (e.g. "ok").
	if err := json.Unmarshal(body, &rslt); err != nil && json.Valid(body) {
		logger.Error("Failed to unmarshal Slack API response", "url", request.URL.String(), "statusCode", resp.Status,
			"body", string(body))
		return fmt.Errorf("failed to unmarshal Slack API response: %s", err)
	}

	if !rslt.Ok && rslt.Err != "" {
		logger.Error("Sending Slack API request failed", "url", request.URL.String(), "statusCode", resp.Status,
			"error", rslt.Err)
		return fmt.Errorf("failed to make Slack API request: %s", rslt.Err)
	}

	logger.Debug("sending Slack API request succeeded", "url", request.URL.String(), "statusCode", resp.Status)
	return nil
}

func (sn *SlackNotifier) buildSlackMessage(ctx context.Context, alrts []*types.Alert) (*slackMessage, error) {
	alerts := types.Alerts(alrts...)
	var tmplErr error
	tmpl, _ := TmplText(ctx, sn.tmpl, alrts, sn.log, &tmplErr)

	ruleURL := joinUrlPath(sn.tmpl.ExternalURL.String(), "/alerting/list", sn.log)

	req := &slackMessage{
		Channel:   tmpl(sn.settings.Recipient),
		Username:  tmpl(sn.settings.Username),
		IconEmoji: tmpl(sn.settings.IconEmoji),
		IconURL:   tmpl(sn.settings.IconURL),
		// TODO: We should use the Block Kit API instead:
		// https://api.slack.com/messaging/composing/layouts#when-to-use-attachments
		Attachments: []attachment{
			{
				Color:      getAlertStatusColor(alerts.Status()),
				Title:      tmpl(sn.settings.Title),
				Fallback:   tmpl(sn.settings.Title),
				Footer:     "Grafana v" + setting.BuildVersion,
				FooterIcon: FooterIconURL,
				Ts:         time.Now().Unix(),
				TitleLink:  ruleURL,
				Text:       tmpl(sn.settings.Text),
				Fields:     nil, // TODO. Should be a config.
			},
		},
	}

	_ = withStoredImages(ctx, sn.log, sn.images, func(index int, image ngmodels.Image) error {
		req.Attachments[0].ImageURL = image.URL
		return ErrImagesDone
	}, alrts...)

	if tmplErr != nil {
		sn.log.Warn("failed to template Slack message", "error", tmplErr.Error())
	}

	mentionsBuilder := strings.Builder{}
	appendSpace := func() {
		if mentionsBuilder.Len() > 0 {
			mentionsBuilder.WriteString(" ")
		}
	}
	mentionChannel := strings.TrimSpace(sn.settings.MentionChannel)
	if mentionChannel != "" {
		mentionsBuilder.WriteString(fmt.Sprintf("<!%s|%s>", mentionChannel, mentionChannel))
	}
	if len(sn.settings.MentionGroups) > 0 {
		appendSpace()
		for _, g := range sn.settings.MentionGroups {
			mentionsBuilder.WriteString(fmt.Sprintf("<!subteam^%s>", tmpl(g)))
		}
	}
	if len(sn.settings.MentionUsers) > 0 {
		appendSpace()
		for _, u := range sn.settings.MentionUsers {
			mentionsBuilder.WriteString(fmt.Sprintf("<@%s>", tmpl(u)))
		}
	}

	if mentionsBuilder.Len() > 0 {
		// Use markdown-formatted pretext for any mentions.
		req.Attachments[0].MrkdwnIn = []string{"pretext"}
		req.Attachments[0].Pretext = mentionsBuilder.String()
	}

	return req, nil
}

func (sn *SlackNotifier) SendResolved() bool {
	return !sn.GetDisableResolveMessage()
}
