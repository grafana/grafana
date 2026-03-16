package v0alpha1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-app-sdk/k8s"
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
