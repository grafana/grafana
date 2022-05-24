package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
)

const (
	OpsgenieSendTags    = "tags"
	OpsgenieSendDetails = "details"
	OpsgenieSendBoth    = "both"
)

var (
	OpsgenieAlertURL = "https://api.opsgenie.com/v2/alerts"
	ValidPriorities  = map[string]bool{"P1": true, "P2": true, "P3": true, "P4": true, "P5": true}
)

// OpsgenieNotifier is responsible for sending alert notifications to Opsgenie.
type OpsgenieNotifier struct {
	*Base
	APIKey           string
	APIUrl           string
	AutoClose        bool
	OverridePriority bool
	SendTagsAs       string
	tmpl             *template.Template
	log              log.Logger
	ns               notifications.WebhookSender
	images           ImageStore
}

type OpsgenieConfig struct {
	*NotificationChannelConfig
	APIKey           string
	APIUrl           string
	AutoClose        bool
	OverridePriority bool
	SendTagsAs       string
}

func OpsgenieFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewOpsgenieConfig(fc.Config, fc.DecryptFunc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewOpsgenieNotifier(cfg, fc.NotificationService, fc.ImageStore, fc.Template, fc.DecryptFunc), nil
}

func NewOpsgenieConfig(config *NotificationChannelConfig, decryptFunc GetDecryptedValueFn) (*OpsgenieConfig, error) {
	apiKey := decryptFunc(context.Background(), config.SecureSettings, "apiKey", config.Settings.Get("apiKey").MustString())
	if apiKey == "" {
		return nil, errors.New("could not find api key property in settings")
	}
	sendTagsAs := config.Settings.Get("sendTagsAs").MustString(OpsgenieSendTags)
	if sendTagsAs != OpsgenieSendTags &&
		sendTagsAs != OpsgenieSendDetails &&
		sendTagsAs != OpsgenieSendBoth {
		return nil, fmt.Errorf("invalid value for sendTagsAs: %q", sendTagsAs)
	}
	return &OpsgenieConfig{
		NotificationChannelConfig: config,
		APIKey:                    apiKey,
		APIUrl:                    config.Settings.Get("apiUrl").MustString(OpsgenieAlertURL),
		AutoClose:                 config.Settings.Get("autoClose").MustBool(true),
		OverridePriority:          config.Settings.Get("overridePriority").MustBool(true),
		SendTagsAs:                sendTagsAs,
	}, nil
}

// NewOpsgenieNotifier is the constructor for the Opsgenie notifier
func NewOpsgenieNotifier(config *OpsgenieConfig, ns notifications.WebhookSender, images ImageStore, t *template.Template, fn GetDecryptedValueFn) *OpsgenieNotifier {
	return &OpsgenieNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		APIKey:           config.APIKey,
		APIUrl:           config.APIUrl,
		AutoClose:        config.AutoClose,
		OverridePriority: config.OverridePriority,
		SendTagsAs:       config.SendTagsAs,
		tmpl:             t,
		log:              log.New("alerting.notifier." + config.Name),
		ns:               ns,
		images:           images,
	}
}

// Notify sends an alert notification to Opsgenie
func (on *OpsgenieNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	on.log.Debug("Executing Opsgenie notification", "notification", on.Name)

	alerts := types.Alerts(as...)
	if alerts.Status() == model.AlertResolved && !on.SendResolved() {
		on.log.Debug("Not sending a trigger to Opsgenie", "status", alerts.Status(), "auto resolve", on.SendResolved())
		return true, nil
	}

	bodyJSON, url, err := on.buildOpsgenieMessage(ctx, alerts, as)
	if err != nil {
		return false, fmt.Errorf("build Opsgenie message: %w", err)
	}

	if url == "" {
		// Resolved alert with no auto close.
		// Hence skip sending anything.
		return true, nil
	}

	body, err := json.Marshal(bodyJSON)
	if err != nil {
		return false, fmt.Errorf("marshal json: %w", err)
	}

	cmd := &models.SendWebhookSync{
		Url:        url,
		Body:       string(body),
		HttpMethod: http.MethodPost,
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("GenieKey %s", on.APIKey),
		},
	}

	if err := on.ns.SendWebhookSync(ctx, cmd); err != nil {
		return false, fmt.Errorf("send notification to Opsgenie: %w", err)
	}

	return true, nil
}

