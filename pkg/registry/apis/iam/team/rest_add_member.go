package team

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/client-go/util/retry"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
)

// membersRetry is the backoff used by the addmember/removemember handlers.
// retry.DefaultRetry (5 attempts, ~50ms total) is too small under sustained
// cross-instance team-sync load: each call races against peer instances
// rewriting Spec.Members on the same team, and an exhausted retry surfaces as
// silent membership loss because the synchronizer logs at warn but the outer
// sync HTTP handler still returns 200. ~5–8s of jittered budget gives the
// retry loop enough room to converge against fresh state in practice.
var membersRetry = wait.Backoff{
	Steps:    15,
	Duration: 50 * time.Millisecond,
	Factor:   1.5,
	Jitter:   0.2,
	Cap:      2 * time.Second,
}

// TeamAddMemberREST exposes POST /teams/{name}/addmember as a server-side
// helper that turns a single-user request into a Spec.Members write. The
// handler routes through the team resource's dual-writer storage, so the
// dual-writer mode (legacy primary, unified primary, or both) decides
// where the row physically lands — addmember works in every mode without
// any change at the call site.
//
// Concurrency: the apiserver's Update runs through unified storage's
// optimistic-concurrency check (resourceVersion). When two writers race
// the second one gets 409 Conflict and we retry inside this handler with
// retry.RetryOnConflict, refreshing Spec.Members against post-write
// state. That collapses the synchronizer's distributed retry loop into
// one request — and as a side-effect, since the synchronizer no longer
// keeps a stale Spec.Members snapshot in memory, the cross-instance
// silent-loss race that motivated this endpoint can no longer manifest
// from the synchronizer's side.
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
func (s *TeamAddMemberREST) ProducesObject(verb string) interface{} { return s.New() }

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
		permStr := iamv0alpha1.TeamTeamPermission(deref(body.Permission, string(iamv0alpha1.TeamTeamPermissionMember)))
		// Validate permission early so we don't waste a Get on a bad request.
		if _, err := toLegacyPermission(permStr); err != nil {
			responder.Error(apierrors.NewBadRequest(err.Error()))
			return
		}
		external := body.External != nil && *body.External
		span.SetAttributes(attribute.String("user.name", body.Name))

		// Subresource handlers receive a ctx without the namespace value
		// set — pull it from AuthInfo via WithSubresourceNamespace so the
		// dual-writer Get/Update can resolve the namespace.
		nsCtx := common.WithSubresourceNamespace(ctx)

		var alreadyMember bool
		err := retry.RetryOnConflict(membersRetry, func() error {
			obj, err := s.getter.Get(nsCtx, name, &metav1.GetOptions{})
			if err != nil {
				return err
			}
			t, ok := obj.(*iamv0alpha1.Team)
			if !ok {
				return fmt.Errorf("team store returned unexpected type %T", obj)
			}
			alreadyMember = false
			for _, m := range t.Spec.Members {
				if m.Kind == "User" && m.Name == body.Name {
					alreadyMember = true
					return nil
				}
			}
			t.Spec.Members = append(t.Spec.Members, iamv0alpha1.TeamTeamMember{
				Kind:       "User",
				Name:       body.Name,
				Permission: permStr,
				External:   external,
			})
			_, _, updErr := s.updater.Update(nsCtx, name, rest.DefaultUpdatedObjectInfo(t),
				nil, nil, false, &metav1.UpdateOptions{})
			return updErr
		})
		if err != nil {
			responder.Error(err)
			return
		}

		// 201 Created on a fresh insert, 200 OK on an idempotent re-add.
		status := http.StatusCreated
		if alreadyMember {
			status = http.StatusOK
		}
		responder.Object(status, &iamv0alpha1.CreateTeamMemberResponse{
			CreateTeamMemberBody: iamv0alpha1.CreateTeamMemberBody{
				Team:       name,
				User:       body.Name,
				Permission: string(permStr),
				External:   external,
			},
		})
	}), nil
}

// deref returns *p when non-nil, otherwise the supplied default.
func deref[T any](p *T, def T) T {
	if p == nil {
		return def
	}
	return *p
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
