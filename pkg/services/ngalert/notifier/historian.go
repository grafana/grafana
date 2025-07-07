package notifier

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	models2 "github.com/grafana/alerting/models"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/client"
	"github.com/grafana/grafana/pkg/services/ngalert/lokiclient"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
)

const LokiClientSpanName = "ngalert.notification-historian.client"

type NotificationHistoryLokiEntry struct {
	SchemaVersion int                                 `json:"schemaVersion"`
	RuleUIDs      []string                            `json:"ruleUIDs"`
	Receiver      string                              `json:"receiver"`
	Status        string                              `json:"status"`
	GroupLabels   map[string]string                   `json:"groupLabels"`
	Alerts        []NotificationHistoryLokiEntryAlert `json:"alerts"`
	Error         string                              `json:"error,omitempty"`

	// TODO ?
	//RuleIDs       string                              `json:"ruleIDs"`

	//DashboardUID  string           `json:"dashboardUID"`
	//PanelID       int64            `json:"panelID"`
	//Fingerprint   string           `json:"fingerprint"`
	//RuleTitle     string           `json:"ruleTitle"`
	//RuleID        int64            `json:"ruleID"`
	//RuleUID       string           `json:"ruleUID"`
	//// InstanceLabels is exactly the set of labels associated with the alert instance in Alertmanager.
	//// These should not be conflated with labels associated with log streams.
	//InstanceLabels map[string]string `json:"labels"`
}

type NotificationHistoryLokiEntryAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	StartsAt    time.Time         `json:"startsAt"`
	EndsAt      time.Time         `json:"endsAt"`
	//GeneratorURL  string             `json:"generatorURL"`
	//Fingerprint   string             `json:"fingerprint"`
	//SilenceURL    string             `json:"silenceURL"`
	//DashboardURL  string             `json:"dashboardURL"`
	//PanelURL      string             `json:"panelURL"`
	//Values        map[string]float64 `json:"values"`
	//ValueString   string             `json:"valueString"` // TODO: Remove in Grafana 10
	//ImageURL      string             `json:"imageURL,omitempty"`
	//EmbeddedImage string             `json:"embeddedImage,omitempty"`
	//OrgID         *int64             `json:"orgId,omitempty"`

}

type remoteLokiClient interface {
	Ping(context.Context) error
	Push(context.Context, []lokiclient.Stream) error
	RangeQuery(ctx context.Context, logQL string, start, end, limit int64) (lokiclient.QueryRes, error)
	MaxQuerySize() int
}

type NotificationHistorian struct {
	client         remoteLokiClient
	externalLabels map[string]string
	metrics        *metrics.NotificationHistorian
	log            log.Logger

	// TODO
	//ac             AccessControl
	//ruleStore      RuleStore
}

func NewNotificationHistorian(logger log.Logger, cfg lokiclient.LokiConfig, req client.Requester, metrics *metrics.NotificationHistorian, tracer tracing.Tracer) *NotificationHistorian {
	return &NotificationHistorian{
		client:         lokiclient.NewLokiClient(cfg, req, metrics.BytesWritten, metrics.WriteDuration, logger, tracer, LokiClientSpanName),
		externalLabels: cfg.ExternalLabels,
		metrics:        metrics,
		log:            logger,
	}

}

