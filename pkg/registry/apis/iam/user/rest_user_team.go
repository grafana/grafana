package user

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	legacyiamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ rest.Storage         = (*UserTeamREST)(nil)
	_ rest.StorageMetadata = (*UserTeamREST)(nil)
	_ rest.Connecter       = (*UserTeamREST)(nil)
)

type UserTeamREST struct {
	backends *dualwrite.Selector[UserTeamsBackend]
	tracer   trace.Tracer
}

func NewUserTeamREST(backends *dualwrite.Selector[UserTeamsBackend], tracer trace.Tracer) *UserTeamREST {
	return &UserTeamREST{backends: backends, tracer: tracer}
}

// New implements rest.Storage.
func (s *UserTeamREST) New() runtime.Object {
	return &legacyiamv0.UserTeamList{}
}

// Destroy implements rest.Storage.
func (s *UserTeamREST) Destroy() {}

// ProducesMIMETypes implements rest.StorageMetadata.
func (s *UserTeamREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

// ProducesObject implements rest.StorageMetadata.
func (s *UserTeamREST) ProducesObject(verb string) interface{} {
	return s.New()
}

// Connect implements rest.Connecter.
func (s *UserTeamREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, span := s.tracer.Start(r.Context(), "user.teams")
		defer span.End()

		queryParams, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil {
			responder.Error(err)
			return
		}

		requester, err := identity.GetRequester(ctx)
		if err != nil {
			responder.Error(apierrors.NewUnauthorized("no identity found"))
			return
		}

		limit := common.DefaultListLimit
		if queryParams.Has("limit") {
			limit, _ = strconv.Atoi(queryParams.Get("limit"))
		}
		if limit > common.MaxListLimit {
			http.Error(w, fmt.Sprintf("limit parameter exceeds maximum of %d", common.MaxListLimit), http.StatusBadRequest)
			return
		}
		if limit < 1 {
			limit = common.DefaultListLimit
		}

		// Keep existing tokens valid across backend changes and rolling upgrades.
		var after []string
		if cont := queryParams.Get("continue"); cont != "" {
			token, err := resource.GetContinueToken(cont)
			if err != nil {
				span.SetStatus(codes.Error, "invalid continue token")
				span.RecordError(err)
				http.Error(w, fmt.Sprintf("invalid continue token: %v", err), http.StatusBadRequest)
				return
			}
			after = token.SearchAfter
		}

		span.SetAttributes(attribute.Int("limit", limit),
			attribute.String("name", name),
			attribute.StringSlice("search_after", after))

		backend, err := s.backends.Resolve(ctx)
		if err != nil {
			responder.Error(apierrors.NewInternalError(err))
			return
		}
		page, err := backend.ListUserTeams(ctx, UserTeamsQuery{
			Namespace: requester.GetNamespace(),
			UserUID:   name,
			Limit:     int64(limit),
			After:     after,
			Explain:   queryParams.Has("explain") && queryParams.Get("explain") != "false",
		})
		if err != nil {
			responder.Error(err)
			return
		}
		response := &iamv0alpha1.GetUserTeamsResponse{
			GetUserTeamsBody: iamv0alpha1.GetUserTeamsBody{Items: page.Items},
		}
		if len(page.Next) > 0 {
			token, err := resource.NewSearchContinueToken(page.Next, page.ResourceVersion)
			if err != nil {
				responder.Error(apierrors.NewInternalError(err))
				return
			}
			response.Continue = token
		}
		responder.Object(http.StatusOK, response)
	}), nil
}

// NewConnectOptions implements rest.Connecter.
func (s *UserTeamREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ConnectMethods implements rest.Connecter.
func (s *UserTeamREST) ConnectMethods() []string {
	return []string{http.MethodGet}
}
