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

// NewTeamRemoveMemberREST takes the team resource's dual-writer storage.
// Panics at registration time if the storage doesn't implement Getter or
// Updater — that's a wiring bug, not a runtime condition.
func NewTeamRemoveMemberREST(storage rest.Storage, tracer trace.Tracer) *TeamRemoveMemberREST {
	getter, ok := storage.(rest.Getter)
	if !ok {
		panic(fmt.Sprintf("team storage %T does not implement rest.Getter", storage))
	}
	updater, ok := storage.(rest.Updater)
	if !ok {
		panic(fmt.Sprintf("team storage %T does not implement rest.Updater", storage))
	}
	return &TeamRemoveMemberREST{getter: getter, updater: updater, tracer: tracer}
}

// New implements rest.Storage. Returns the iamv0 type the apiserver's
// scheme knows about; the richer CUE-generated response is emitted from
// the handler itself.
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
			responder.Error(apierrors.NewInternalError(fmt.Errorf("team store returned unexpected type %T", obj)))
			return
		}
		removeIdx := -1
		for i, m := range t.Spec.Members {
			if m.Kind == "User" && m.Name == body.Name {
				removeIdx = i
				break
			}
		}
		if removeIdx >= 0 {
			t.Spec.Members = append(t.Spec.Members[:removeIdx], t.Spec.Members[removeIdx+1:]...)
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
