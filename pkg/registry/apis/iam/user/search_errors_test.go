package user

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	legacyuser "github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestUnifiedSearchErrorStatus(t *testing.T) {
	plainErr := errors.New("private database failure")
	for name, index := range map[string]*MockClient{
		"embedded": {MockResponses: []*resourcepb.ResourceSearchResponse{{Error: &resourcepb.ErrorResult{
			Code: http.StatusTooManyRequests, Message: "search is busy",
		}}}},
		"transport": {MockError: fmt.Errorf("search: %w", status.Error(codes.ResourceExhausted, "search is busy"))},
		"plain":     {MockError: plainErr},
		"internal":  {MockError: status.Error(codes.Internal, "private database failure")},
	} {
		t.Run(name, func(t *testing.T) {
			for operation, validate := range map[string]func(context.Context, SearchBackend, string, string, string) error{
				"email": validateEmail,
				"login": validateLogin,
			} {
				t.Run(operation, func(t *testing.T) {
					backend := NewUnifiedSearchClient(&MockClient{MockResponses: index.MockResponses, MockError: index.MockError}, nil)
					err := validate(t.Context(), backend, "stacks-1", "user-1", "taken")
					switch name {
					case "plain":
						require.ErrorIs(t, err, plainErr)
					case "internal":
						var statusErr apierrors.APIStatus
						require.ErrorAs(t, err, &statusErr)
						require.Equal(t, http.StatusInternalServerError, int(statusErr.Status().Code))
						require.NotContains(t, statusErr.Status().Message, "private database failure")
					default:
						require.True(t, apierrors.IsTooManyRequests(err), "got %v", err)
					}
				})
			}

			backend := NewUnifiedSearchClient(index, &setting.Cfg{})
			handler := NewSearchHandler(tracing.NewNoopTracerService(), selectorForBackend(backend), nil)
			req := httptest.NewRequest(http.MethodGet, "/searchUsers", nil)
			req = req.WithContext(identity.WithRequester(req.Context(), &legacyuser.SignedInUser{Namespace: "stacks-1"}))
			w := httptest.NewRecorder()
			handler.DoSearch(w, req)
			if name == "plain" || name == "internal" {
				require.Equal(t, http.StatusInternalServerError, w.Code)
				require.NotContains(t, w.Body.String(), plainErr.Error())
			} else {
				require.Equal(t, http.StatusTooManyRequests, w.Code)
			}
		})
	}
}

func TestUserAdmissionPreservesSearchErrorStatus(t *testing.T) {
	for name, index := range map[string]*MockClient{
		"embedded": {MockResponses: []*resourcepb.ResourceSearchResponse{{Error: &resourcepb.ErrorResult{
			Code: http.StatusServiceUnavailable, Message: "index unavailable",
		}}}},
		"transport": {MockError: status.Error(codes.Unavailable, "index unavailable")},
	} {
		for _, operation := range []string{"create", "update email", "update login"} {
			t.Run(name+"/"+operation, func(t *testing.T) {
				backend := NewUnifiedSearchClient(&MockClient{MockResponses: index.MockResponses, MockError: index.MockError}, nil)
				selector := selectorForBackend(backend)
				ctx := identity.WithRequester(t.Context(), &legacyuser.SignedInUser{
					Namespace: "stacks-1", IsGrafanaAdmin: true, OrgRole: identity.RoleAdmin,
				})
				oldObj := &iamv0.User{Spec: iamv0.UserSpec{Login: "alice", Email: "alice@example.com", Role: "Admin"}}
				obj := oldObj.DeepCopy()
				var err error
				switch operation {
				case "create":
					err = ValidateOnCreate(ctx, selector, obj)
				case "update email":
					obj.Spec.Email = "other@example.com"
					err = ValidateOnUpdate(ctx, selector, oldObj, obj)
				case "update login":
					obj.Spec.Login = "other"
					err = ValidateOnUpdate(ctx, selector, oldObj, obj)
				}
				require.Error(t, err)
				require.Equal(t, int32(http.StatusServiceUnavailable), responsewriters.ErrorToAPIStatus(err).Code)
			})
		}
	}
}

func TestUserTeamReadErrorStatus(t *testing.T) {
	plainErr := errors.New("team read failed")
	for name, readErr := range map[string]error{
		"typed": apierrors.NewTooManyRequests("team store busy", 12),
		"plain": plainErr,
	} {
		t.Run(name, func(t *testing.T) {
			client := &userTeamsIndexClient{response: &resourcepb.ResourceSearchResponse{
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Rows:         []*resourcepb.ResourceSearchRow{{Key: &resourcepb.ResourceKey{Name: "team-a"}}},
			}}
			getter := &userTeamsGetter{get: func(context.Context, string) (runtime.Object, error) { return nil, readErr }}
			backend := NewUnifiedUserTeamsBackend(client, getter)
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Namespace: "stacks-1"})
			responder, _ := serveUserTeams(t, ctx, userTeamsSelector(backend), "")
			require.ErrorIs(t, responder.err, readErr)
			require.Equal(t, responsewriters.ErrorToAPIStatus(readErr), responsewriters.ErrorToAPIStatus(responder.err))
		})
	}
}

func TestParseResultsPreservesErrorStatus(t *testing.T) {
	_, err := parseResults(&resourcepb.ResourceSearchResponse{Error: &resourcepb.ErrorResult{
		Code: http.StatusServiceUnavailable, Message: "index unavailable",
	}})
	require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
}

func TestUserTeamSearchErrorStatus(t *testing.T) {
	failure := &resourcepb.ErrorResult{
		Code: http.StatusTooManyRequests, Reason: string(metav1.StatusReasonTooManyRequests), Message: "search is busy",
		Details: &resourcepb.ErrorDetails{Name: "team", Group: "iam.grafana.app", Kind: "teams", Uid: "uid", RetryAfterSeconds: 12},
	}
	st, err := status.New(codes.ResourceExhausted, "search is busy").WithDetails(failure)
	require.NoError(t, err)
	plainErr := errors.New("search failed")
	for name, client := range map[string]*userTeamsIndexClient{
		"embedded":  {response: &resourcepb.ResourceSearchResponse{Error: failure}},
		"transport": {err: fmt.Errorf("search: %w", st.Err())},
		"plain":     {err: plainErr},
	} {
		t.Run(name, func(t *testing.T) {
			backend := NewUnifiedUserTeamsBackend(client, nil)
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Namespace: "stacks-1"})
			responder, _ := serveUserTeams(t, ctx, userTeamsSelector(backend), "")
			require.Error(t, responder.err)
			if name == "plain" {
				require.ErrorIs(t, responder.err, plainErr)
				return
			}
			require.Equal(t, responsewriters.ErrorToAPIStatus(resource.GetError(failure)), responsewriters.ErrorToAPIStatus(responder.err))
		})
	}
}
