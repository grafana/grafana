package externalgroupmapping

import (
	"context"
	"net/http"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var _ TeamGroupsHandler = (*NoopTeamGroupsREST)(nil)

type NoopTeamGroupsREST struct{}

func ProvideNoopTeamGroupsREST() *NoopTeamGroupsREST {
	return &NoopTeamGroupsREST{}
}

// Connect implements rest.Connecter.
func (n *NoopTeamGroupsREST) Connect(ctx context.Context, id string, options runtime.Object, r rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "functionality not available", http.StatusForbidden)
	}), nil
}

// New implements rest.Storage.
func (s *NoopTeamGroupsREST) New() runtime.Object {
	return iamv0alpha1.NewGetGroups()
}

// Destroy implements rest.Storage.
func (s *NoopTeamGroupsREST) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (s *NoopTeamGroupsREST) NamespaceScoped() bool {
	return true
}

// ProducesMIMETypes implements rest.StorageMetadata.
func (s *NoopTeamGroupsREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

// ProducesObject implements rest.StorageMetadata.
func (s *NoopTeamGroupsREST) ProducesObject(verb string) interface{} {
	return s.New()
}

// NewConnectOptions implements rest.Connecter.
func (s *NoopTeamGroupsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ConnectMethods implements rest.Connecter.
func (s *NoopTeamGroupsREST) ConnectMethods() []string {
	return []string{http.MethodGet}
}
