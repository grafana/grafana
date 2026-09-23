package authinfok8s

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	clientrest "k8s.io/client-go/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

type testDirectRestConfigProvider struct{ serverURL string }

func (p *testDirectRestConfigProvider) GetDirectRestConfig(*contextmodel.ReqContext) *clientrest.Config {
	return &clientrest.Config{Host: p.serverURL}
}
func (*testDirectRestConfigProvider) DirectlyServeHTTP(http.ResponseWriter, *http.Request) {}
func (*testDirectRestConfigProvider) IsReady() bool                                        { return true }

var _ apiserver.DirectRestConfigProvider = (*testDirectRestConfigProvider)(nil)

func contextWithReqContext(orgID int64) context.Context {
	ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{})
	return identity.WithRequester(ctx, &identity.StaticRequester{OrgID: orgID})
}

func newTestStore(t *testing.T, handler http.HandlerFunc) *Store {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return NewStore(log.NewNopLogger(), nil, &testDirectRestConfigProvider{serverURL: server.URL}, tracing.InitializeTracerForTest())
}

func writeStatus(w http.ResponseWriter, code int32, reason metav1.StatusReason) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(int(code))
	_ = json.NewEncoder(w).Encode(metav1.Status{
		TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
		Status:   metav1.StatusFailure,
		Reason:   reason,
		Code:     code,
	})
}

func writeJSON(t *testing.T, w http.ResponseWriter, v any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	require.NoError(t, json.NewEncoder(w).Encode(v))
}

func usersResponse(t *testing.T, w http.ResponseWriter, uid string) {
	writeJSON(t, w, iamv0alpha1.UserList{Items: []iamv0alpha1.User{{ObjectMeta: metav1.ObjectMeta{Name: uid}}}})
}

func userByUIDResponse(t *testing.T, w http.ResponseWriter, uid string, userID int64) {
	writeJSON(t, w, iamv0alpha1.User{
		ObjectMeta: metav1.ObjectMeta{
			Name:   uid,
			Labels: map[string]string{utils.LabelKeyDeprecatedInternalID: strconv.FormatInt(userID, 10)},
		},
	})
}

func noUsersResponse(t *testing.T, w http.ResponseWriter) {
	writeJSON(t, w, iamv0alpha1.UserList{})
}

func authInfoItem(name, userUID, module, authID string, created time.Time) iamv0alpha1.AuthInfo {
	ms := created.UnixMilli()
	return iamv0alpha1.AuthInfo{
		ObjectMeta: metav1.ObjectMeta{Name: name, CreationTimestamp: metav1.NewTime(created)},
		Spec: iamv0alpha1.AuthInfoSpec{
			UserRef:    iamv0alpha1.AuthInfoUserRef{Name: userUID},
			AuthModule: module,
			AuthID:     authID,
			Created:    &ms,
		},
	}
}

func TestHasTokenValue(t *testing.T) {
	cases := []struct {
		name string
		tok  *oauth2.Token
		want bool
	}{
		{"nil", nil, false},
		{"zero value", &oauth2.Token{}, false},
		{"access token set", &oauth2.Token{AccessToken: "secret"}, true},
		{"refresh token set", &oauth2.Token{RefreshToken: "secret"}, true},
		{"token type set", &oauth2.Token{TokenType: "Bearer"}, true},
		{"expiry set", &oauth2.Token{Expiry: time.Now()}, true},
		{"id_token extra set", (&oauth2.Token{}).WithExtra(map[string]any{"id_token": "jwt"}), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, hasTokenValue(tc.tok))
		})
	}
}

