package provisioning

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

// This only works for github right now
type webhookConnector struct {
	getter RepoGetter
}

func (*webhookConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.WebhookResponse{}
}

func (*webhookConnector) Destroy() {}

func (*webhookConnector) NamespaceScoped() bool {
	return true
}

func (*webhookConnector) GetSingularName() string {
	return "WebhookResponse"
}

func (*webhookConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*webhookConnector) ProducesObject(verb string) any {
	return &provisioning.WebhookResponse{}
}

func (*webhookConnector) ConnectMethods() []string {
	return []string{
		http.MethodPost,
		http.MethodGet, // only useful for browser testing, should be removed
	}
}

func (*webhookConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (s *webhookConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	repo, err := s.getter.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}
	webhook := repo.Webhook(responder)
	if webhook == nil {
		return nil, &errors.StatusError{
			ErrStatus: v1.Status{
				Message: fmt.Sprintf("webhook is not implemented for: %s", repo.Config().Spec.Type),
				Code:    http.StatusNotImplemented,
			},
		}
	}
	return webhook, nil
}

var (
	_ rest.Storage              = (*webhookConnector)(nil)
	_ rest.Connecter            = (*webhookConnector)(nil)
	_ rest.Scoper               = (*webhookConnector)(nil)
	_ rest.SingularNameProvider = (*webhookConnector)(nil)
	_ rest.StorageMetadata      = (*webhookConnector)(nil)
)
