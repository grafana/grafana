package team

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var (
	_ rest.Storage         = (*TeamMembersREST)(nil)
	_ rest.Scoper          = (*TeamMembersREST)(nil)
	_ rest.StorageMetadata = (*TeamMembersREST)(nil)
	_ rest.Connecter       = (*TeamMembersREST)(nil)
)

func NewTeamMembersREST(getter rest.Getter, tracer trace.Tracer, features featuremgmt.FeatureToggles) *TeamMembersREST {
	return &TeamMembersREST{getter: getter, tracer: tracer, features: features}
}

type TeamMembersREST struct {
	getter   rest.Getter
	tracer   trace.Tracer
	features featuremgmt.FeatureToggles
}

// New implements rest.Storage.
func (s *TeamMembersREST) New() runtime.Object {
	return &iamv0.TeamMemberList{}
}

// Destroy implements rest.Storage.
func (s *TeamMembersREST) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (s *TeamMembersREST) NamespaceScoped() bool {
	return true
}

// ProducesMIMETypes implements rest.StorageMetadata.
func (s *TeamMembersREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

// ProducesObject implements rest.StorageMetadata.
func (s *TeamMembersREST) ProducesObject(verb string) interface{} {
	return s.New()
}

// Connect implements rest.Connecter.
func (s *TeamMembersREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		//nolint:staticcheck // not migrated to OpenFeature
		if !s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesTeamBindings) {
			responder.Error(apierrors.NewForbidden(iamv0alpha1.TeamResourceInfo.GroupResource(),
				name, errors.New("functionality not available")))
			return
		}

		ctx, span := s.tracer.Start(r.Context(), "team.members")
		defer span.End()

		queryParams, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil {
			responder.Error(err)
			return
		}

		limit := common.DefaultListLimit
		offset := 0
		page := 1
		if queryParams.Has("limit") {
			limit, _ = strconv.Atoi(queryParams.Get("limit"))
		}
		if queryParams.Has("offset") {
			offset, _ = strconv.Atoi(queryParams.Get("offset"))
			if offset > 0 {
				page = (offset / limit) + 1
			}
		} else if queryParams.Has("page") {
			page, _ = strconv.Atoi(queryParams.Get("page"))
			offset = (page - 1) * limit
		}

		if limit > common.MaxListLimit {
			http.Error(w, fmt.Sprintf("limit parameter exceeds maximum of %d", common.MaxListLimit), http.StatusBadRequest)
			return
		}

		if limit < 1 {
			limit = common.DefaultListLimit
		}

		span.SetAttributes(attribute.Int("limit", limit),
			attribute.Int("page", page),
			attribute.Int("offset", offset),
			attribute.String("team.name", name))

		// Subresource handlers receive a ctx without the namespace value set;
		// inject it so the downstream Getter can resolve orgID.
		teamObj, err := s.getter.Get(common.WithSubresourceNamespace(ctx), name, &metav1.GetOptions{})
		if err != nil {
			responder.Error(err)
			return
		}
		t, ok := teamObj.(*iamv0alpha1.Team)
		if !ok {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("unexpected team object type %T", teamObj)))
			return
		}

		// Slice spec.members before mapping to skip work outside the requested page.
		// Page stability depends on the storage ordering of spec.members — we don't
		// sort here, so two consecutive page reads racing a concurrent write can
		// overlap or skip entries. Callers needing a stable view should re-list.
		total := len(t.Spec.Members)
		if offset < 0 {
			offset = 0
		}
		if offset > total {
			offset = total
		}
		end := offset + limit
		if end > total {
			end = total
		}
		window := t.Spec.Members[offset:end]

		items := make([]iamv0alpha1.GetTeamMembersTeamUser, len(window))
		for i, m := range window {
			items[i] = iamv0alpha1.GetTeamMembersTeamUser{
				User:       m.Name,
				Team:       name,
				Permission: string(m.Permission),
				External:   m.External,
			}
		}

		responder.Object(http.StatusOK, &iamv0alpha1.GetTeamMembersResponse{
			GetTeamMembersBody: iamv0alpha1.GetTeamMembersBody{Items: items},
		})
	}), nil
}

// NewConnectOptions implements rest.Connecter.
func (s *TeamMembersREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ConnectMethods implements rest.Connecter.
func (s *TeamMembersREST) ConnectMethods() []string {
	return []string{http.MethodGet}
}
