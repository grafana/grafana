package team

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	identityv0 "github.com/grafana/grafana/pkg/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/identity/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Storage              = (*LegacyUserTeamsStore)(nil)
	_ rest.SingularNameProvider = (*LegacyUserTeamsStore)(nil)
	_ rest.Connecter            = (*LegacyUserTeamsStore)(nil)
	_ rest.Scoper               = (*LegacyUserTeamsStore)(nil)
	_ rest.StorageMetadata      = (*LegacyUserTeamsStore)(nil)
)

func NewLegacyUserTeamsStore(store legacy.LegacyIdentityStore) *LegacyUserTeamsStore {
	return &LegacyUserTeamsStore{
		logger: log.New("user teams"),
		store:  store,
	}
}

type LegacyUserTeamsStore struct {
	logger log.Logger
	store  legacy.LegacyIdentityStore
}

func (r *LegacyUserTeamsStore) New() runtime.Object {
	return &identityv0.TeamList{}
}

func (r *LegacyUserTeamsStore) Destroy() {}

func (r *LegacyUserTeamsStore) NamespaceScoped() bool {
	return true
}

func (r *LegacyUserTeamsStore) GetSingularName() string {
	return "TeamList"
}

func (r *LegacyUserTeamsStore) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (r *LegacyUserTeamsStore) ProducesObject(verb string) interface{} {
	return &identityv0.TeamList{}
}

func (r *LegacyUserTeamsStore) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *LegacyUserTeamsStore) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *LegacyUserTeamsStore) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	teams, err := r.store.GetUserTeams(ctx, ns, name)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		list := &identityv0.TeamList{}
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
