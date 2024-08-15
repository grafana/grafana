package identity

import (
	"context"
	"net/http"

	identity "github.com/grafana/grafana/pkg/apimachinery/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/identity/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type userTeamsREST struct {
	logger log.Logger
	store  legacy.LegacyIdentityStore
}

var (
	_ rest.Storage              = (*userTeamsREST)(nil)
	_ rest.SingularNameProvider = (*userTeamsREST)(nil)
	_ rest.Connecter            = (*userTeamsREST)(nil)
	_ rest.Scoper               = (*userTeamsREST)(nil)
	_ rest.StorageMetadata      = (*userTeamsREST)(nil)
)

func newUserTeamsREST(store legacy.LegacyIdentityStore) *userTeamsREST {
	return &userTeamsREST{
		logger: log.New("user teams"),
		store:  store,
	}
}

func (r *userTeamsREST) New() runtime.Object {
	return &identity.TeamList{}
}

func (r *userTeamsREST) Destroy() {}

func (r *userTeamsREST) NamespaceScoped() bool {
	return true
}

func (r *userTeamsREST) GetSingularName() string {
	return "TeamList" // Used for the
}

func (r *userTeamsREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *userTeamsREST) ProducesObject(verb string) interface{} {
	return &identity.TeamList{}
}

func (r *userTeamsREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *userTeamsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *userTeamsREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	teams, err := r.store.GetUserTeams(ctx, ns, name)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		list := &identity.TeamList{}
		for _, team := range teams {
			t, err := asTeam(&team, ns.Value)
			if err != nil {
				responder.Error(err)
				return
			}
			list.Items = append(list.Items, *t)
		}
		responder.Object(200, list)
	}), nil
}
