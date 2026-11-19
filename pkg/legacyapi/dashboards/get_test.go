package dashboards

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/legacyapi/internal/apis"
)

const testNS = "stacks-1"

var (
	testCreated = time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	testUpdated = testCreated.Add(time.Hour)
)

// signedIDToken returns an ID token with the given claims, signed with a
// throwaway key.
func signedIDToken(t *testing.T, claims authn.IDTokenClaims) string {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, (&jose.SignerOptions{}).WithType("jwt"))
	require.NoError(t, err)

	token, err := jwt.Signed(signer).
		Claims(jwt.Claims{Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))}).
		Claims(claims).
		Serialize()
	require.NoError(t, err)
	return token
}

type apiResponse struct {
	status int
	body   any
}

// fakeAPIs serves the dashboard, folder and IAM APIs from fixed responses,
// and records the headers of each request.
type fakeAPIs struct {
	mu        sync.Mutex
	responses map[string]apiResponse
	headers   map[string]http.Header
}

func (f *fakeAPIs) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.EscapedPath()
	f.mu.Lock()
	f.headers[path] = r.Header.Clone()
	rsp, ok := f.responses[path]
	f.mu.Unlock()

	if !ok {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"kind":"Status","code":404}`))
		return
	}
	w.WriteHeader(rsp.status)
	_ = json.NewEncoder(w).Encode(rsp.body)
}

func (f *fakeAPIs) header(path string) http.Header {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.headers[path]
}

type fakeExchanger struct {
	mu   sync.Mutex
	reqs []authn.TokenExchangeRequest
}

func (f *fakeExchanger) Exchange(_ context.Context, r authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.reqs = append(f.reqs, r)
	return &authn.TokenExchangeResponse{Token: "service-token"}, nil
}

func dtoPath(version, uid string) string {
	return "/apis/dashboard.grafana.app/" + version + "/namespaces/" + testNS + "/dashboards/" + uid + "/dto"
}

func folderPath(uid string) string {
	return "/apis/folder.grafana.app/v1beta1/namespaces/" + testNS + "/folders/" + uid
}

func iamPath(resource, uid string) string {
	return "/apis/iam.grafana.app/v0alpha1/namespaces/" + testNS + "/" + resource + "/" + uid
}

type dtoOpts struct {
	version   string
	spec      map[string]any
	folder    string
	createdBy string
	updatedBy string
	manager   *utils.ManagerProperties
	source    *utils.SourceProperties
	status    map[string]any
}

func newDTO(t *testing.T, o dtoOpts) map[string]any {
	t.Helper()
	if o.version == "" {
		o.version = "v0alpha1"
	}
	if o.spec == nil {
		o.spec = map[string]any{"title": "My Dashboard", "schemaVersion": int64(41)}
	}

	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "dashboard.grafana.app/" + o.version,
		"kind":       "DashboardWithAccessInfo",
		"metadata": map[string]any{
			"name":       "abc",
			"namespace":  testNS,
			"generation": int64(3),
		},
		"spec": o.spec,
		"access": map[string]any{
			"slug":     "my-dashboard",
			"url":      "/d/abc/my-dashboard",
			"isPublic": false,
			"canSave":  true, "canEdit": true, "canAdmin": false, "canStar": true, "canDelete": true,
			"annotationsPermissions": map[string]any{
				"dashboard": map[string]any{"canAdd": true, "canEdit": false, "canDelete": true},
			},
		},
	}}
	if o.status != nil {
		obj.Object["status"] = o.status
	}

	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetCreationTimestamp(metav1.NewTime(testCreated))
	meta.SetUpdatedTimestamp(&testUpdated)
	meta.SetDeprecatedInternalID(42) // nolint:staticcheck
	meta.SetFolder(o.folder)
	meta.SetCreatedBy(o.createdBy)
	meta.SetUpdatedBy(o.updatedBy)
	if o.manager != nil {
		meta.SetManagerProperties(*o.manager)
	}
	if o.source != nil {
		meta.SetSourceProperties(*o.source)
	}
	return obj.Object
}

func newFolder(t *testing.T, uid, title string) map[string]any {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "folder.grafana.app/v1beta1",
		"kind":       "Folder",
		"metadata":   map[string]any{"name": uid, "namespace": testNS},
		"spec":       map[string]any{"title": title},
	}}
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetDeprecatedInternalID(7) // nolint:staticcheck
	return obj.Object
}

func newIAMObject(kind, uid string, spec map[string]any) map[string]any {
	return map[string]any{
		"apiVersion": "iam.grafana.app/v0alpha1",
		"kind":       kind,
		"metadata":   map[string]any{"name": uid, "namespace": testNS},
		"spec":       spec,
	}
}

type testEnv struct {
	apis      *fakeAPIs
	exchanger *fakeExchanger
	handler   http.Handler
	idToken   string
}

func newTestEnv(t *testing.T, responses map[string]apiResponse) *testEnv {
	t.Helper()
	fake := &fakeAPIs{responses: responses, headers: map[string]http.Header{}}
	srv := httptest.NewServer(fake)
	t.Cleanup(srv.Close)

	client := apis.NewClient(srv.URL, srv.Client())
	exchanger := &fakeExchanger{}
	return &testEnv{
		apis:      fake,
		exchanger: exchanger,
		handler: &GetHandler{
			Dashboards:     client,
			Folders:        client,
			IAM:            client,
			TokenExchanger: exchanger,
		},
		idToken: signedIDToken(t, authn.IDTokenClaims{Namespace: testNS, Type: types.TypeUser, Identifier: "requester"}),
	}
}

func (e *testEnv) get(t *testing.T, path string) *httptest.ResponseRecorder {
	t.Helper()
	return e.getWithToken(t, path, e.idToken)
}

func (e *testEnv) getWithToken(t *testing.T, path, idToken string) *httptest.ResponseRecorder {
	t.Helper()
	mux := http.NewServeMux()
	mux.Handle("GET /api/dashboards/uid/{uid}", e.handler)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil)
	req.Header.Set("X-Access-Token", "user-access-token")
	if idToken != "" {
		req.Header.Set("X-Grafana-Id", idToken)
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func decodeResponse(t *testing.T, rec *httptest.ResponseRecorder) DashboardWithMeta {
	t.Helper()
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	var out DashboardWithMeta
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

func TestGetHandler(t *testing.T) {
	t.Run("builds the legacy response", func(t *testing.T) {
		env := newTestEnv(t, map[string]apiResponse{
			dtoPath("v0alpha1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{
				folder:    "f1",
				createdBy: "user:u1",
				updatedBy: "service-account:sa1",
				manager:   &utils.ManagerProperties{Kind: utils.ManagerKindClassicFP, Identity: "prov"}, // nolint:staticcheck
				source:    &utils.SourceProperties{Path: "/etc/dashboards/abc.json"},
			})},
			folderPath("f1"):                  {http.StatusOK, newFolder(t, "f1", "Folder One")},
			iamPath("users", "u1"):            {http.StatusOK, newIAMObject("User", "u1", map[string]any{"login": "creator", "title": "Creator"})},
			iamPath("serviceaccounts", "sa1"): {http.StatusOK, newIAMObject("ServiceAccount", "sa1", map[string]any{"title": "my-sa"})},
		})

		out := decodeResponse(t, env.get(t, "/api/dashboards/uid/abc"))

		assert.True(t, testCreated.Equal(out.Meta.Created))
		assert.True(t, testUpdated.Equal(out.Meta.Updated))
		out.Meta.Created, out.Meta.Updated = time.Time{}, time.Time{}
		assert.Equal(t, Meta{
			Type:                   "db",
			CanSave:                true,
			CanEdit:                true,
			CanStar:                true,
			CanDelete:              true,
			Slug:                   "my-dashboard",
			Url:                    "/d/abc/my-dashboard",
			UpdatedBy:              "my-sa",
			CreatedBy:              "creator",
			Version:                3,
			APIVersion:             "v0alpha1",
			FolderId:               7,
			FolderUid:              "f1",
			FolderTitle:            "Folder One",
			FolderUrl:              "/dashboards/f/f1/folder-one",
			Provisioned:            true,
			ProvisionedExternalId:  "/etc/dashboards/abc.json",
			AnnotationsPermissions: &dashboardv1.AnnotationPermission{Dashboard: dashboardv1.AnnotationActions{CanAdd: true, CanDelete: true}},
		}, out.Meta)
		assert.Equal(t, map[string]any{
			"id":            float64(42),
			"uid":           "abc",
			"title":         "My Dashboard",
			"schemaVersion": float64(41),
			"version":       float64(3),
		}, out.Dashboard)

		for _, path := range []string{dtoPath("v0alpha1", "abc"), folderPath("f1")} {
			h := env.apis.header(path)
			assert.Equal(t, "user-access-token", h.Get("X-Access-Token"), path)
			assert.Equal(t, env.idToken, h.Get("X-Grafana-Id"), path)
		}
		for _, path := range []string{iamPath("users", "u1"), iamPath("serviceaccounts", "sa1")} {
			h := env.apis.header(path)
			assert.Equal(t, "service-token", h.Get("X-Access-Token"), path)
			assert.Empty(t, h.Values("X-Grafana-Id"), path)
		}
		require.NotEmpty(t, env.exchanger.reqs)
		assert.Equal(t, authn.TokenExchangeRequest{Namespace: testNS, Audiences: []string{"iam.grafana.app"}}, env.exchanger.reqs[0])
	})

	t.Run("dashboard in the root folder", func(t *testing.T) {
		env := newTestEnv(t, map[string]apiResponse{
			dtoPath("v0alpha1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{})},
		})

		out := decodeResponse(t, env.get(t, "/api/dashboards/uid/abc"))
		assert.Equal(t, "General", out.Meta.FolderTitle)
		assert.Equal(t, "", out.Meta.FolderUid)
		assert.Equal(t, "Anonymous", out.Meta.CreatedBy)
		assert.Equal(t, "Anonymous", out.Meta.UpdatedBy)
		assert.False(t, out.Meta.Provisioned)
	})

	t.Run("provisioner that allows UI updates", func(t *testing.T) {
		env := newTestEnv(t, map[string]apiResponse{
			dtoPath("v0alpha1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{
				manager: &utils.ManagerProperties{Kind: utils.ManagerKindClassicFP, Identity: "prov", AllowsEdits: true}, // nolint:staticcheck
				source:  &utils.SourceProperties{Path: "abc.json"},
			})},
		})

		out := decodeResponse(t, env.get(t, "/api/dashboards/uid/abc"))
		assert.False(t, out.Meta.Provisioned)
		assert.Equal(t, "abc.json", out.Meta.ProvisionedExternalId)
	})

	t.Run("names that cannot be resolved are Anonymous", func(t *testing.T) {
		env := newTestEnv(t, map[string]apiResponse{
			dtoPath("v0alpha1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{createdBy: "user:gone", updatedBy: "user:12"})},
		})

		out := decodeResponse(t, env.get(t, "/api/dashboards/uid/abc"))
		assert.Equal(t, "Anonymous", out.Meta.CreatedBy)
		assert.Equal(t, "Anonymous", out.Meta.UpdatedBy)
	})

	t.Run("anonymous requester cannot star", func(t *testing.T) {
		env := newTestEnv(t, map[string]apiResponse{
			dtoPath("v0alpha1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{})},
		})
		token := signedIDToken(t, authn.IDTokenClaims{Namespace: testNS, Type: types.TypeAnonymous, Identifier: "0"})

		out := decodeResponse(t, env.getWithToken(t, "/api/dashboards/uid/abc", token))
		assert.False(t, out.Meta.CanStar)
	})

	t.Run("requested API version", func(t *testing.T) {
		env := newTestEnv(t, map[string]apiResponse{
			dtoPath("v2beta1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{version: "v2beta1"})},
		})

		out := decodeResponse(t, env.get(t, "/api/dashboards/uid/abc?apiVersion=v2beta1"))
		assert.Equal(t, "v2beta1", out.Meta.APIVersion)
	})

	t.Run("invalid requested API version uses the default", func(t *testing.T) {
		env := newTestEnv(t, map[string]apiResponse{
			dtoPath("v0alpha1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{})},
		})

		out := decodeResponse(t, env.get(t, "/api/dashboards/uid/abc?apiVersion=../../x"))
		assert.Equal(t, "v0alpha1", out.Meta.APIVersion)
	})

	t.Run("refetches at the stored version when conversion failed", func(t *testing.T) {
		env := newTestEnv(t, map[string]apiResponse{
			dtoPath("v0alpha1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{status: map[string]any{
				"conversion": map[string]any{"failed": true, "storedVersion": "v2beta1"},
			}})},
			dtoPath("v2beta1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{
				version: "v2beta1",
				spec:    map[string]any{"title": "My Dashboard", "elements": map[string]any{}},
			})},
		})

		out := decodeResponse(t, env.get(t, "/api/dashboards/uid/abc"))
		assert.Equal(t, "v2beta1", out.Meta.APIVersion)
		assert.Contains(t, out.Dashboard, "elements")
	})

	t.Run("folder the requester cannot read", func(t *testing.T) {
		env := newTestEnv(t, map[string]apiResponse{
			dtoPath("v0alpha1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{folder: "f1"})},
			folderPath("f1"):           {http.StatusForbidden, map[string]any{"kind": "Status"}},
		})

		out := decodeResponse(t, env.get(t, "/api/dashboards/uid/abc"))
		assert.Equal(t, "f1", out.Meta.FolderUid)
		assert.Equal(t, "", out.Meta.FolderTitle)
		assert.Equal(t, "/dashboards/f/f1/da39a3e", out.Meta.FolderUrl, "single-tenant Grafana slugifies the empty title")
		assert.Equal(t, int64(0), out.Meta.FolderId)
	})

	errCases := []struct {
		name      string
		responses map[string]apiResponse
		idToken   *string
		status    int
		body      string
	}{
		{
			name:    "missing ID token",
			idToken: new(string),
			status:  http.StatusUnauthorized,
			body:    `{"message":"Unauthorized"}`,
		},
		{
			name:   "dashboard not found",
			status: http.StatusNotFound,
			body:   `{"message":"Dashboard not found"}`,
		},
		{
			name: "folder not found",
			responses: map[string]apiResponse{
				dtoPath("v0alpha1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{folder: "f1"})},
			},
			status: http.StatusNotFound,
			body:   `{"message":"Folder not found"}`,
		},
		{
			name: "folder lookup fails",
			responses: map[string]apiResponse{
				dtoPath("v0alpha1", "abc"): {http.StatusOK, newDTO(t, dtoOpts{folder: "f1"})},
				folderPath("f1"):           {http.StatusInternalServerError, map[string]any{"kind": "Status"}},
			},
			status: http.StatusInternalServerError,
			body:   `{"message":"Dashboard folder could not be read"}`,
		},
	}
	for _, tc := range errCases {
		t.Run(tc.name, func(t *testing.T) {
			env := newTestEnv(t, tc.responses)
			token := env.idToken
			if tc.idToken != nil {
				token = *tc.idToken
			}

			rec := env.getWithToken(t, "/api/dashboards/uid/abc", token)
			assert.Equal(t, tc.status, rec.Code)
			assert.JSONEq(t, tc.body, rec.Body.String())
		})
	}

	t.Run("dashboard the requester cannot read", func(t *testing.T) {
		env := newTestEnv(t, map[string]apiResponse{
			dtoPath("v0alpha1", "abc"): {http.StatusForbidden, map[string]any{"kind": "Status"}},
		})

		rec := env.get(t, "/api/dashboards/uid/abc")
		require.Equal(t, http.StatusForbidden, rec.Code)
		var body map[string]string
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
		assert.Equal(t, "Access denied", body["title"])
		assert.Equal(t, "You'll need additional permissions to perform this action. Permissions needed: dashboards:read", body["message"])
		assert.Regexp(t, `^ACE\d{10}$`, body["accessErrorId"])
	})

	t.Run("escapes the uid", func(t *testing.T) {
		env := newTestEnv(t, nil)
		rec := env.get(t, "/api/dashboards/uid/a%2Fb")
		assert.Equal(t, http.StatusNotFound, rec.Code)
		require.NotNil(t, env.apis.header(dtoPath("v0alpha1", "a%2Fb")))
		for path := range env.apis.headers {
			assert.False(t, strings.Contains(path, "/dashboards/a/b/"), path)
		}
	})
}
