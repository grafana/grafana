package provisioning

import (
	"context"
	"fmt"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

// This only works for github right now
type webhookConnector struct {
	getter rest.Getter
}

func (*webhookConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &v0alpha1.WebhookResponse{}
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
	return &v0alpha1.WebhookResponse{}
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
	obj, err := s.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	repo, ok := obj.(*v0alpha1.Repository)
	if !ok {
		return nil, fmt.Errorf("expected repository, but got %t", obj)
	}
	if repo.Spec.Type != v0alpha1.GithubRepositoryType {
		return nil, fmt.Errorf("only works for github")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// really any handler
		// get the repository from the path
		_, _ = w.Write([]byte("TODO... handle webhook " + r.URL.Path))
	}), nil
}

var (
	_ rest.Storage              = (*webhookConnector)(nil)
	_ rest.Connecter            = (*webhookConnector)(nil)
	_ rest.Scoper               = (*webhookConnector)(nil)
	_ rest.SingularNameProvider = (*webhookConnector)(nil)
	_ rest.StorageMetadata      = (*webhookConnector)(nil)
)
