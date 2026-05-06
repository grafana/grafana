package team

import (
	"context"
	"fmt"
	"net/http"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
)

// TeamRemoveMemberREST exposes POST /teams/{name}/removemember: the inverse
// of TeamAddMemberREST. Filters one user out of Spec.Members and writes
// the team back through the dual-writer storage.
//
// Idempotency: removing an already-absent user returns 200 OK.
// Concurrency: single Get + Update, RV-checked; 409 on race, caller
// refreshes and re-issues.
type TeamRemoveMemberREST struct {
	getter  rest.Getter
	updater rest.Updater
	tracer  trace.Tracer
}

var (
	_ rest.Storage         = (*TeamRemoveMemberREST)(nil)
	_ rest.Scoper          = (*TeamRemoveMemberREST)(nil)
	_ rest.StorageMetadata = (*TeamRemoveMemberREST)(nil)
	_ rest.Connecter       = (*TeamRemoveMemberREST)(nil)
)

// NewTeamRemoveMemberREST takes the team resource's storage. The handler
// isn't gated on a separate feature toggle: registration of this entry
// in the storage map is itself gated on the team API being enabled.
func NewTeamRemoveMemberREST(storage rest.Storage, tracer trace.Tracer) *TeamRemoveMemberREST {
	getter, _ := storage.(rest.Getter)
	updater, _ := storage.(rest.Updater)
	return &TeamRemoveMemberREST{getter: getter, updater: updater, tracer: tracer}
}

// New implements rest.Storage. CUE-generated DeleteTeamMemberResponse
// lives in the apps/iam scheme; the legacy iam scheme used by the
// apiserver's REST registration only knows about iamv0.TeamMemberList,
// so we hand back that registered type for OpenAPI/scheme discovery and
// emit the richer generated response from the actual handler — same
// pattern TeamMembersREST uses for /members GET.
func (s *TeamRemoveMemberREST) New() runtime.Object { return &iamv0.TeamMemberList{} }

// Destroy implements rest.Storage.
func (s *TeamRemoveMemberREST) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (s *TeamRemoveMemberREST) NamespaceScoped() bool { return true }

// ProducesMIMETypes implements rest.StorageMetadata.
func (s *TeamRemoveMemberREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

// ProducesObject implements rest.StorageMetadata.
func (s *TeamRemoveMemberREST) ProducesObject(verb string) any { return s.New() }

// ConnectMethods implements rest.Connecter — POST only.
func (s *TeamRemoveMemberREST) ConnectMethods() []string { return []string{http.MethodPost} }

// NewConnectOptions implements rest.Connecter — no extra options.
func (s *TeamRemoveMemberREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// Connect implements rest.Connecter.
func (s *TeamRemoveMemberREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.getter == nil || s.updater == nil {
			responder.Error(apierrors.NewServiceUnavailable("team storage does not implement Get/Update"))
			return
		}

		ctx, span := s.tracer.Start(r.Context(), "team.removeMember")
		defer span.End()
		span.SetAttributes(attribute.String("team.name", name))

		var body iamv0alpha1.DeleteTeamMemberRequestBody
		if err := decodeJSONBody(r, &body); err != nil {
			responder.Error(err)
			return
		}
		if body.Name == "" {
			responder.Error(apierrors.NewBadRequest("body.name is required (user UID)"))
			return
		}
		span.SetAttributes(attribute.String("user.name", body.Name))

		nsCtx := common.WithSubresourceNamespace(ctx)

		obj, err := s.getter.Get(nsCtx, name, &metav1.GetOptions{})
		if err != nil {
			responder.Error(err)
			return
		}
		t, ok := obj.(*iamv0alpha1.Team)
		if !ok {
			responder.Error(fmt.Errorf("team store returned unexpected type %T", obj))
			return
		}
		filtered := make([]iamv0alpha1.TeamTeamMember, 0, len(t.Spec.Members))
		var removed bool
		for _, m := range t.Spec.Members {
			if m.Kind == "User" && m.Name == body.Name {
				removed = true
				continue
			}
			filtered = append(filtered, m)
		}
		if removed {
			t.Spec.Members = filtered
			// 409 surfaces unchanged; SQL deadlocks (which arrive as 500
			// from unified storage) are converted so RetryOnConflict catches them.
			if _, _, err := s.updater.Update(nsCtx, name, rest.DefaultUpdatedObjectInfo(t),
				nil, nil, false, &metav1.UpdateOptions{}); err != nil {
				if isRetryableTxnError(err) {
					responder.Error(apierrors.NewConflict(teamResource.GroupResource(), name, err))
					return
				}
				responder.Error(err)
				return
			}
		}

		// 200 OK whether or not a row existed; the request is idempotent.
		responder.Object(http.StatusOK, &iamv0alpha1.DeleteTeamMemberResponse{
			DeleteTeamMemberBody: iamv0alpha1.DeleteTeamMemberBody{
				Team: name,
				User: body.Name,
			},
		})
	}), nil
}
