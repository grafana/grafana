package api

// This file covers the deprecated legacy /api/short-urls endpoints. Delete it
// together with the handlers when the deprecation period ends. Tests for
// /goto/:uid, which is not deprecated, live in short_url_k8s_test.go.

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1beta1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

// Both legacy endpoints are deprecated, but each verb has a different
// replacement: creation maps to the collection (POST), get-by-uid maps to the
// single resource. Getting this wrong points integrators at an admin-only list
// endpoint. /goto is a user-facing redirect and is not deprecated at all.
func TestShortURLDeprecationHeaders(t *testing.T) {
	const appURL = "http://localhost:3000/"
	const validUID = "abcdef1234"
	const wantWarning = `299 - "Deprecated API: use the Grafana App Platform Short URL API instead."`
	const wantCollectionPath = "/apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls"

	newHandler := func(statusCode int, responseBody []byte) *shortURLK8sHandler {
		cfg := setting.NewCfg()
		cfg.AppURL = appURL

		return &shortURLK8sHandler{
			gvr:        v1beta1.ShortURLKind().GroupVersionResource(),
			namespacer: request.GetNamespaceMapper(cfg),
			clientConfigProvider: &mockDirectRestConfigProvider{
				host:      "http://localhost",
				transport: &mockRoundTripper{statusCode: statusCode, responseBody: responseBody},
			},
			cfg: cfg,
		}
	}

	shortURLObject := mustMarshal(t, map[string]any{
		"apiVersion": v1beta1.APIGroup + "/" + v1beta1.APIVersion,
		"kind":       v1beta1.ShortURLKind().Kind(),
		"metadata": map[string]any{
			"name":      validUID,
			"namespace": "default",
		},
		"spec": map[string]any{"path": "d/abcdef/my-dashboard?orgId=1"},
	})

	t.Run("POST /api/short-urls advertises the collection endpoint", func(t *testing.T) {
		handler := newHandler(http.StatusOK, shortURLObject)
		ctx, recorder := newTestContext(t, http.MethodPost, "/api/short-urls", nil)
		ctx.Req.Body = mockRequestBody(dtos.CreateShortURLCmd{Path: "d/abcdef/my-dashboard?orgId=1"})

		handler.createKubernetesShortURLsHandler(ctx)

		require.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, wantWarning, recorder.Header().Get("Warning"))
		assert.Equal(t, "2026-09-14", recorder.Header().Get("X-API-Deprecation-Date"))
		assert.Equal(t, wantCollectionPath, recorder.Header().Get("X-API-Replacement"))
	})

	t.Run("GET /api/short-urls/:uid advertises the single-resource endpoint", func(t *testing.T) {
		handler := newHandler(http.StatusOK, shortURLObject)
		ctx, recorder := newTestContext(t, http.MethodGet, "/api/short-urls/"+validUID, map[string]string{":uid": validUID})

		handler.getKubernetesShortURLsHandler(ctx)

		require.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, wantWarning, recorder.Header().Get("Warning"))
		assert.Equal(t, "2026-09-14", recorder.Header().Get("X-API-Deprecation-Date"))
		assert.Equal(t, wantCollectionPath+"/"+validUID, recorder.Header().Get("X-API-Replacement"))
	})

	t.Run("GET /api/short-urls/:uid advertises the replacement even when the request fails", func(t *testing.T) {
		handler := newHandler(http.StatusNotFound, mustMarshal(t, metav1.Status{
			TypeMeta: metav1.TypeMeta{Kind: "Status", APIVersion: "v1"},
			Status:   metav1.StatusFailure,
			Reason:   metav1.StatusReasonNotFound,
			Code:     http.StatusNotFound,
		}))
		ctx, recorder := newTestContext(t, http.MethodGet, "/api/short-urls/"+validUID, map[string]string{":uid": validUID})

		handler.getKubernetesShortURLsHandler(ctx)

		require.Equal(t, http.StatusNotFound, recorder.Code)
		assert.Equal(t, wantCollectionPath+"/"+validUID, recorder.Header().Get("X-API-Replacement"))
	})

	t.Run("GET /goto/:uid is not deprecated", func(t *testing.T) {
		handler := newHandler(http.StatusOK, mustMarshal(t, v1beta1.GetGotoResponse{Url: appURL + "explore"}))
		ctx, recorder := newTestContext(t, http.MethodGet, "/goto/"+validUID, map[string]string{":uid": validUID})

		handler.getKubernetesRedirectFromShortURL(ctx)

		require.Equal(t, http.StatusFound, recorder.Code)
		assert.Empty(t, recorder.Header().Get("Warning"))
		assert.Empty(t, recorder.Header().Get("X-API-Deprecation-Date"))
		assert.Empty(t, recorder.Header().Get("X-API-Replacement"))
	})
}