func (h *NotificationHistorian) NotificationHistoryLogToStream(ctx context.Context, alerts []*types.Alert, notificationError error) (lokiclient.Stream, error) {
	receiverName, _ := notify.ReceiverName(ctx)
	now, _ := notify.Now(ctx)

	labels := make(map[string]string)
	labels["from"] = "notify-history"
	// TODO
	//labels[OrgIDLabel] = fmt.Sprint(orgID)
	//labels[GroupLabel] = fmt.Sprint(rule.Group)
	//labels[FolderUIDLabel] = fmt.Sprint(rule.NamespaceUID)
	//labels["receiver"] = receiver
	//labels["status"] = status

	ruleUIDs := make([]string, 0)
	seen := make(map[string]bool)
	for _, alert := range alerts {
		ruleUID := string(alert.Labels[models2.RuleUIDLabel])
		if ruleUID == "" {
			continue
		}
		if _, exists := seen[ruleUID]; !exists {
			seen[ruleUID] = true
			ruleUIDs = append(ruleUIDs, ruleUID)
		}
	}

	// TODO: rename
	alertss := make([]NotificationHistoryLokiEntryAlert, len(alerts))
	for i, alert := range alerts {
		alertss[i] = NotificationHistoryLokiEntryAlert{
			Labels:      make(map[string]string),
			Annotations: make(map[string]string),
			Status:      string(alert.Status()),
			StartsAt:    alert.StartsAt,
			EndsAt:      alert.EndsAt,
		}
		for k, v := range alert.Labels {
			if !strings.HasPrefix(string(k), "__") && !strings.HasSuffix(string(k), "__") {
				alertss[i].Labels[string(k)] = string(v)
			}
		}
		for k, v := range alert.Annotations {
			if !strings.HasPrefix(string(k), "__") && !strings.HasSuffix(string(k), "__") {
				alertss[i].Annotations[string(k)] = string(v)
			}
		}
	}

	notificationErrorStr := ""
	if notificationError != nil {
		notificationErrorStr = notificationError.Error()
	}

	entry := NotificationHistoryLokiEntry{
		SchemaVersion: 1,
		RuleUIDs:      ruleUIDs,
		Receiver:      receiverName,
		Status:        "?",
		// TODO: add group labels
		GroupLabels: make(map[string]string),
		Alerts:      alertss,
		Error:       notificationErrorStr,
	}

	// Marshal to JSON for the historian
	entryJSON, jsonErr := json.Marshal(entry)
	if jsonErr != nil {
		return lokiclient.Stream{}, jsonErr
	}

	return lokiclient.Stream{
		Stream: labels,
		Values: []lokiclient.Sample{
			{
				T: now,
				V: string(entryJSON),
			}},
	}, nil
}

func (h *NotificationHistorian) Record(ctx context.Context, alerts []*types.Alert, notificationErr error) error {
	// TODO: goroutine

	stream, err := h.NotificationHistoryLogToStream(ctx, alerts, notificationErr)
	if err != nil {
		h.log.FromContext(ctx).Error("Failed to convert notification history to stream", "error", err)
		return fmt.Errorf("failed to convert notification history to stream: %w", err)
	}

	logger := h.log.FromContext(ctx)
	logger.Debug("Saving notification history", "samples", len(stream.Values))

	// TODO metrics
	//org := fmt.Sprint(orgID)
	//h.metrics.WritesTotal.WithLabelValues(org, "loki").Inc()

	if err := h.client.Push(ctx, []lokiclient.Stream{stream}); err != nil {
		// TODO metrics
		//h.metrics.WritesFailed.WithLabelValues(org, "loki").Inc()
		logger.Error("Failed to save notification history", "error", err)
		return err
	}

	receiverName, _ := notify.ReceiverName(ctx)
	groupLabels, _ := notify.GroupLabels(ctx)
	groupKey, _ := notify.GroupKey(ctx)
	now, _ := notify.Now(ctx)

	logger.Debug("ctx", "receiverName", receiverName, "groupLabels", groupLabels, "groupKey", groupKey, "now", now)
	logger.Debug("Done saving notification history", "samples", len(stream.Values))
	return nil
}

func (h *NotificationHistorian) TestConnection(ctx context.Context) error {
	return h.client.Ping(ctx)
}

// TODO: reuse the one from state historian?
func NewLokiConfig(cfg setting.UnifiedAlertingNotificationHistorySettings) (lokiclient.LokiConfig, error) {
	read, write := cfg.LokiReadURL, cfg.LokiWriteURL
	if read == "" {
		read = cfg.LokiRemoteURL
	}
	if write == "" {
		write = cfg.LokiRemoteURL
	}

	if read == "" {
		return lokiclient.LokiConfig{}, fmt.Errorf("either read path URL or remote Loki URL must be provided")
	}
	if write == "" {
		return lokiclient.LokiConfig{}, fmt.Errorf("either write path URL or remote Loki URL must be provided")
	}

	readURL, err := url.Parse(read)
	if err != nil {
		return lokiclient.LokiConfig{}, fmt.Errorf("failed to parse loki remote read URL: %w", err)
	}
	writeURL, err := url.Parse(write)
	if err != nil {
		return lokiclient.LokiConfig{}, fmt.Errorf("failed to parse loki remote write URL: %w", err)
	}

	return lokiclient.LokiConfig{
		ReadPathURL:       readURL,
		WritePathURL:      writeURL,
		BasicAuthUser:     cfg.LokiBasicAuthUsername,
		BasicAuthPassword: cfg.LokiBasicAuthPassword,
		TenantID:          cfg.LokiTenantID,
		ExternalLabels:    cfg.ExternalLabels,
		MaxQueryLength:    cfg.LokiMaxQueryLength,
		MaxQuerySize:      cfg.LokiMaxQuerySize,
		// Snappy-compressed protobuf is the default, same goes for Promtail.
		Encoder: lokiclient.SnappyProtoEncoder{},
	}, nil
}
