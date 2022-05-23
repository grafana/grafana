package channels

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

var SlackAPIEndpoint = "https://slack.com/api/chat.postMessage"
var SlackImageAPIEndpoint = "https://slack.com/api/files.upload"

// SlackNotifier is responsible for sending
// alert notification to Slack.
type SlackNotifier struct {
	*Base
	log           log.Logger
	tmpl          *template.Template
	images        ImageStore
	webhookSender notifications.WebhookSender

	URL            *url.URL
	ImageUploadURL string
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

type SlackConfig struct {
	*NotificationChannelConfig
	URL            *url.URL
	ImageUploadURL string
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

func SlackFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewSlackConfig(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewSlackNotifier(cfg, fc.ImageStore, fc.NotificationService, fc.Template), nil
}

func NewSlackConfig(factoryConfig FactoryConfig) (*SlackConfig, error) {
	channelConfig := factoryConfig.Config
	decryptFunc := factoryConfig.DecryptFunc
	endpointURL := channelConfig.Settings.Get("endpointUrl").MustString(SlackAPIEndpoint)
	imageUploadURL := channelConfig.Settings.Get("imageUploadUrl").MustString(SlackImageAPIEndpoint)
	slackURL := decryptFunc(context.Background(), channelConfig.SecureSettings, "url", channelConfig.Settings.Get("url").MustString())
	if slackURL == "" {
		slackURL = endpointURL
	}
	apiURL, err := url.Parse(slackURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL %q", slackURL)
	}
	recipient := strings.TrimSpace(channelConfig.Settings.Get("recipient").MustString())
	if recipient == "" && apiURL.String() == SlackAPIEndpoint {
		return nil, errors.New("recipient must be specified when using the Slack chat API")
	}
	mentionChannel := channelConfig.Settings.Get("mentionChannel").MustString()
	if mentionChannel != "" && mentionChannel != "here" && mentionChannel != "channel" {
		return nil, fmt.Errorf("invalid value for mentionChannel: %q", mentionChannel)
	}
	token := decryptFunc(context.Background(), channelConfig.SecureSettings, "token", channelConfig.Settings.Get("token").MustString())
	if token == "" && apiURL.String() == SlackAPIEndpoint {
		return nil, errors.New("token must be specified when using the Slack chat API")
	}
	mentionUsersStr := channelConfig.Settings.Get("mentionUsers").MustString()
	mentionUsers := []string{}
	for _, u := range strings.Split(mentionUsersStr, ",") {
		u = strings.TrimSpace(u)
		if u != "" {
			mentionUsers = append(mentionUsers, u)
		}
	}
	mentionGroupsStr := channelConfig.Settings.Get("mentionGroups").MustString()
	mentionGroups := []string{}
	for _, g := range strings.Split(mentionGroupsStr, ",") {
		g = strings.TrimSpace(g)
		if g != "" {
			mentionGroups = append(mentionGroups, g)
		}
	}
	return &SlackConfig{
		NotificationChannelConfig: channelConfig,
		Recipient:                 strings.TrimSpace(channelConfig.Settings.Get("recipient").MustString()),
		MentionChannel:            channelConfig.Settings.Get("mentionChannel").MustString(),
		MentionUsers:              mentionUsers,
		MentionGroups:             mentionGroups,
		URL:                       apiURL,
		ImageUploadURL:            imageUploadURL,
		Username:                  channelConfig.Settings.Get("username").MustString("Grafana"),
		IconEmoji:                 channelConfig.Settings.Get("icon_emoji").MustString(),
		IconURL:                   channelConfig.Settings.Get("icon_url").MustString(),
		Token:                     token,
		Text:                      channelConfig.Settings.Get("text").MustString(`{{ template "default.message" . }}`),
		Title:                     channelConfig.Settings.Get("title").MustString(DefaultMessageTitleEmbed),
	}, nil
}

// NewSlackNotifier is the constructor for the Slack notifier
func NewSlackNotifier(config *SlackConfig,
	images ImageStore,
	webhookSender notifications.WebhookSender,
	t *template.Template,
) *SlackNotifier {
	return &SlackNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		URL:            config.URL,
		ImageUploadURL: config.ImageUploadURL,
		Recipient:      config.Recipient,
		MentionUsers:   config.MentionUsers,
		MentionGroups:  config.MentionGroups,
		MentionChannel: config.MentionChannel,
		Username:       config.Username,
		IconEmoji:      config.IconEmoji,
		IconURL:        config.IconURL,
		Token:          config.Token,
		Text:           config.Text,
		Title:          config.Title,
		images:         images,
		webhookSender:  webhookSender,
		log:            log.New("alerting.notifier.slack"),
		tmpl:           t,
	}
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
	ImageURL   string              `json:"image_url,omitempty"`
	Fallback   string              `json:"fallback"`
	Fields     []config.SlackField `json:"fields,omitempty"`
	Footer     string              `json:"footer"`
	FooterIcon string              `json:"footer_icon"`
	Color      string              `json:"color,omitempty"`
	Ts         int64               `json:"ts,omitempty"`
}

// Notify sends an alert notification to Slack.
func (sn *SlackNotifier) Notify(ctx context.Context, alerts ...*types.Alert) (bool, error) {
	msg, err := sn.buildSlackMessage(ctx, alerts)
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

	// Try to upload if we have an image path but no image URL. This uploads the file
	// immediately after the message. A bit of a hack, but it doesn't require the
	// user to have an image host set up.
	// TODO: how many image files should we upload? In what order? Should we
	// assume the alerts array is already sorted?
	// TODO: We need a refactoring so we don't do two database reads for the same data.
	// TODO: Should we process all alerts' annotations? We can only have on image.
	// TODO: Should we guard out-of-bounds errors here? Callers should prevent that from happening, imo
	imgToken := getTokenFromAnnotations(alerts[0].Annotations)
	dbContext, cancel := context.WithTimeout(ctx, ImageStoreTimeout)
	imgData, err := sn.images.GetData(dbContext, imgToken)
	cancel()
	if err != nil {
		if !errors.Is(err, ErrImagesUnavailable) {
			// Ignore errors. Don't log "ImageUnavailable", which means the storage doesn't exist.
			sn.log.Warn("Error reading screenshot data from ImageStore: %v", err)
		}
		return true, nil
	}

	defer func() {
		// Nothing for us to do.
		_ = imgData.Close()
	}()

	err = sn.slackFileUpload(ctx, imgData, sn.Recipient, sn.Token)
	if err != nil {
		sn.log.Warn("Error reading screenshot data from ImageStore: %v", err)
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
			"err", rslt.Err)
		return fmt.Errorf("failed to make Slack API request: %s", rslt.Err)
	}

	logger.Debug("Sending Slack API request succeeded", "url", request.URL.String(), "statusCode", resp.Status)
	return nil
}

