package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1beta1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

func TestCreateKubernetesShortURLsHandler(t *testing.T) {
	const validUID = "abcdef1234"
	const requestBody = `{"path":"explore"}`

	tests := []struct {
		name      string
		stackID   string
		orgID     int64
		namespace string
		appURL    string
		wantURL   string
	}{
		{
			name:      "default namespace uses the active organization ID",
			orgID:     1,
			namespace: "default",
			appURL:    "http://localhost:3000/",
			wantURL:   "http://localhost:3000/goto/abcdef1234?orgId=1",
		},
		{
			name:      "organization namespace uses the active organization ID and preserves subpath",
			orgID:     5,
			namespace: "org-5",
			appURL:    "https://grafana.example.com/grafana/",
			wantURL:   "https://grafana.example.com/grafana/goto/abcdef1234?orgId=5",
		},
		{
			name:      "resource namespace cannot override the active organization ID",
			orgID:     5,
			namespace: "org-999",
			appURL:    "https://grafana.example.com/",
			wantURL:   "https://grafana.example.com/goto/abcdef1234?orgId=5",
		},
		{
			name:      "cloud namespace omits populated organization ID",
			stackID:   "123",
			orgID:     1,
			namespace: "stacks-123",
			appURL:    "https://grafana.example.com/",
			wantURL:   "https://grafana.example.com/goto/abcdef1234",
		},
		{
			name:      "cloud namespace omits missing organization ID",
			stackID:   "123",
			orgID:     0,
			namespace: "stacks-123",
			appURL:    "https://grafana.example.com/",
			wantURL:   "https://grafana.example.com/goto/abcdef1234",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.AppURL = tt.appURL
			cfg.StackID = tt.stackID

			responseBody := mustMarshal(t, v1beta1.ShortURL{
				TypeMeta: metav1.TypeMeta{
					APIVersion: v1beta1.APIGroup + "/" + v1beta1.APIVersion,
					Kind:       "ShortURL",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:      validUID,
					Namespace: tt.namespace,
				},
				Spec: v1beta1.ShortURLSpec{Path: "explore"},
			})

			handler := &shortURLK8sHandler{
				gvr:        v1beta1.ShortURLKind().GroupVersionResource(),
				namespacer: request.GetNamespaceMapper(cfg),
				clientConfigProvider: &mockDirectRestConfigProvider{
					host:      "http://localhost",
					transport: &mockRoundTripper{statusCode: http.StatusCreated, responseBody: responseBody},
				},
				cfg: cfg,
			}

			ctx, recorder := newTestContext(t, http.MethodPost, "/api/short-urls", nil)
			ctx.OrgID = tt.orgID
			ctx.Req.Body = io.NopCloser(strings.NewReader(requestBody))
			ctx.Req.ContentLength = int64(len(requestBody))

			handler.createKubernetesShortURLsHandler(ctx)

			require.Equal(t, http.StatusOK, recorder.Code)
			var got dtos.ShortURL
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &got))
			require.Equal(t, validUID, got.UID)
			require.Equal(t, tt.wantURL, got.URL)
		})
	}
}

func TestGetKubernetesRedirectFromShortURL(t *testing.T) {
	const appURL = "http://localhost:3000/"
	const validUID = "abcdef1234"

	tests := []struct {
		name         string
		uid          string
		statusCode   int
		responseBody []byte
		wantStatus   int
		wantLocation string
	}{
		{
			name:         "invalid uid redirects to AppURL with 308",
			uid:          "!!!invalid",
			wantStatus:   http.StatusPermanentRedirect,
			wantLocation: appURL,
		},
		{
			name:         "happy path redirects to goto Url with 302",
			uid:          validUID,
			statusCode:   http.StatusOK,
			responseBody: mustMarshal(t, v1beta1.GetGotoResponse{Url: appURL + "explore"}),
			wantStatus:   http.StatusFound,
			wantLocation: appURL + "explore",
		},
		{
			name:       "ShortURL resource not found redirects to AppURL with 308",
			uid:        validUID,
			statusCode: http.StatusNotFound,
			responseBody: mustMarshal(t, metav1.Status{
				TypeMeta: metav1.TypeMeta{Kind: "Status", APIVersion: "v1"},
				Status:   metav1.StatusFailure,
				Reason:   metav1.StatusReasonNotFound,
				Code:     http.StatusNotFound,
				Details: &metav1.StatusDetails{
					Group: v1beta1.APIGroup,
					Kind:  v1beta1.ShortURLKind().Plural(),
					Name:  validUID,
				},
			}),
			wantStatus:   http.StatusPermanentRedirect,
			wantLocation: appURL,
		},
		{
			name:       "404 from unrelated resource (e.g. missing CRD) redirects to AppURL with 307",
			uid:        validUID,
			statusCode: http.StatusNotFound,
			responseBody: mustMarshal(t, metav1.Status{
				TypeMeta: metav1.TypeMeta{Kind: "Status", APIVersion: "v1"},
				Status:   metav1.StatusFailure,
				Reason:   metav1.StatusReasonNotFound,
				Code:     http.StatusNotFound,
				Details: &metav1.StatusDetails{
					Group: "other.grafana.app",
					Kind:  "widgets",
					Name:  validUID,
				},
			}),
			wantStatus:   http.StatusTemporaryRedirect,
			wantLocation: appURL,
		},
		{
			name:         "server error redirects to AppURL with 307",
			uid:          validUID,
			statusCode:   http.StatusInternalServerError,
			responseBody: mustMarshal(t, metav1.Status{Status: metav1.StatusFailure, Reason: metav1.StatusReasonInternalError, Code: http.StatusInternalServerError}),
			wantStatus:   http.StatusTemporaryRedirect,
			wantLocation: appURL,
		},
		{
			name:         "unmarshalable response redirects to AppURL with 307",
			uid:          validUID,
			statusCode:   http.StatusOK,
			responseBody: []byte("not json"),
			wantStatus:   http.StatusTemporaryRedirect,
			wantLocation: appURL,
		},
		{
			name:         "empty url in response redirects to AppURL with 307",
			uid:          validUID,
			statusCode:   http.StatusOK,
			responseBody: mustMarshal(t, v1beta1.GetGotoResponse{Url: ""}),
			wantStatus:   http.StatusTemporaryRedirect,
			wantLocation: appURL,
		},
		{
			name:         "external host in response redirects to AppURL with 302",
			uid:          validUID,
			statusCode:   http.StatusOK,
			responseBody: mustMarshal(t, v1beta1.GetGotoResponse{Url: "http://attacker.example.com/explore"}),
			wantStatus:   http.StatusFound,
			wantLocation: appURL,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.AppURL = appURL

			handler := &shortURLK8sHandler{
				gvr:        v1beta1.ShortURLKind().GroupVersionResource(),
				namespacer: request.GetNamespaceMapper(cfg),
				clientConfigProvider: &mockDirectRestConfigProvider{
					host:      "http://localhost",
					transport: &mockRoundTripper{statusCode: tt.statusCode, responseBody: tt.responseBody},
				},
				cfg: cfg,
			}

			ctx, recorder := newTestContext(t, http.MethodGet, "/goto/"+tt.uid, map[string]string{":uid": tt.uid})
			handler.getKubernetesRedirectFromShortURL(ctx)

			assert.Equal(t, tt.wantStatus, recorder.Code)
			assert.Equal(t, tt.wantLocation, recorder.Header().Get("Location"))
		})
	}
}

func mustMarshal(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return b
}
