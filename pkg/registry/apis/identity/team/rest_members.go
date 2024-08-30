package team

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/api/dtos"
	identityv0 "github.com/grafana/grafana/pkg/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/identity/common"
	"github.com/grafana/grafana/pkg/registry/apis/identity/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ rest.Storage         = (*LegacyTeamMemberREST)(nil)
	_ rest.Scoper          = (*LegacyTeamMemberREST)(nil)
	_ rest.StorageMetadata = (*LegacyTeamMemberREST)(nil)
	_ rest.Connecter       = (*LegacyTeamMemberREST)(nil)
)

func NewLegacyTeamMemberREST(store legacy.LegacyIdentityStore) *LegacyTeamMemberREST {
	return &LegacyTeamMemberREST{store}
}

type LegacyTeamMemberREST struct {
	store legacy.LegacyIdentityStore
}

// New implements rest.Storage.
func (s *LegacyTeamMemberREST) New() runtime.Object {
	return &identityv0.TeamMemberList{}
}

// Destroy implements rest.Storage.
func (s *LegacyTeamMemberREST) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (s *LegacyTeamMemberREST) NamespaceScoped() bool {
	return true
}

// ProducesMIMETypes implements rest.StorageMetadata.
func (s *LegacyTeamMemberREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

// ProducesObject implements rest.StorageMetadata.
func (s *LegacyTeamMemberREST) ProducesObject(verb string) interface{} {
	return s.New()
}

// Connect implements rest.Connecter.
func (s *LegacyTeamMemberREST) Connect(ctx context.Context, name string, options runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		res, err := s.store.ListTeamMembers(ctx, ns, legacy.ListTeamMembersQuery{
			UID:        name,
			Pagination: common.PaginationFromListQuery(r.URL.Query()),
		})
		if err != nil {
			responder.Error(err)
			return
		}

		list := &identityv0.TeamMemberList{Items: make([]identityv0.TeamMember, 0, len(res.Members))}

		for _, m := range res.Members {
			list.Items = append(list.Items, mapToTeamMember(m))
		}

		list.ListMeta.Continue = common.OptionalFormatInt(res.Continue)

		responder.Object(http.StatusOK, list)
	}), nil
}

// NewConnectOptions implements rest.Connecter.
func (s *LegacyTeamMemberREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ConnectMethods implements rest.Connecter.
func (s *LegacyTeamMemberREST) ConnectMethods() []string {
	return []string{http.MethodGet}
}

var cfg = &setting.Cfg{}

func mapToTeamMember(m legacy.TeamMember) identityv0.TeamMember {
	return identityv0.TeamMember{
		IdentityDisplay: identityv0.IdentityDisplay{
			IdentityType: claims.TypeUser,
			UID:          m.UserUID,
			Display:      m.Name,
			AvatarURL:    dtos.GetGravatarUrlWithDefault(cfg, m.Email, m.Name),
			InternalID:   m.UserID,
		},
		External:   m.External,
		Permission: mapPermisson(m.Permission),
	}
}
