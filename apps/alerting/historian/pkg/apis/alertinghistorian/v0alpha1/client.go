package v0alpha1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
)

// Note that this file is currently hand written, custom routes do not generate clients:
// https://github.com/grafana/grafana-app-sdk/issues/1277

// Client is a thin typed wrapper around a namespaced rest.Interface
type Client struct {
	client    rest.Interface
	namespace string
}

// NewClient creates a Client for a for a specific namespace.
func NewClient(cfg rest.Config, namespace string) (*Client, error) {
	cfg.GroupVersion = &schema.GroupVersion{
		Group:   APIGroup,
		Version: APIVersion,
	}

	// If the caller didn't pass one, specify a reasonable default.
	if cfg.NegotiatedSerializer == nil {
		cfg.NegotiatedSerializer = &k8s.GenericNegotiatedSerializer{}
	}

	client, err := rest.RESTClientFor(&cfg)
	if err != nil {
		return nil, err
	}

	return &Client{client: client, namespace: namespace}, nil
}

// NotificationQuery invokes POST /notification/query.
func (h *Client) NotificationQuery(ctx context.Context, body CreateNotificationqueryRequestBody) (*CreateNotificationqueryResponse, error) {
	var resp CreateNotificationqueryResponse
	if err := h.post(ctx, "/notification/query", body, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// NotificationsQueryAlerts invokes POST /notifications/queryalerts.
func (h *Client) NotificationsQueryAlerts(ctx context.Context, body CreateNotificationsqueryalertsRequestBody) (*CreateNotificationsqueryalertsResponse, error) {
	var resp CreateNotificationsqueryalertsResponse
	if err := h.post(ctx, "/notifications/queryalerts", body, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// AlertStateHistory invokes GET /alertstate/history.
func (h *Client) AlertStateHistory(ctx context.Context, params url.Values) (*AlertStateHistoryResponse, error) {
	raw, err := h.get(ctx, "/alertstate/history", params)
	if err != nil {
		return nil, err
	}
	var frame data.Frame
	if err := json.Unmarshal(raw, &frame); err != nil {
		return nil, fmt.Errorf("unmarshal [/alertstate/history]: %w", err)
	}
	entries, err := parseAlertStateHistoryFrame(&frame)
	if err != nil {
		return nil, err
	}
	return &AlertStateHistoryResponse{Entries: entries}, nil
}

func parseAlertStateHistoryFrame(frame *data.Frame) ([]AlertStateHistoryEntry, error) {
	if frame == nil || len(frame.Fields) < 2 || frame.Rows() == 0 {
		return nil, nil
	}
	timeField := frame.Fields[0]
	lineField := frame.Fields[1]

	entries := make([]AlertStateHistoryEntry, 0, frame.Rows())
	for i := 0; i < frame.Rows(); i++ {
		ts, ok := timeField.ConcreteAt(i)
		if !ok {
			continue
		}
		lineRaw, ok := lineField.ConcreteAt(i)
		if !ok {
			continue
		}

		rawBytes, err := json.Marshal(lineRaw)
		if err != nil {
			continue
		}

		var entry AlertStateHistoryEntry
		if err := json.Unmarshal(rawBytes, &entry); err != nil {
			continue
		}
		entry.Timestamp = ts.(time.Time)
		entries = append(entries, entry)
	}
	return entries, nil
}

func (h *Client) get(ctx context.Context, path string, params url.Values) ([]byte, error) {
	req := h.client.Get().Namespace(h.namespace).Suffix(path)
	for k, vals := range params {
		for _, v := range vals {
			req = req.Param(k, v)
		}
	}
	result := req.Do(ctx)
	if err := result.Error(); err != nil {
		return nil, fmt.Errorf("request [%s]: %w", path, err)
	}
	return result.Raw()
}

func (h *Client) post(ctx context.Context, path string, body any, resp any) error {
	encoded, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal [%s]: %w", path, err)
	}
	result := h.client.Post().
		Namespace(h.namespace).
		Suffix(path).
		SetHeader("Content-Type", "application/json").
		Body(bytes.NewReader(encoded)).
		Do(ctx)
	if err := result.Error(); err != nil {
		return fmt.Errorf("request [%s]: %w", path, err)
	}
	raw, err := result.Raw()
	if err != nil {
		// Should be caught above, but check anyway.
		return fmt.Errorf("request [%s]: %w", path, err)
	}
	if err := json.Unmarshal(raw, resp); err != nil {
		return fmt.Errorf("unmarshal [%s]: %w", path, err)
	}
	return nil
}
