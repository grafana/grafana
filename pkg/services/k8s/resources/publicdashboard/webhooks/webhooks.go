package webhooks

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/k8s/resources/publicdashboard"
	k8sTypes "k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/admission"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	k8sAdmission "k8s.io/api/admission/v1"
	admissionregistrationV1 "k8s.io/api/admissionregistration/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type WebhooksAPI struct {
	*services.BasicService
	RouteRegister        routing.RouteRegister
	AccessControl        accesscontrol.AccessControl
	Features             *featuremgmt.FeatureManager
	Log                  log.Logger
	ValidationController admission.ValidatingAdmissionController
	MutationController   admission.MutatingAdmissionController
	clientSetProvider    client.ClientSetProvider
}

var ValidationWebhookConfigs = []client.ShortWebhookConfig{
	{
		Kind: publicdashboard.Kind,
		Operations: []admissionregistrationV1.OperationType{
			admissionregistrationV1.Create,
			admissionregistrationV1.Update,
		},
		Url:     "https://127.0.0.1:2999/k8s/publicdashboards/validate",
		Timeout: int32(5),
	},
}

var MutationWebhookConfigs = []client.ShortWebhookConfig{
	{
		Kind: publicdashboard.Kind,
		Operations: []admissionregistrationV1.OperationType{
			admissionregistrationV1.Create,
			admissionregistrationV1.Update,
		},
		Url:     "https://127.0.0.1:2999/k8s/publicdashboards/mutate",
		Timeout: int32(5),
	},
}

// TODO: Figure out how to combine this with the WIP branch in the SDK:
// https://github.com/grafana/grafana-app-sdk/pull/92.
// We should be able to register a generic webhook endpoint to handle
// marshaling and routing.
func ProvideWebhooks(
	rr routing.RouteRegister,
	clientset client.ClientSetProvider,
	ac accesscontrol.AccessControl,
	features *featuremgmt.FeatureManager,
	vc admission.ValidatingAdmissionController,
	mc admission.MutatingAdmissionController,
) *WebhooksAPI {
	webhooksAPI := &WebhooksAPI{
		RouteRegister:        rr,
		AccessControl:        ac,
		Log:                  log.New("k8s.publicdashboard.webhooks"),
		ValidationController: vc,
		MutationController:   mc,
		clientSetProvider:    clientset,
	}

	// Register webhooks on grafana api server
	webhooksAPI.RegisterAPIEndpoints()

	webhooksAPI.BasicService = services.NewBasicService(webhooksAPI.start, webhooksAPI.running, nil).WithName(modules.PublicDashboardsWebhooks)

	return webhooksAPI
}

func (api *WebhooksAPI) RegisterAPIEndpoints() {
	api.RouteRegister.Post("/k8s/publicdashboards/validate", api.Validate)
	api.RouteRegister.Post("/k8s/publicdashboards/mutate", api.Mutate)
}

func (api *WebhooksAPI) start(ctx context.Context) error {
	clientset := api.clientSetProvider.GetClientset()
	// Register admission hooks with k8s api server
	err := clientset.RegisterValidation(context.Background(), ValidationWebhookConfigs)
	if err != nil {
		return err
	}

	// Register mutation hooks with k8s api server
	return clientset.RegisterMutation(context.Background(), MutationWebhookConfigs)
}

func (api *WebhooksAPI) running(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func makeSuccessfulAdmissionReview(uid k8sTypes.UID, typeMeta metaV1.TypeMeta) *k8sAdmission.AdmissionReview {
	return &k8sAdmission.AdmissionReview{
		TypeMeta: typeMeta,
		Response: &k8sAdmission.AdmissionResponse{
			UID:     uid,
			Allowed: true,
			Result: &metaV1.Status{
				Status: "Success",
				Code:   200,
			},
		},
	}
}

func makeFailureAdmissionReview(uid k8sTypes.UID, typeMeta metaV1.TypeMeta, err error, code int32) *k8sAdmission.AdmissionReview {
	return &k8sAdmission.AdmissionReview{
		TypeMeta: typeMeta,
		Response: &k8sAdmission.AdmissionResponse{
			UID:     uid,
			Allowed: false,
			Result: &metaV1.Status{
				Status:  "Failure",
				Message: err.Error(),
				Code:    code,
			},
		},
	}
}
