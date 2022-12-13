package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const webexAPIURL = "https://webexapis.com/v1/messages"

// WebexNotifier is responsible for sending alert notifications as webex messages.
type WebexNotifier struct {
	*Base
	ns       WebhookSender
	log      log.Logger
	images   ImageStore
	tmpl     *template.Template
	orgID    int64
	settings *webexSettings
}

// PLEASE do not touch these settings without taking a look at what we support as part of
// https://github.com/prometheus/alertmanager/blob/main/notify/webex/webex.go
// Currently, the Alerting team is unifying channels and (upstream) receivers - any discrepancy is detrimental to that.
type webexSettings struct {
	Message string `json:"message,omitempty" yaml:"message,omitempty"`
	RoomID  string `json:"room_id,omitempty" yaml:"room_id,omitempty"`
	APIURL  string `json:"api_url,omitempty" yaml:"api_url,omitempty"`
	Token   string `json:"bot_token" yaml:"bot_token"`
}

func buildWebexSettings(factoryConfig FactoryConfig) (*webexSettings, error) {
	settings := &webexSettings{}
	err := factoryConfig.Config.unmarshalSettings(&settings)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	if settings.APIURL == "" {
		settings.APIURL = webexAPIURL
	}

	if settings.Message == "" {
		settings.Message = DefaultMessageEmbed
	}

	settings.Token = factoryConfig.DecryptFunc(context.Background(), factoryConfig.Config.SecureSettings, "bot_token", settings.Token)

	u, err := url.Parse(settings.APIURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL %q", settings.APIURL)
	}
	settings.APIURL = u.String()

	return settings, err
}

func WebexFactory(fc FactoryConfig) (NotificationChannel, error) {
	notifier, err := buildWebexNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return notifier, nil
}

// buildWebexSettings is the constructor for the Webex notifier.
func buildWebexNotifier(factoryConfig FactoryConfig) (*WebexNotifier, error) {
	settings, err := buildWebexSettings(factoryConfig)
	if err != nil {
		return nil, err
	}

	logger := log.New("alerting.notifier.webex")

	return &WebexNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   factoryConfig.Config.UID,
			Name:                  factoryConfig.Config.Name,
			Type:                  factoryConfig.Config.Type,
			DisableResolveMessage: factoryConfig.Config.DisableResolveMessage,
			Settings:              factoryConfig.Config.Settings,
		}),
		orgID:    factoryConfig.Config.OrgID,
		log:      logger,
		ns:       factoryConfig.NotificationService,
		images:   factoryConfig.ImageStore,
		tmpl:     factoryConfig.Template,
		settings: settings,
	}, nil
}

// WebexMessage defines the JSON object to send to Webex endpoints.
type WebexMessage struct {
	RoomID  string   `json:"roomId,omitempty"`
	Message string   `json:"markdown"`
	Files   []string `json:"files,omitempty"`
}

// Notify implements the Notifier interface.
func (wn *WebexNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	var tmplErr error
	tmpl, data := TmplText(ctx, wn.tmpl, as, wn.log, &tmplErr)

	message, truncated := TruncateInBytes(tmpl(wn.settings.Message), 4096)
	if truncated {
		wn.log.Warn("Webex message too long, truncating message", "OriginalMessage", wn.settings.Message)
	}

	if tmplErr != nil {
		wn.log.Warn("Failed to template webex message", "Error", tmplErr.Error())
		tmplErr = nil
	}

	msg := &WebexMessage{
		RoomID:  wn.settings.RoomID,
		Message: message,
		Files:   []string{},
	}

	// Augment our Alert data with ImageURLs if available.
	_ = withStoredImages(ctx, wn.log, wn.images, func(index int, image ngmodels.Image) error {
		// Cisco Webex only supports a single image per request: https://developer.webex.com/docs/basics#message-attachments
		if image.HasURL() {
			data.Alerts[index].ImageURL = image.URL
			msg.Files = append(msg.Files, image.URL)
			return ErrImagesDone
		}

		return nil
	}, as...)

	body, err := json.Marshal(msg)
	if err != nil {
		return false, err
	}

	parsedURL := tmpl(wn.settings.APIURL)
	if tmplErr != nil {
		return false, tmplErr
	}

	cmd := &SendWebhookSettings{
		Url:        parsedURL,
		Body:       string(body),
		HttpMethod: http.MethodPost,
	}

	if wn.settings.Token != "" {
		headers := make(map[string]string)
		headers["Authorization"] = fmt.Sprintf("Bearer %s", wn.settings.Token)
		cmd.HttpHeader = headers
	}

	if err := wn.ns.SendWebhook(ctx, cmd); err != nil {
		return false, err
	}

	return true, nil
}

func (wn *WebexNotifier) SendResolved() bool {
	return !wn.GetDisableResolveMessage()
}

// Copied from https://github.com/prometheus/alertmanager/blob/main/notify/util.go, please remove once we're on-par with upstream.
// truncationMarker is the character used to represent a truncation.
const truncationMarker = "…"

// TruncateInBytes truncates a string to fit the given size in Bytes.
func TruncateInBytes(s string, n int) (string, bool) {
	// First, measure the string the w/o a to-rune conversion.
	if len(s) <= n {
		return s, false
	}

	// The truncationMarker itself is 3 bytes, we can't return any part of the string when it's less than 3.
	if n <= 3 {
		switch n {
		case 3:
			return truncationMarker, true
		default:
			return strings.Repeat(".", n), true
		}
	}

	// Now, to ensure we don't butcher the string we need to remove using runes.
	r := []rune(s)
	truncationTarget := n - 3

	// Next, let's truncate the runes to the lower possible number.
	truncatedRunes := r[:truncationTarget]
	for len(string(truncatedRunes)) > truncationTarget {
		truncatedRunes = r[:len(truncatedRunes)-1]
	}

	return string(truncatedRunes) + truncationMarker, true
}
