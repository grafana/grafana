package receivertesting

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	_ "github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/receiver"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type ReceiverTestingHandler struct {
	testingSvc *notifier.ReceiverTestingSvc
}

func New(ng *ngalert.AlertNG) *ReceiverTestingHandler {
	testingSvc := notifier.NewReceiverTestingSvc(ng.Api.ReceiverService, ng.MultiOrgAlertmanager, ng.SecretsService)
	return &ReceiverTestingHandler{
		testingSvc: testingSvc,
	}

}

func (p *ReceiverTestingHandler) HandleReceiverTestingRequest(ctx context.Context, w app.CustomRouteResponseWriter, r *app.CustomRouteRequest) error {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	var req v0alpha1.GetIntegrationTestRequestBody
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeBadRequest(w, err)
	}

	alert := notifier.Alert{
		Labels:      req.Alert.Labels,
		Annotations: req.Alert.Annotations,
	}

	integration, secure, err := receiver.ConvertReceiverIntegrationToIntegration("test-receiver", v0alpha1.ReceiverIntegration(req.Integration))
	if err != nil {
		writeBadRequest(w, err)
	}
	receiverUID := ""
	if req.ReceiverRef != nil {
		receiverUID = *req.ReceiverRef
	}

	result, err := p.testingSvc.Test(ctx, user, alert, receiverUID, integration, secure)
	if err != nil {
		// TODO better error handling
		writeBadRequest(w, err)
	}

	response := v0alpha1.GetIntegrationTest{
		TypeMeta: metav1.TypeMeta{},
		GetIntegrationTestBody: v0alpha1.GetIntegrationTestBody{
			Timestamp: time.Time(result.LastNotifyAttempt),
			Duration:  result.LastNotifyAttemptDuration,
		},
	}
	if result.LastNotifyAttemptError != "" {
		response.GetIntegrationTestBody.Error = &result.LastNotifyAttemptError
	}

	json, err := json.Marshal(response)
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	w.WriteHeader(200)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(json)
	return nil
}

func writeBadRequest(w app.CustomRouteResponseWriter, err error) {
	w.WriteHeader(400)
	_, _ = w.Write([]byte(err.Error()))
}
