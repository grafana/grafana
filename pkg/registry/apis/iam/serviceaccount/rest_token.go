package serviceaccount

import (
	"context"
	"net/http"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Storage         = (*LegacyTokenRest)(nil)
	_ rest.Scoper          = (*LegacyTokenRest)(nil)
	_ rest.StorageMetadata = (*LegacyTokenRest)(nil)
	_ rest.Connecter       = (*LegacyTokenRest)(nil)
)

func NewLegacyTokenREST(store legacy.LegacyIdentityStore) *LegacyTokenRest {
	return &LegacyTokenRest{store}
}

type LegacyTokenRest struct {
	store legacy.LegacyIdentityStore
}

// New implements rest.Storage.
func (s *LegacyTokenRest) New() runtime.Object {
	return &iamv0.UserTeamList{}
}

// Destroy implements rest.Storage.
func (s *LegacyTokenRest) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (s *LegacyTokenRest) NamespaceScoped() bool {
	return true
}

// ProducesMIMETypes implements rest.StorageMetadata.
func (s *LegacyTokenRest) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

// ProducesObject implements rest.StorageMetadata.
func (s *LegacyTokenRest) ProducesObject(verb string) interface{} {
	return s.New()
}

// Connect implements rest.Connecter.
func (s *LegacyTokenRest) Connect(ctx context.Context, name string, options runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		res, err := s.store.ListServiceAccountTokens(ctx, ns, legacy.ListServiceAccountTokenQuery{
			UID:        name,
			Pagination: common.PaginationFromListQuery(r.URL.Query()),
		})
		if err != nil {
			responder.Error(err)
			return
		}

		list := &iamv0.ServiceAccountTokenList{Items: make([]iamv0.ServiceAccountToken, 0, len(res.Items))}

		for _, t := range res.Items {
			list.Items = append(list.Items, mapToToken(t))
		}

		list.Continue = common.OptionalFormatInt(res.Continue)

		responder.Object(http.StatusOK, list)
	}), nil
}

// NewConnectOptions implements rest.Connecter.
func (s *LegacyTokenRest) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ConnectMethods implements rest.Connecter.
func (s *LegacyTokenRest) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func mapToToken(t legacy.ServiceAccountToken) iamv0.ServiceAccountToken {
	var expires, lastUsed *metav1.Time

	if t.Expires != nil {
		ts := metav1.NewTime(time.Unix(*t.Expires, 0))
		expires = &ts
	}

	if t.LastUsed != nil {
		ts := metav1.NewTime(*t.LastUsed)
		lastUsed = &ts
	}

	return iamv0.ServiceAccountToken{
		Name:     t.Name,
		Expires:  expires,
		LastUsed: lastUsed,
		Revoked:  t.Revoked,
		Created:  metav1.NewTime(t.Created),
	}
}
