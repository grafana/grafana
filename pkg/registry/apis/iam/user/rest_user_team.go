package user

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Storage         = (*LegacyUserTeamREST)(nil)
	_ rest.StorageMetadata = (*LegacyUserTeamREST)(nil)
	_ rest.Connecter       = (*LegacyUserTeamREST)(nil)
)

func NewLegacyTeamMemberREST(store legacy.LegacyIdentityStore) *LegacyUserTeamREST {
	return &LegacyUserTeamREST{store}
}

type LegacyUserTeamREST struct {
	store legacy.LegacyIdentityStore
}

// New implements rest.Storage.
func (s *LegacyUserTeamREST) New() runtime.Object {
	return &iamv0.UserTeamList{}
}

// Destroy implements rest.Storage.
func (s *LegacyUserTeamREST) Destroy() {}

// ProducesMIMETypes implements rest.StorageMetadata.
func (s *LegacyUserTeamREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

// ProducesObject implements rest.StorageMetadata.
func (s *LegacyUserTeamREST) ProducesObject(verb string) interface{} {
	return s.New()
}

// Connect implements rest.Connecter.
func (s *LegacyUserTeamREST) Connect(ctx context.Context, name string, options runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		res, err := s.store.ListUserTeams(ctx, ns, legacy.ListUserTeamsQuery{
			UserUID:    name,
			Pagination: common.PaginationFromListQuery(r.URL.Query()),
		})
		if err != nil {
			responder.Error(err)
			return
		}

		list := &iamv0.UserTeamList{Items: make([]iamv0.UserTeam, 0, len(res.Items))}

		for _, m := range res.Items {
			list.Items = append(list.Items, mapToUserTeam(m))
		}

		list.Continue = common.OptionalFormatInt(res.Continue)

		responder.Object(http.StatusOK, list)
	}), nil
}

// NewConnectOptions implements rest.Connecter.
func (s *LegacyUserTeamREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ConnectMethods implements rest.Connecter.
func (s *LegacyUserTeamREST) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func mapToUserTeam(t legacy.UserTeam) iamv0.UserTeam {
	return iamv0.UserTeam{
		Title: t.Name,
		TeamRef: iamv0.TeamRef{
			Name: t.UID,
		},
		Permission: common.MapTeamPermission(t.Permission),
	}
}
