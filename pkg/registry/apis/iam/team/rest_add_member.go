package team

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/client-go/util/retry"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
)

// TeamAddMemberREST exposes POST /teams/{name}/addmember as a server-side
// helper that turns a single-user request into a Spec.Members write,
// routed through the team resource's dual-writer storage.
//
// Concurrency: read-modify-write on Spec.Members wrapped in
// RetryOnConflict so concurrent add-member requests re-read the latest
// team and re-apply the member add instead of failing each other.
type TeamAddMemberREST struct {
	getter  rest.Getter
	updater rest.Updater
	tracer  trace.Tracer
}

var (
	_ rest.Storage         = (*TeamAddMemberREST)(nil)
	_ rest.Scoper          = (*TeamAddMemberREST)(nil)
	_ rest.StorageMetadata = (*TeamAddMemberREST)(nil)
	_ rest.Connecter       = (*TeamAddMemberREST)(nil)
)

// NewTeamAddMemberREST takes the team resource's dual-writer storage so
// reads and writes hit the right backing store for the configured mode.
// Panics at registration time if the storage doesn't implement Getter or
// Updater — that's a wiring bug, not a runtime condition.
func NewTeamAddMemberREST(storage rest.Storage, tracer trace.Tracer) *TeamAddMemberREST {
	getter, ok := storage.(rest.Getter)
	if !ok {
		panic(fmt.Sprintf("team storage %T does not implement rest.Getter", storage))
	}
	updater, ok := storage.(rest.Updater)
	if !ok {
		panic(fmt.Sprintf("team storage %T does not implement rest.Updater", storage))
	}
	return &TeamAddMemberREST{getter: getter, updater: updater, tracer: tracer}
}

// New implements rest.Storage. Returns the iamv0 type the apiserver's
// scheme knows about; the richer CUE-generated response is emitted from
// the handler itself.
func (s *TeamAddMemberREST) New() runtime.Object { return &iamv0.TeamMemberList{} }

// Destroy implements rest.Storage.
func (s *TeamAddMemberREST) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (s *TeamAddMemberREST) NamespaceScoped() bool { return true }

// ProducesMIMETypes implements rest.StorageMetadata.
func (s *TeamAddMemberREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

// ProducesObject implements rest.StorageMetadata.
func (s *TeamAddMemberREST) ProducesObject(verb string) any { return s.New() }

// ConnectMethods implements rest.Connecter — POST only.
func (s *TeamAddMemberREST) ConnectMethods() []string { return []string{http.MethodPost} }

// NewConnectOptions implements rest.Connecter — no extra options.
func (s *TeamAddMemberREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// Connect implements rest.Connecter.
func (s *TeamAddMemberREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, span := s.tracer.Start(r.Context(), "team.addMember")
		defer span.End()
		span.SetAttributes(attribute.String("team.name", name))

		var body iamv0alpha1.CreateTeamMemberRequestBody
		if err := decodeJSONBody(r, &body); err != nil {
			responder.Error(err)
			return
		}
		if body.Name == "" {
			responder.Error(apierrors.NewBadRequest("body.name is required (user UID)"))
			return
		}
		permStr := iamv0alpha1.TeamTeamPermission(body.Permission)
		// Validate permission early so we don't waste a Get on a bad request.
		if _, err := toLegacyPermission(permStr); err != nil {
			responder.Error(apierrors.NewBadRequest(err.Error()))
			return
		}
		external := body.External
		span.SetAttributes(attribute.String("user.name", body.Name))

		// Subresource ctx has no namespace; recover it from AuthInfo so
		// dual-writer Get/Update can resolve it.
		nsCtx := common.WithSubresourceNamespace(ctx)

		var (
			resultingPerm     iamv0alpha1.TeamTeamPermission
			resultingExternal bool
			alreadyMember     bool
		)
		// Refresh and retry on conflict: concurrent adds race on the team's
		// resource version and would otherwise reject each other.
		retryErr := retry.RetryOnConflict(retry.DefaultRetry, func() error {
			obj, err := s.getter.Get(nsCtx, name, &metav1.GetOptions{})
			if err != nil {
				return err
			}
			t, ok := obj.(*iamv0alpha1.Team)
			if !ok {
				return apierrors.NewInternalError(fmt.Errorf("team store returned unexpected type %T", obj))
			}
			needUpdate := false
			foundIdx := -1
			for i, m := range t.Spec.Members {
				if m.Kind == "User" && m.Name == body.Name {
					foundIdx = i
					break
				}
			}
			alreadyMember = foundIdx >= 0
			if alreadyMember {
				// Re-add: update Permission, but leave External untouched —
				// External records the membership origin (IdP sync vs manual)
				// and isn't a state /addmember flips.
				existing := t.Spec.Members[foundIdx]
				resultingPerm = permStr
				resultingExternal = existing.External
				if existing.Permission != permStr {
					t.Spec.Members[foundIdx].Permission = permStr
					needUpdate = true
				}
			} else {
				resultingPerm = permStr
				resultingExternal = external
				t.Spec.Members = append(t.Spec.Members, iamv0alpha1.TeamTeamMember{
					Kind:       "User",
					Name:       body.Name,
					Permission: permStr,
					External:   external,
				})
				needUpdate = true
			}
			if !needUpdate {
				return nil
			}
			if _, _, err := s.updater.Update(nsCtx, name, rest.DefaultUpdatedObjectInfo(t),
				nil, nil, false, &metav1.UpdateOptions{}); err != nil {
				// RV mismatches are already 409s RetryOnConflict retries;
				// SQL deadlocks arrive as a rolled-back 500, so surface them
				// as conflicts to retry too.
				if isRetryableTxnError(err) {
					return apierrors.NewConflict(teamResource.GroupResource(), name, err)
				}
				return err
			}
			return nil
		})
		if retryErr != nil {
			responder.Error(retryErr)
			return
		}

		// 201 on fresh insert, 200 on idempotent re-add or permission update.
		status := http.StatusCreated
		if alreadyMember {
			status = http.StatusOK
		}
		responder.Object(status, &iamv0alpha1.CreateTeamMemberResponse{
			CreateTeamMemberBody: iamv0alpha1.CreateTeamMemberBody{
				Team:       name,
				User:       body.Name,
				Permission: string(resultingPerm),
				External:   resultingExternal,
			},
		})
	}), nil
}

// decodeJSONBody returns a 400 BadRequest on parse errors instead of a
// generic 500 from the responder. Unknown fields are tolerated to match
// the apiserver's permissive behaviour for forward-compatibility.
func decodeJSONBody(r *http.Request, dst any) error {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		return apierrors.NewBadRequest(fmt.Sprintf("invalid request body: %v", err))
	}
	return nil
}
