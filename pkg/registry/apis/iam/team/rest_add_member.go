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

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
)

// TeamAddMemberREST exposes POST /teams/{name}/addmember as a server-side
// helper that turns a single-user request into a Spec.Members write. The
// handler routes through the team resource's dual-writer storage, so the
// dual-writer mode (legacy primary, unified primary, or both) decides
// where the row physically lands — addmember works in every mode without
// any change at the call site.
//
// Concurrency: the apiserver's Update runs through unified storage's
// optimistic-concurrency check (resourceVersion). When two writers race
// the second one gets 409 Conflict and the handler returns it to the
// caller as-is (single Get + Update, no in-handler retry). Callers are
// expected to retry against fresh state.
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

// NewTeamAddMemberREST takes the team resource's storage. Pass the dual
// writer (rest.Storage from opts.DualWriteBuilder) so reads and writes
// hit the right backing store for the configured dual-writer mode.
//
// The handler isn't gated on a separate feature toggle: if the team API
// is enabled (so this storage map entry is registered at all), addmember
// is part of the contract and ships with it.
func NewTeamAddMemberREST(storage rest.Storage, tracer trace.Tracer) *TeamAddMemberREST {
	getter, _ := storage.(rest.Getter)
	updater, _ := storage.(rest.Updater)
	return &TeamAddMemberREST{getter: getter, updater: updater, tracer: tracer}
}

// New implements rest.Storage. CUE-generated CreateTeamMemberResponse
// lives in the apps/iam scheme; the legacy iam scheme used by the
// apiserver's REST registration only knows about iamv0.TeamMemberList,
// so we hand back that registered type for OpenAPI/scheme discovery and
// emit the richer generated response from the actual handler — same
// pattern TeamMembersREST uses for /members GET.
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
		if s.getter == nil || s.updater == nil {
			responder.Error(apierrors.NewServiceUnavailable("team storage does not implement Get/Update"))
			return
		}

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

		// Subresource handlers receive a ctx without the namespace value
		// set — pull it from AuthInfo via WithSubresourceNamespace so the
		// dual-writer Get/Update can resolve the namespace.
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
		var (
			alreadyMember     bool
			resultingPerm     iamv0alpha1.TeamTeamPermission
			resultingExternal bool
			needUpdate        bool
		)
		found := -1
		for i, m := range t.Spec.Members {
			if m.Kind == "User" && m.Name == body.Name {
				alreadyMember = true
				found = i
				break
			}
		}
		if found >= 0 {
			// Re-add updates Permission to whatever the caller sent
			// but leaves External untouched: External tracks how the
			// membership was created (IdP sync vs manual) and isn't
			// a state /addmember should flip.
			existing := t.Spec.Members[found]
			resultingPerm = permStr
			resultingExternal = existing.External
			if existing.Permission != permStr {
				t.Spec.Members[found].Permission = permStr
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
		if needUpdate {
			// Update returns 409 Conflict on RV mismatch; the handler
			// surfaces it unchanged so the caller can refresh and retry.
			if _, _, err := s.updater.Update(nsCtx, name, rest.DefaultUpdatedObjectInfo(t),
				nil, nil, false, &metav1.UpdateOptions{}); err != nil {
				responder.Error(err)
				return
			}
		}

		// 201 Created on a fresh insert, 200 OK otherwise — covers both
		// the idempotent re-add and an in-place permission update.
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
// generic 500 from the responder.
func decodeJSONBody(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return apierrors.NewBadRequest(fmt.Sprintf("invalid request body: %v", err))
	}
	return nil
}