func (on *OpsgenieNotifier) buildOpsgenieMessage(ctx context.Context, alerts model.Alerts, as []*types.Alert) (payload *simplejson.Json, apiURL string, err error) {
	key, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return nil, "", err
	}

	var (
		alias    = key.Hash()
		bodyJSON = simplejson.New()
		details  = simplejson.New()
	)

	if alerts.Status() == model.AlertResolved {
		// For resolved notification, we only need the source.
		// Don't need to run other templates.
		if on.AutoClose {
			bodyJSON := simplejson.New()
			bodyJSON.Set("source", "Grafana")
			apiURL = fmt.Sprintf("%s/%s/close?identifierType=alias", on.APIUrl, alias)
			return bodyJSON, apiURL, nil
		}
		return nil, "", nil
	}

	ruleURL := joinUrlPath(on.tmpl.ExternalURL.String(), "/alerting/list", on.log)

	var tmplErr error
	tmpl, data := TmplText(ctx, on.tmpl, as, on.log, &tmplErr)

	title := tmpl(DefaultMessageTitleEmbed)
	description := fmt.Sprintf(
		"%s\n%s\n\n%s",
		tmpl(DefaultMessageTitleEmbed),
		ruleURL,
		tmpl(`{{ template "default.message" . }}`),
	)

	var priority string

	// In the new alerting system we've moved away from the grafana-tags. Instead, annotations on the rule itself should be used.
	lbls := make(map[string]string, len(data.CommonLabels))
	for k, v := range data.CommonLabels {
		lbls[k] = tmpl(v)

		if k == "og_priority" {
			if ValidPriorities[v] {
				priority = v
			}
		}
	}

	bodyJSON.Set("message", title)
	bodyJSON.Set("source", "Grafana")
	bodyJSON.Set("alias", alias)
	bodyJSON.Set("description", description)
	details.Set("url", ruleURL)

	if on.sendDetails() {
		for k, v := range lbls {
			details.Set(k, v)
		}

		images := []string{}
		for i := range as {
			imgToken := getTokenFromAnnotations(as[i].Annotations)
			if len(imgToken) == 0 {
				continue
			}

			dbContext, cancel := context.WithTimeout(ctx, ImageStoreTimeout)
			imgURL, err := on.images.GetURL(dbContext, imgToken)
			cancel()

			if err != nil {
				if !errors.Is(err, ErrImagesUnavailable) {
					// Ignore errors. Don't log "ImageUnavailable", which means the storage doesn't exist.
					on.log.Warn("Error reading screenshot data from ImageStore: %v", err)
				}
			} else if len(imgURL) != 0 {
				images = append(images, imgURL)
			}
		}

		if len(images) != 0 {
			details.Set("image_urls", images)
		}
	}

	tags := make([]string, 0, len(lbls))
	if on.sendTags() {
		for k, v := range lbls {
			tags = append(tags, fmt.Sprintf("%s:%s", k, v))
		}
	}
	sort.Strings(tags)

	if priority != "" && on.OverridePriority {
		bodyJSON.Set("priority", priority)
	}

	bodyJSON.Set("tags", tags)
	bodyJSON.Set("details", details)
	apiURL = tmpl(on.APIUrl)

	if tmplErr != nil {
		on.log.Warn("failed to template Opsgenie message", "err", tmplErr.Error())
	}

	return bodyJSON, apiURL, nil
}

func (on *OpsgenieNotifier) SendResolved() bool {
	return !on.GetDisableResolveMessage()
}

func (on *OpsgenieNotifier) sendDetails() bool {
	return on.SendTagsAs == OpsgenieSendDetails || on.SendTagsAs == OpsgenieSendBoth
}

func (on *OpsgenieNotifier) sendTags() bool {
	return on.SendTagsAs == OpsgenieSendTags || on.SendTagsAs == OpsgenieSendBoth
}
