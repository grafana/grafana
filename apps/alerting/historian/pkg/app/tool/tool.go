package tool

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/notification"
)

type Tool struct {
	notification *notification.Notification
	logger       logging.Logger
}

func New(notification *notification.Notification, logger logging.Logger) *Tool {
	return &Tool{
		notification: notification,
		logger:       logger,
	}
}

func (t *Tool) ToolHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	start := time.Now()

	var body v0alpha1.CreateToolRequestBody
	err := json.NewDecoder(request.Body).Decode(&body)
	if err != nil {
		const msg = "Tool call body malformed"
		t.logger.Debug(msg, "err", err)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Message: fmt.Sprintf("%s: %s", msg, err.Error()),
			}}
	}

	var response *v0alpha1.CreateToolResponse
	switch body.Operation {
	case v0alpha1.CreateToolRequestBodyOperationGetAlertStateHistory:
		response, err = t.ToolGetAlertStateHistory(ctx, body)

	case v0alpha1.CreateToolRequestBodyOperationGetNotificationHistory:
		response, err = t.ToolGetNotificationHistory(ctx, body)

	default:
		const msg = "Tool call invalid operation"
		t.logger.Debug(msg, "operation", body.Operation)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Message: fmt.Sprintf("%s: %s", msg, body.Operation),
			}}
	}

	if err != nil {
		t.logger.Debug("Tool call failed", "err", err, "duration", time.Since(start))
		return err
	}

	t.logger.Debug("Tool call success",
		"operation", body.Operation,
		"duration", time.Since(start))

	writer.Header().Add("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(response)
}

func (t *Tool) ToolGetAlertStateHistory(ctx context.Context, body v0alpha1.CreateToolRequestBody) (*v0alpha1.CreateToolResponse, error) {
	return nil, &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusBadRequest,
			Message: "Unimplemented",
		}}
}

func (t *Tool) ToolGetNotificationHistory(ctx context.Context, body v0alpha1.CreateToolRequestBody) (*v0alpha1.CreateToolResponse, error) {
	q := v0alpha1.CreateNotificationqueryRequestBody{
		RuleUID: body.RuleUID,
		From:    body.From,
		To:      body.To,
		Limit:   body.Limit,
	}

	if body.Type != nil {
		typ := (v0alpha1.CreateNotificationqueryRequestBodyType)(*body.Type)
		q.Type = &typ
	}

	if body.GetNotificationHistory != nil {
		opts := *body.GetNotificationHistory

		if opts.Receiver != nil {
			recv := *opts.Receiver
			q.Receiver = &recv
		}
		if opts.Status != nil {
			st := (v0alpha1.CreateNotificationqueryRequestNotificationStatus)(*opts.Status)
			q.Status = &st
		}
		if opts.Outcome != nil {
			st := (v0alpha1.CreateNotificationqueryRequestNotificationOutcome)(*opts.Outcome)
			q.Outcome = &st
		}

		q.GroupLabels = convertMatchers(opts.GroupLabels)
		q.Labels = convertMatchers(opts.Labels)
	}

	res, err := t.notification.Query(ctx, q)
	if err == nil {
		return nil, err
	}

	return &v0alpha1.CreateToolResponse{
		Summary: GenerateNotificationHistorySummary(*res),
	}, nil
}

func convertMatchers(in *v0alpha1.CreateToolRequestMatchers) *v0alpha1.CreateNotificationqueryRequestMatchers {
	if in == nil {
		return nil
	}

	out := make(v0alpha1.CreateNotificationqueryRequestMatchers, len(*in))
	for i := range *in {
		out[i] = v0alpha1.CreateNotificationqueryRequestMatcher{
			Type:  v0alpha1.CreateNotificationqueryRequestMatcherType((*in)[i].Type),
			Label: (*in)[i].Label,
			Value: (*in)[i].Value,
		}
	}

	return &out
}
