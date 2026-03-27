package notification

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	authlib "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	rulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/config"
	folderv1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type Notification struct {
	loki         *LokiReader
	logger       logging.Logger
	folderClient *folderv1beta1.FolderClient
	accessClient authlib.AccessClient
}

func New(cfg config.NotificationConfig, reg prometheus.Registerer, logger logging.Logger, tracer trace.Tracer, folderClient *folderv1beta1.FolderClient, accessClient authlib.AccessClient) *Notification {
	if !cfg.Enabled {
		return &Notification{}
	}
	return &Notification{
		loki:         NewLokiReader(cfg.Loki, reg, logger, tracer),
		logger:       logger,
		folderClient: folderClient,
		accessClient: accessClient,
	}
}

// GetAlertRuleReadFolders returns the list of folders where the logged-in user
// has permission to read alert rules (alert rules "get" verb).
func (n *Notification) GetAlertRuleReadFolders(ctx context.Context) ([]folderv1beta1.Folder, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting requester from context: %w", err)
	}

	namespace := requester.GetNamespace()

	// List all folders visible to the user. The folder API already filters
	// by the user's folders:read permission via the context identity.
	folderList, err := n.folderClient.ListAll(ctx, namespace, resource.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing folders: %w", err)
	}

	if len(folderList.Items) == 0 {
		return nil, nil
	}

	// Use BatchCheck to determine which folders allow alert rule reads.
	// BatchCheck supports up to 500 items per request, so process in batches.
	foldersByID := make(map[string]*folderv1beta1.Folder, len(folderList.Items))
	var result []folderv1beta1.Folder

	for batchStart := 0; batchStart < len(folderList.Items); batchStart += authlib.MaxBatchCheckItems {
		batchEnd := batchStart + authlib.MaxBatchCheckItems
		if batchEnd > len(folderList.Items) {
			batchEnd = len(folderList.Items)
		}
		batch := folderList.Items[batchStart:batchEnd]

		checks := make([]authlib.BatchCheckItem, 0, len(batch))
		for i := range batch {
			f := &batch[i]
			foldersByID[f.Name] = f
			checks = append(checks, authlib.BatchCheckItem{
				CorrelationID: f.Name,
				Verb:          "get",
				Group:         rulesv0alpha1.APIGroup,
				Resource:      "alertrules",
				Folder:        f.Name,
			})
		}

		resp, err := n.accessClient.BatchCheck(ctx, requester, authlib.BatchCheckRequest{
			Namespace: namespace,
			Checks:    checks,
		})
		if err != nil {
			return nil, fmt.Errorf("batch checking alert rule access: %w", err)
		}

		for _, check := range checks {
			if r, ok := resp.Results[check.CorrelationID]; ok && r.Allowed {
				result = append(result, *foldersByID[check.CorrelationID])
			}
		}
	}

	return result, nil
}

func (n *Notification) QueryAlertsHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	start := time.Now()

	if n.loki == nil {
		const msg = "Notification alerts query whilst disabled"
		n.logger.Debug(msg)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusUnprocessableEntity,
				Message: msg,
			}}
	}

	var body v0alpha1.CreateNotificationsqueryalertsRequestBody
	err := json.NewDecoder(request.Body).Decode(&body)
	if err != nil {
		const msg = "Notification alerts query malformed"
		n.logger.Debug(msg, "err", err)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Message: fmt.Sprintf("%s: %s", msg, err.Error()),
			}}
	}

	response, err := n.loki.QueryAlerts(ctx, body)
	if err != nil {
		if errors.Is(err, ErrInvalidQuery) {
			const msg = "Notification alerts query invalid"
			n.logger.Debug(msg, "err", err)
			return &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status:  metav1.StatusFailure,
					Code:    http.StatusBadRequest,
					Message: fmt.Sprintf("%s: %s", msg, err.Error()),
				}}
		}
		const msg = "Notification alerts query failed"
		n.logger.Error(msg, "err", err, "duration", time.Since(start))
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("%s: %s", msg, err.Error()),
			}}
	}

	n.logger.Debug("Notification alerts query success",
		"alerts", len(response.Alerts),
		"duration", time.Since(start))

	writer.Header().Add("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(response)
}

func (n *Notification) QueryHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	start := time.Now()

	if n.loki == nil {
		const msg = "Notification history query whilst disabled"
		n.logger.Debug(msg)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusUnprocessableEntity,
				Message: msg,
			}}
	}

	var body v0alpha1.CreateNotificationqueryRequestBody
	err := json.NewDecoder(request.Body).Decode(&body)
	if err != nil {
		const msg = "Notification history query malformed"
		n.logger.Debug(msg, "err", err)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Message: fmt.Sprintf("%s: %s", msg, err.Error()),
			}}
	}

	response, err := n.loki.Query(ctx, body)
	if err != nil {
		if errors.Is(err, ErrInvalidQuery) {
			const msg = "Notification history query invalid"
			n.logger.Debug(msg, "err", err)
			return &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status:  metav1.StatusFailure,
					Code:    http.StatusBadRequest,
					Message: fmt.Sprintf("%s: %s", msg, err.Error()),
				}}
		}
		const msg = "Notification history query failed"
		n.logger.Error(msg, "err", err, "duration", time.Since(start))
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("%s: %s", msg, err.Error()),
			}}
	}

	n.logger.Debug("Notification history query success",
		"entries", len(response.Entries),
		"counts", len(response.Counts),
		"duration", time.Since(start))

	writer.Header().Add("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(response)
}
