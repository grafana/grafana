package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1beta1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

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