func TestStore_GetAuthInfo(t *testing.T) {
	created := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	older := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)

	type testCase struct {
		name      string
		query     *login.GetAuthInfoQuery
		handler   http.HandlerFunc
		wantErr   bool
		wantErrIs error
		want      *login.UserAuth
		check     func(t *testing.T, result *login.UserAuth)
	}

	cases := []testCase{
		{
			name:  "with module, gets by the deterministic name",
			query: &login.GetAuthInfoQuery{UserId: 42, AuthModule: "oauth_github"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid")
				case strings.Contains(r.URL.Path, "/authinfos/"):
					assert.True(t, strings.HasSuffix(r.URL.Path, "/authinfos/user-uid.oauth-github"))
					writeJSON(t, w, authInfoItem("user-uid.oauth-github", "user-uid", "oauth_github", "github-42", created))
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			want: &login.UserAuth{UserId: 42, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "github-42", Created: created},
		},
		{
			name:  "without module, picks the most recently linked one",
			query: &login.GetAuthInfoQuery{UserId: 42},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid")
				case strings.HasSuffix(r.URL.Path, "/authinfos"):
					assert.Equal(t, "spec.userRef.name=user-uid", r.URL.Query().Get("fieldSelector"))
					writeJSON(t, w, iamv0alpha1.AuthInfoList{Items: []iamv0alpha1.AuthInfo{
						authInfoItem("user-uid.ldap", "user-uid", "ldap", "ldap-id", older),
						authInfoItem("user-uid.oauth-github", "user-uid", "oauth_github", "github-42", created),
					}})
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			check: func(t *testing.T, result *login.UserAuth) {
				assert.Equal(t, "oauth_github", result.AuthModule)
				assert.Equal(t, created, result.Created)
			},
		},
		{
			name:  "requires UserId or AuthId",
			query: &login.GetAuthInfoQuery{},
			handler: func(w http.ResponseWriter, r *http.Request) {
				t.Fatalf("no HTTP call should be made, got: %s %s", r.Method, r.URL.Path)
			},
			wantErr: true,
		},
		{
			name:  "AuthId only, no UserId, resolves the user from the matched object",
			query: &login.GetAuthInfoQuery{AuthId: "github-99"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.HasSuffix(r.URL.Path, "/authinfos"):
					assert.Equal(t, "spec.authID=github-99", r.URL.Query().Get("fieldSelector"))
					writeJSON(t, w, iamv0alpha1.AuthInfoList{Items: []iamv0alpha1.AuthInfo{
						authInfoItem("user-uid.oauth-github", "user-uid", "oauth_github", "github-99", created),
					}})
				case strings.Contains(r.URL.Path, "/users/"):
					userByUIDResponse(t, w, "user-uid", 99)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			want: &login.UserAuth{UserId: 99, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "github-99", Created: created},
		},
		{
			name:  "AuthId and AuthModule, no UserId",
			query: &login.GetAuthInfoQuery{AuthId: "github-99", AuthModule: "oauth_github"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.HasSuffix(r.URL.Path, "/authinfos"):
					fs := r.URL.Query().Get("fieldSelector")
					assert.Contains(t, fs, "spec.authID=github-99")
					assert.Contains(t, fs, "spec.authModule=oauth_github")
					writeJSON(t, w, iamv0alpha1.AuthInfoList{Items: []iamv0alpha1.AuthInfo{
						authInfoItem("user-uid.oauth-github", "user-uid", "oauth_github", "github-99", created),
					}})
				case strings.Contains(r.URL.Path, "/users/"):
					userByUIDResponse(t, w, "user-uid", 99)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			want: &login.UserAuth{UserId: 99, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "github-99", Created: created},
		},
		{
			name:  "AuthId with selector metacharacters, no UserId",
			query: &login.GetAuthInfoQuery{AuthId: "cn=test,ou=people,dc=example,dc=com", AuthModule: "ldap"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.HasSuffix(r.URL.Path, "/authinfos"):
					fs := r.URL.Query().Get("fieldSelector")
					assert.Contains(t, fs, `spec.authID=cn\=test\,ou\=people\,dc\=example\,dc\=com`)
					sel, err := fields.ParseSelector(fs)
					require.NoError(t, err)
					authID, ok := sel.RequiresExactMatch("spec.authID")
					require.True(t, ok)
					assert.Equal(t, "cn=test,ou=people,dc=example,dc=com", authID, "the selector must round-trip back to the literal AuthId")

					writeJSON(t, w, iamv0alpha1.AuthInfoList{Items: []iamv0alpha1.AuthInfo{
						authInfoItem("user-uid.ldap", "user-uid", "ldap", "cn=test,ou=people,dc=example,dc=com", created),
					}})
				case strings.Contains(r.URL.Path, "/users/"):
					userByUIDResponse(t, w, "user-uid", 99)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			want: &login.UserAuth{UserId: 99, UserUID: "user-uid", AuthModule: "ldap", AuthId: "cn=test,ou=people,dc=example,dc=com", Created: created},
		},
		{
			name:  "AuthId only, no match",
			query: &login.GetAuthInfoQuery{AuthId: "missing-id"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.HasSuffix(r.URL.Path, "/authinfos"):
					writeJSON(t, w, iamv0alpha1.AuthInfoList{})
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			wantErrIs: user.ErrUserNotFound,
		},
		{
			name:  "AuthId only, picks the most recently created match across users",
			query: &login.GetAuthInfoQuery{AuthId: "shared-id"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.HasSuffix(r.URL.Path, "/authinfos"):
					writeJSON(t, w, iamv0alpha1.AuthInfoList{Items: []iamv0alpha1.AuthInfo{
						authInfoItem("user-a.ldap", "user-a", "ldap", "shared-id", older),
						authInfoItem("user-b.oauth-github", "user-b", "oauth_github", "shared-id", created),
					}})
				case strings.Contains(r.URL.Path, "/users/"):
					userByUIDResponse(t, w, "user-b", 7)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			check: func(t *testing.T, result *login.UserAuth) {
				assert.Equal(t, "user-b", result.UserUID)
				assert.Equal(t, created, result.Created)
			},
		},
		{
			name:  "not found",
			query: &login.GetAuthInfoQuery{UserId: 42, AuthModule: "oauth_github"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid")
				case strings.Contains(r.URL.Path, "/authinfos/"):
					writeStatus(w, http.StatusNotFound, metav1.StatusReasonNotFound)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			wantErrIs: user.ErrUserNotFound,
		},
		{
			name:  "authId filter with no match",
			query: &login.GetAuthInfoQuery{UserId: 42, AuthId: "different-id"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid")
				case strings.HasSuffix(r.URL.Path, "/authinfos"):
					writeJSON(t, w, iamv0alpha1.AuthInfoList{Items: []iamv0alpha1.AuthInfo{
						authInfoItem("user-uid.ldap", "user-uid", "ldap", "actual-id", created),
					}})
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			wantErrIs: user.ErrUserNotFound,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := newTestStore(t, tc.handler)
			result, err := store.GetAuthInfo(contextWithReqContext(7), tc.query)
			switch {
			case tc.wantErrIs != nil:
				require.ErrorIs(t, err, tc.wantErrIs)
			case tc.wantErr:
				require.Error(t, err)
			default:
				require.NoError(t, err)
				if tc.want != nil {
					assert.Equal(t, tc.want, result)
				}
				if tc.check != nil {
					tc.check(t, result)
				}
			}
		})
	}
}

func TestStore_GetUserAuthModules(t *testing.T) {
	created := time.Now()

	type testCase struct {
		name    string
		handler http.HandlerFunc
		want    []string
	}

	cases := []testCase{
		{
			name: "returns every module linked to the user",
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid")
				case strings.HasSuffix(r.URL.Path, "/authinfos"):
					writeJSON(t, w, iamv0alpha1.AuthInfoList{Items: []iamv0alpha1.AuthInfo{
						authInfoItem("user-uid.ldap", "user-uid", "ldap", "ldap-id", created),
						authInfoItem("user-uid.oauth-github", "user-uid", "oauth_github", "gh-id", created.Add(time.Hour)),
					}})
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			want: []string{"ldap", "oauth_github"},
		},
		{
			name: "returns an empty slice, not an error, when the user doesn't exist",
			handler: func(w http.ResponseWriter, r *http.Request) {
				if strings.Contains(r.URL.Path, "/users") {
					noUsersResponse(t, w)
					return
				}
				t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
			},
			want: []string{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := newTestStore(t, tc.handler)
			modules, err := store.GetUserAuthModules(contextWithReqContext(7), 42)
			require.NoError(t, err)
			assert.ElementsMatch(t, tc.want, modules)
		})
	}
}

func TestStore_GetUsersRecentlyUsedLabel(t *testing.T) {
	created := time.Now()

	type testCase struct {
		name    string
		userIDs []int64
		handler http.HandlerFunc
		want    map[int64]string
	}

	cases := []testCase{
		{
			name:    "returns the raw auth module for users that have auth info, using the most recent one",
			userIDs: []int64{1, 2},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					uid := "user-uid-1"
					if strings.Contains(r.URL.Query().Get("labelSelector"), "2") {
						uid = "user-uid-2"
					}
					usersResponse(t, w, uid)
				case strings.HasSuffix(r.URL.Path, "/authinfos"):
					if strings.Contains(r.URL.Query().Get("fieldSelector"), "user-uid-1") {
						writeJSON(t, w, iamv0alpha1.AuthInfoList{Items: []iamv0alpha1.AuthInfo{
							authInfoItem("user-uid-1.oauth_github", "user-uid-1", "oauth_github", "gh-1", created),
						}})
						return
					}
					writeJSON(t, w, iamv0alpha1.AuthInfoList{})
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			want: map[int64]string{1: "oauth_github"},
		},
		{
			name:    "empty map when no requested user has auth info",
			userIDs: []int64{1},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid-1")
				case strings.HasSuffix(r.URL.Path, "/authinfos"):
					writeJSON(t, w, iamv0alpha1.AuthInfoList{})
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
			want: map[int64]string{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := newTestStore(t, tc.handler)
			result, err := store.GetUsersRecentlyUsedLabel(contextWithReqContext(7), login.GetUserLabelsQuery{UserIDs: tc.userIDs})
			require.NoError(t, err)
			assert.Equal(t, tc.want, result)
		})
	}
}

func TestStore_SetAuthInfo(t *testing.T) {
	type testCase struct {
		name    string
		cmd     *login.SetAuthInfoCommand
		handler http.HandlerFunc
		wantErr bool
	}

	cases := []testCase{
		{
			name: "creates a new resource when UserUID is already known",
			cmd:  &login.SetAuthInfoCommand{UserId: 42, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "github-42", ExternalUID: "external-42"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					t.Fatalf("UserUID was already supplied on the command; the user lookup should be skipped")
				case r.Method == http.MethodPost:
					var obj iamv0alpha1.AuthInfo
					require.NoError(t, json.NewDecoder(r.Body).Decode(&obj))
					assert.Equal(t, "user-uid.oauth-github", obj.Name)
					assert.Equal(t, "org-7", obj.Namespace)
					assert.Equal(t, "user-uid", obj.Spec.UserRef.Name)
					assert.Equal(t, "github-42", obj.Spec.AuthID)
					require.NotNil(t, obj.Spec.ExternalUID)
					assert.Equal(t, "external-42", *obj.Spec.ExternalUID)
					require.NotNil(t, obj.Spec.Created)
					assert.WithinDuration(t, time.Now(), time.UnixMilli(*obj.Spec.Created), 10*time.Second)
					writeJSON(t, w, obj)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
		},
		{
			name: "resolves UserUID when not provided on the command",
			cmd:  &login.SetAuthInfoCommand{UserId: 42, AuthModule: "ldap", AuthId: "cn=test"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "resolved-uid")
				case r.Method == http.MethodPost:
					var obj iamv0alpha1.AuthInfo
					require.NoError(t, json.NewDecoder(r.Body).Decode(&obj))
					assert.Equal(t, "resolved-uid.ldap", obj.Name)
					writeJSON(t, w, obj)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
		},
		{
			name: "rejects a command carrying a real OAuth token",
			cmd:  &login.SetAuthInfoCommand{UserId: 42, UserUID: "user-uid", AuthModule: "oauth_github", OAuthToken: &oauth2.Token{AccessToken: "secret"}},
			handler: func(w http.ResponseWriter, r *http.Request) {
				t.Fatalf("no HTTP call should be made, got: %s %s", r.Method, r.URL.Path)
			},
			wantErr: true,
		},
		{
			// InvalidateOAuthTokens always passes a non-nil but all-empty
			// *oauth2.Token to clear any tokens. There's nothing to clear here
			// (AuthInfoSpec never had token fields), so this must be a no-op.
			name: "allows an empty OAuth token",
			cmd:  &login.SetAuthInfoCommand{UserId: 42, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "github-42", OAuthToken: &oauth2.Token{}},
			handler: func(w http.ResponseWriter, r *http.Request) {
				if r.Method == http.MethodPost {
					var obj iamv0alpha1.AuthInfo
					require.NoError(t, json.NewDecoder(r.Body).Decode(&obj))
					assert.Equal(t, "github-42", obj.Spec.AuthID)
					writeJSON(t, w, obj)
					return
				}
				t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
			},
		},
		{
			name: "falls back to update when the object already exists",
			cmd:  &login.SetAuthInfoCommand{UserId: 42, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "new-id", ExternalUID: "new-external"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch r.Method {
				case http.MethodPost:
					writeStatus(w, http.StatusConflict, metav1.StatusReasonAlreadyExists)
				case http.MethodGet:
					writeJSON(t, w, authInfoItem("user-uid.oauth-github", "user-uid", "oauth_github", "old-id", time.Now()))
				case http.MethodPut:
					var obj iamv0alpha1.AuthInfo
					require.NoError(t, json.NewDecoder(r.Body).Decode(&obj))
					assert.Equal(t, "new-id", obj.Spec.AuthID)
					require.NotNil(t, obj.Spec.ExternalUID)
					assert.Equal(t, "new-external", *obj.Spec.ExternalUID)
					writeJSON(t, w, obj)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := newTestStore(t, tc.handler)
			err := store.SetAuthInfo(contextWithReqContext(7), tc.cmd)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestStore_UpdateAuthInfo(t *testing.T) {
	type testCase struct {
		name    string
		cmd     *login.UpdateAuthInfoCommand
		handler http.HandlerFunc
		wantErr bool
	}

	cases := []testCase{
		{
			name: "updates authID and bumps Created",
			cmd:  &login.UpdateAuthInfoCommand{UserId: 42, AuthModule: "oauth_github", AuthId: "new-id"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid")
				case r.Method == http.MethodGet:
					writeJSON(t, w, authInfoItem("user-uid.oauth-github", "user-uid", "oauth_github", "old-id", time.Now().Add(-time.Hour)))
				case r.Method == http.MethodPut:
					var obj iamv0alpha1.AuthInfo
					require.NoError(t, json.NewDecoder(r.Body).Decode(&obj))
					assert.Equal(t, "new-id", obj.Spec.AuthID)
					require.NotNil(t, obj.Spec.Created)
					assert.WithinDuration(t, time.Now(), time.UnixMilli(*obj.Spec.Created), 10*time.Second)
					writeJSON(t, w, obj)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
		},
		{
			name: "leaves an existing externalUID untouched when the command doesn't set one",
			cmd:  &login.UpdateAuthInfoCommand{UserId: 42, AuthModule: "oauth_github", AuthId: "new-id"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid")
				case r.Method == http.MethodGet:
					existingExternalUID := "scim-correlation-id"
					item := authInfoItem("user-uid.oauth-github", "user-uid", "oauth_github", "old-id", time.Now())
					item.Spec.ExternalUID = &existingExternalUID
					writeJSON(t, w, item)
				case r.Method == http.MethodPut:
					var obj iamv0alpha1.AuthInfo
					require.NoError(t, json.NewDecoder(r.Body).Decode(&obj))
					assert.Equal(t, "new-id", obj.Spec.AuthID)
					require.NotNil(t, obj.Spec.ExternalUID)
					assert.Equal(t, "scim-correlation-id", *obj.Spec.ExternalUID)
					writeJSON(t, w, obj)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
		},
		{
			name: "updates externalUID when the command sets one",
			cmd:  &login.UpdateAuthInfoCommand{UserId: 42, AuthModule: "auth.saml", ExternalUID: "new-scim-id"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid")
				case r.Method == http.MethodGet:
					writeJSON(t, w, authInfoItem("user-uid.auth.saml", "user-uid", "auth.saml", "", time.Now()))
				case r.Method == http.MethodPut:
					var obj iamv0alpha1.AuthInfo
					require.NoError(t, json.NewDecoder(r.Body).Decode(&obj))
					require.NotNil(t, obj.Spec.ExternalUID)
					assert.Equal(t, "new-scim-id", *obj.Spec.ExternalUID)
					writeJSON(t, w, obj)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
		},
		{
			name: "rejects a command carrying a real OAuth token",
			cmd:  &login.UpdateAuthInfoCommand{UserId: 42, AuthModule: "oauth_github", OAuthToken: &oauth2.Token{AccessToken: "secret"}},
			handler: func(w http.ResponseWriter, r *http.Request) {
				t.Fatalf("no HTTP call should be made, got: %s %s", r.Method, r.URL.Path)
			},
			wantErr: true,
		},
		{
			// Mirrors SetAuthInfo's "allows an empty OAuth token" case for
			// InvalidateOAuthTokens' UpdateAuthInfo call.
			name: "allows an empty OAuth token",
			cmd:  &login.UpdateAuthInfoCommand{UserId: 42, AuthModule: "oauth_github", AuthId: "new-id", OAuthToken: &oauth2.Token{}},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid")
				case r.Method == http.MethodGet:
					writeJSON(t, w, authInfoItem("user-uid.oauth-github", "user-uid", "oauth_github", "old-id", time.Now()))
				case r.Method == http.MethodPut:
					var obj iamv0alpha1.AuthInfo
					require.NoError(t, json.NewDecoder(r.Body).Decode(&obj))
					assert.Equal(t, "new-id", obj.Spec.AuthID)
					writeJSON(t, w, obj)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
		},
		{
			name: "user not found is a no-op",
			cmd:  &login.UpdateAuthInfoCommand{UserId: 42, AuthModule: "oauth_github", AuthId: "new-id"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				if strings.Contains(r.URL.Path, "/users") {
					noUsersResponse(t, w)
					return
				}
				t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
			},
		},
		{
			name: "object not found is a no-op",
			cmd:  &login.UpdateAuthInfoCommand{UserId: 42, AuthModule: "oauth_github", AuthId: "new-id"},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid")
				case r.Method == http.MethodGet:
					writeStatus(w, http.StatusNotFound, metav1.StatusReasonNotFound)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := newTestStore(t, tc.handler)
			err := store.UpdateAuthInfo(contextWithReqContext(7), tc.cmd)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestStore_DeleteUserAuthInfo(t *testing.T) {
	type testCase struct {
		name    string
		handler http.HandlerFunc
		wantErr bool
		check   func(t *testing.T)
	}

	cases := []testCase{
		// Scoped in a builder so `deleted` is captured fresh per case, since it
		// accumulates across the multiple DELETE requests one call makes.
		func() testCase {
			var deleted []string
			return testCase{
				name: "deletes every module linked to the user",
				handler: func(w http.ResponseWriter, r *http.Request) {
					switch {
					case strings.Contains(r.URL.Path, "/users"):
						usersResponse(t, w, "user-uid")
					case r.Method == http.MethodDelete:
						deleted = append(deleted, r.URL.Path)
						w.WriteHeader(http.StatusOK)
					case strings.HasSuffix(r.URL.Path, "/authinfos"):
						writeJSON(t, w, iamv0alpha1.AuthInfoList{Items: []iamv0alpha1.AuthInfo{
							{ObjectMeta: metav1.ObjectMeta{Name: "user-uid.oauth-github"}},
							{ObjectMeta: metav1.ObjectMeta{Name: "user-uid.ldap"}},
						}})
					default:
						t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
					}
				},
				check: func(t *testing.T) {
					assert.ElementsMatch(t, []string{
						"/apis/iam.grafana.app/v0alpha1/namespaces/org-7/authinfos/user-uid.oauth-github",
						"/apis/iam.grafana.app/v0alpha1/namespaces/org-7/authinfos/user-uid.ldap",
					}, deleted)
				},
			}
		}(),
		{
			name: "user not found is a no-op",
			handler: func(w http.ResponseWriter, r *http.Request) {
				if strings.Contains(r.URL.Path, "/users") {
					noUsersResponse(t, w)
					return
				}
				t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := newTestStore(t, tc.handler)
			err := store.DeleteUserAuthInfo(contextWithReqContext(7), 42)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			if tc.check != nil {
				tc.check(t)
			}
		})
	}
}

func TestStore_DeleteAuthInfo(t *testing.T) {
	type testCase struct {
		name    string
		cmd     *login.DeleteAuthInfoCommand
		handler http.HandlerFunc
		wantErr bool
		check   func(t *testing.T)
	}

	cases := []testCase{
		func() testCase {
			var deleted string
			return testCase{
				name: "deletes only the named module",
				cmd:  &login.DeleteAuthInfoCommand{UserAuth: &login.UserAuth{UserId: 42, AuthModule: "oauth_github"}},
				handler: func(w http.ResponseWriter, r *http.Request) {
					switch {
					case strings.Contains(r.URL.Path, "/users"):
						usersResponse(t, w, "user-uid")
					case r.Method == http.MethodDelete:
						deleted = r.URL.Path
						w.WriteHeader(http.StatusOK)
					default:
						t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
					}
				},
				check: func(t *testing.T) {
					assert.Equal(t, "/apis/iam.grafana.app/v0alpha1/namespaces/org-7/authinfos/user-uid.oauth-github", deleted)
				},
			}
		}(),
		{
			name: "user not found is a no-op",
			cmd:  &login.DeleteAuthInfoCommand{UserAuth: &login.UserAuth{UserId: 42, AuthModule: "oauth_github"}},
			handler: func(w http.ResponseWriter, r *http.Request) {
				if strings.Contains(r.URL.Path, "/users") {
					noUsersResponse(t, w)
					return
				}
				t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
			},
		},
		{
			name: "object not found is a no-op",
			cmd:  &login.DeleteAuthInfoCommand{UserAuth: &login.UserAuth{UserId: 42, AuthModule: "oauth_github"}},
			handler: func(w http.ResponseWriter, r *http.Request) {
				switch {
				case strings.Contains(r.URL.Path, "/users"):
					usersResponse(t, w, "user-uid")
				case r.Method == http.MethodDelete:
					writeStatus(w, http.StatusNotFound, metav1.StatusReasonNotFound)
				default:
					t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := newTestStore(t, tc.handler)
			err := store.DeleteAuthInfo(contextWithReqContext(7), tc.cmd)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			if tc.check != nil {
				tc.check(t)
			}
		})
	}
}