func (sn *SlackNotifier) buildSlackMessage(ctx context.Context, as []*types.Alert) (*slackMessage, error) {
	alerts := types.Alerts(as...)
	var tmplErr error
	tmpl, _ := TmplText(ctx, sn.tmpl, as, sn.log, &tmplErr)

	ruleURL := joinUrlPath(sn.tmpl.ExternalURL.String(), "/alerting/list", sn.log)

	// TODO: Should we process all alerts' annotations? We can only have on image.
	// TODO: Should we guard out-of-bounds errors here? Callers should prevent that from happening, imo
	imgToken := getTokenFromAnnotations(as[0].Annotations)
	timeoutCtx, cancel := context.WithTimeout(ctx, ImageStoreTimeout)
	imgURL, err := sn.images.GetURL(timeoutCtx, imgToken)
	cancel()
	if err != nil {
		if !errors.Is(err, ErrImagesUnavailable) {
			// Ignore errors. Don't log "ImageUnavailable", which means the storage doesn't exist.
			sn.log.Warn("failed to retrieve image url from store", "error", err)
		}
	}

	req := &slackMessage{
		Channel:   tmpl(sn.Recipient),
		Username:  tmpl(sn.Username),
		IconEmoji: tmpl(sn.IconEmoji),
		IconURL:   tmpl(sn.IconURL),
		// TODO: We should use the Block Kit API instead:
		// https://api.slack.com/messaging/composing/layouts#when-to-use-attachments
		Attachments: []attachment{
			{
				Color:      getAlertStatusColor(alerts.Status()),
				Title:      tmpl(sn.Title),
				Fallback:   tmpl(sn.Title),
				Footer:     "Grafana v" + setting.BuildVersion,
				FooterIcon: FooterIconURL,
				ImageURL:   imgURL,
				Ts:         time.Now().Unix(),
				TitleLink:  ruleURL,
				Text:       tmpl(sn.Text),
				Fields:     nil, // TODO. Should be a config.
			},
		},
	}
	if tmplErr != nil {
		sn.log.Warn("failed to template Slack message", "err", tmplErr.Error())
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
			mentionsBuilder.WriteString(fmt.Sprintf("<!subteam^%s>", tmpl(g)))
		}
	}
	if len(sn.MentionUsers) > 0 {
		appendSpace()
		for _, u := range sn.MentionUsers {
			mentionsBuilder.WriteString(fmt.Sprintf("<@%s>", tmpl(u)))
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

func (sn *SlackNotifier) slackFileUpload(ctx context.Context, data io.Reader, recipient, token string) error {
	sn.log.Info("Uploading to slack via file.upload API")
	headers, uploadBody, err := sn.generateFileUploadBody(data, token, recipient)
	if err != nil {
		return err
	}
	cmd := &models.SendWebhookSync{
		Url: sn.ImageUploadURL, Body: uploadBody.String(), HttpHeader: headers, HttpMethod: "POST",
	}
	if err := sn.webhookSender.SendWebhookSync(ctx, cmd); err != nil {
		sn.log.Error("Failed to upload slack image", "error", err, "webhook", "file.upload")
		return err
	}
	return nil
}

func (sn *SlackNotifier) generateFileUploadBody(data io.Reader, token string, recipient string) (map[string]string, bytes.Buffer, error) {
	// Slack requires all POSTs to files.upload to present
	// an "application/x-www-form-urlencoded" encoded querystring
	// See https://api.slack.com/methods/files.upload
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	defer func() {
		if err := w.Close(); err != nil {
			// Shouldn't matter since we already close w explicitly on the non-error path
			sn.log.Warn("Failed to close multipart writer", "err", err)
		}
	}()

	// TODO: perhaps we should pass the filename through to here to use the local name.
	// https://github.com/grafana/grafana/issues/49375
	fw, err := w.CreateFormFile("file", fmt.Sprintf("screenshot-%v", rand.Intn(2e6)))
	if err != nil {
		return nil, b, err
	}
	if _, err := io.Copy(fw, data); err != nil {
		return nil, b, err
	}
	// Add the authorization token
	if err := w.WriteField("token", token); err != nil {
		return nil, b, err
	}
	// Add the channel(s) to POST to
	if err := w.WriteField("channels", recipient); err != nil {
		return nil, b, err
	}
	if err := w.Close(); err != nil {
		return nil, b, fmt.Errorf("failed to close multipart writer: %w", err)
	}
	headers := map[string]string{
		"Content-Type":  w.FormDataContentType(),
		"Authorization": "auth_token=\"" + token + "\"",
	}
	return headers, b, nil
}
