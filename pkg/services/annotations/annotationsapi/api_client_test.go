package annotationsapi

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeTokenExchanger struct {
	gotRequest authnlib.TokenExchangeRequest
}

func (f *fakeTokenExchanger) Exchange(_ context.Context, r authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	f.gotRequest = r
	return &authnlib.TokenExchangeResponse{Token: "signed-token"}, nil
}

type stubRoundTripper struct {
	gotToken       string
	gotTraceparent string
}

func (s *stubRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	s.gotToken = req.Header.Get("X-Access-Token")
	s.gotTraceparent = req.Header.Get("traceparent")
	return &http.Response{StatusCode: http.StatusOK, Body: http.NoBody}, nil
}

func TestNewAnnotationAPIClient_TokenExchange(t *testing.T) {
	tests := []struct {
		name          string
		stackID       string
		requester     *identity.StaticRequester
		wantNamespace string
		wantSubject   *authnlib.TokenExchangeSubject
		wantErr       bool
	}{
		{
			name:          "scopes to stack namespace and asserts the user on behalf of",
			stackID:       "123",
			requester:     &identity.StaticRequester{Type: claims.TypeUser, UserID: 42, UserUID: "user-uid", OrgID: 1},
			wantNamespace: "stacks-123",
			wantSubject:   &authnlib.TokenExchangeSubject{Sub: "user:42", Identifier: "user-uid", Type: "user", Namespace: "stacks-123"},
		},
		{
			name:          "scopes to the default namespace when stackID is not set and orgID is 1",
			requester:     &identity.StaticRequester{Type: claims.TypeUser, UserID: 42, UserUID: "user-uid", OrgID: 1},
			wantNamespace: "default",
			wantSubject:   &authnlib.TokenExchangeSubject{Sub: "user:42", Identifier: "user-uid", Type: "user", Namespace: "default"},
		},
		{
			name:          "scopes to the org namespace when stackID is not set and orgID is not 1",
			requester:     &identity.StaticRequester{Type: claims.TypeServiceAccount, UserID: 7, UserUID: "sa-uid", OrgID: 7},
			wantNamespace: "org-7",
			wantSubject:   &authnlib.TokenExchangeSubject{Sub: "service-account:7", Identifier: "sa-uid", Type: "service-account", Namespace: "org-7"},
		},
		{
			name:          "access policy has no on-behalf-of subject",
			requester:     &identity.StaticRequester{Type: claims.TypeAccessPolicy, UserID: 3, UserUID: "ap-uid", OrgID: 1},
			wantNamespace: "default",
			wantSubject:   nil,
		},
		{
			name:    "fails when the requester is missing",
			stackID: "123",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &setting.Cfg{
				StackID: tt.stackID,
				AnnotationAppPlatform: setting.AnnotationAppPlatformSettings{
					APIServerURL: "https://annotation.cluster.local",
				},
			}

			exchanger := &fakeTokenExchanger{}
			c, err := newAnnotationAPIClient(cfg, exchanger)
			require.NoError(t, err)
			require.NotNil(t, c)

			restCfg := buildRESTConfig(
				cfg.AnnotationAppPlatform.APIServerURL,
				exchanger,
				request.GetNamespaceMapper(cfg),
				cfg.AnnotationAppPlatform.TLSClientConfig,
			)
			require.NotNil(t, restCfg.WrapTransport)

			next := &stubRoundTripper{}
			rt := restCfg.WrapTransport(next)

			req, err := http.NewRequest(http.MethodPost, cfg.AnnotationAppPlatform.APIServerURL+"/annotations", http.NoBody)
			require.NoError(t, err)
			if tt.requester != nil {
				req = req.WithContext(identity.WithRequester(req.Context(), tt.requester))
			}

			resp, err := rt.RoundTrip(req)
			if tt.wantErr {
				require.Error(t, err)
				assert.Empty(t, next.gotToken)
				return
			}
			require.NoError(t, err)
			defer func() { require.NoError(t, resp.Body.Close()) }()
			require.Equal(t, http.StatusOK, resp.StatusCode)

			assert.Equal(t, tt.wantNamespace, exchanger.gotRequest.Namespace)
			assert.Equal(t, []string{annotationV0.APIGroup}, exchanger.gotRequest.Audiences)
			assert.Equal(t, tt.wantSubject, exchanger.gotRequest.Subject)
			assert.Equal(t, "signed-token", next.gotToken)
		})
	}
}

func TestNewAnnotationAPIClient_PropagatesTraceContext(t *testing.T) {
	cfg := &setting.Cfg{AnnotationAppPlatform: setting.AnnotationAppPlatformSettings{APIServerURL: "http://annotations.example"}}
	tracer := tracing.InitializeTracerForTest()

	restCfg := buildRESTConfig(
		cfg.AnnotationAppPlatform.APIServerURL,
		&fakeTokenExchanger{},
		request.GetNamespaceMapper(cfg),
		cfg.AnnotationAppPlatform.TLSClientConfig,
	)

	next := &stubRoundTripper{}
	rt := restCfg.WrapTransport(next)

	ctx, span := tracer.Start(context.Background(), "test")
	defer span.End()
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, UserUID: "u1", OrgID: 1})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.AnnotationAppPlatform.APIServerURL+"/annotations", http.NoBody)
	require.NoError(t, err)

	resp, err := rt.RoundTrip(req)
	require.NoError(t, err)
	defer func() { require.NoError(t, resp.Body.Close()) }()

	require.NotEmpty(t, next.gotTraceparent, "outbound request must carry traceparent")
	assert.Contains(t, next.gotTraceparent, span.SpanContext().TraceID().String(),
		"outbound request must carry the caller's trace ID")
	assert.Equal(t, "signed-token", next.gotToken, "token exchange must still apply")
}

func TestAnnotationAPIClient_Requests(t *testing.T) {
	type recorded struct {
		method      string
		path        string
		query       url.Values
		contentType string
		body        []byte
	}

	newClient := func(t *testing.T, handler http.HandlerFunc) (*annotationAPIClient, *[]recorded) {
		t.Helper()
		var seen []recorded
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := io.ReadAll(r.Body)
			require.NoError(t, err)
			seen = append(seen, recorded{
				method:      r.Method,
				path:        r.URL.Path,
				query:       r.URL.Query(),
				contentType: r.Header.Get("Content-Type"),
				body:        body,
			})
			handler(w, r)
		}))
		t.Cleanup(srv.Close)

		cfg := &setting.Cfg{AnnotationAppPlatform: setting.AnnotationAppPlatformSettings{APIServerURL: srv.URL}}
		c, err := newAnnotationAPIClient(cfg, &fakeTokenExchanger{})
		require.NoError(t, err)
		require.NotNil(t, c)
		return c, &seen
	}

	ctx := identity.WithRequester(context.Background(),
		&identity.StaticRequester{Type: claims.TypeUser, UserID: 1, OrgID: 1})

	const base = "/apis/annotation.grafana.app/v0alpha1/namespaces/default"

	respondJSON := func(payload string) http.HandlerFunc {
		return func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(payload))
		}
	}

	sentBody := func(t *testing.T, req recorded) *annotationV0.Annotation {
		t.Helper()
		var anno annotationV0.Annotation
		require.NoError(t, json.Unmarshal(req.body, &anno))
		return &anno
	}

	t.Run("Create POSTs the annotation to the namespaced collection", func(t *testing.T) {
		c, seen := newClient(t, respondJSON(`{"metadata":{"name":"anno-1"},"spec":{"text":"hello"}}`))

		input := &annotationV0.Annotation{
			Spec: annotationV0.AnnotationSpec{Text: "hello", Time: 1000},
		}
		anno, err := c.Create(ctx, 1, input)
		require.NoError(t, err)
		assert.Equal(t, "anno-1", anno.GetName(), "the created annotation is decoded from the response")

		require.Len(t, *seen, 1)
		req := (*seen)[0]
		assert.Equal(t, http.MethodPost, req.method)
		assert.Equal(t, base+"/annotations", req.path)
		assert.Equal(t, "application/json", req.contentType)

		sent := sentBody(t, req)
		assert.Equal(t, input, sent)
	})

	t.Run("Update PUTs the annotation to its own URL", func(t *testing.T) {
		c, seen := newClient(t, respondJSON(`{"metadata":{"name":"anno-1"},"spec":{"text":"after"}}`))

		anno := &annotationV0.Annotation{Spec: annotationV0.AnnotationSpec{Text: "after", Time: 1000}}
		anno.SetName("anno-1")

		updated, err := c.Update(ctx, 1, anno)
		require.NoError(t, err)
		assert.Equal(t, "after", updated.Spec.Text)

		require.Len(t, *seen, 1)
		req := (*seen)[0]
		assert.Equal(t, http.MethodPut, req.method)
		assert.Equal(t, base+"/annotations/anno-1", req.path,
			"the URL is derived from the annotation's own name")
		assert.Equal(t, "application/json", req.contentType)
		assert.Equal(t, anno, sentBody(t, req))
	})

	t.Run("Delete targets the named annotation", func(t *testing.T) {
		c, seen := newClient(t, respondJSON(`{}`))

		require.NoError(t, c.Delete(ctx, 1, "anno-1"))

		require.Len(t, *seen, 1)
		assert.Equal(t, http.MethodDelete, (*seen)[0].method)
		assert.Equal(t, base+"/annotations/anno-1", (*seen)[0].path)
	})

	t.Run("Search maps the query onto the search route's parameters", func(t *testing.T) {
		c, seen := newClient(t, respondJSON(`{"items":[{"metadata":{"name":"anno-1"}}]}`))

		results, err := c.Search(ctx, 1, &annotations.ItemQuery{
			DashboardUID: "dash-1",
			PanelID:      2,
			From:         100,
			To:           200,
			Limit:        5,
			Tags:         []string{"a", "b"},
			MatchAny:     true,
			UserUID:      "user-1",
		})
		require.NoError(t, err)
		require.Len(t, results, 1)
		assert.Equal(t, "anno-1", results[0].GetName())

		require.Len(t, *seen, 1)
		req := (*seen)[0]
		assert.Equal(t, http.MethodGet, req.method)
		assert.Equal(t, base+"/search", req.path, "search hangs off the namespace, not the annotations collection")
		assert.Equal(t, url.Values{
			"dashboardUID": {"dash-1"},
			"panelID":      {"2"},
			"from":         {"100"},
			"to":           {"200"},
			"limit":        {"5"},
			"tag":          {"a", "b"},
			"tagsMatchAny": {"true"},
			"createdBy":    {"user-1"},
		}, req.query)
	})

	t.Run("Search omits parameters the query leaves unset", func(t *testing.T) {
		c, seen := newClient(t, respondJSON(`{"items":[]}`))

		_, err := c.Search(ctx, 1, &annotations.ItemQuery{MatchAny: true})
		require.NoError(t, err)

		require.Len(t, *seen, 1)
		assert.Empty(t, (*seen)[0].query, "tagsMatchAny is meaningless without tags, so it is not sent either")
	})

	t.Run("GetByLegacyID searches by legacy ID and asks for tombstones", func(t *testing.T) {
		c, seen := newClient(t, respondJSON(`{"items":[{"metadata":{"name":"anno-1"}}]}`))

		anno, err := c.GetByLegacyID(ctx, 1, 42)
		require.NoError(t, err)
		assert.Equal(t, "anno-1", anno.GetName())

		require.Len(t, *seen, 1)
		req := (*seen)[0]
		assert.Equal(t, base+"/search", req.path)
		assert.Equal(t, url.Values{
			"legacyID": {"42"},
			"deleted":  {"include"},
		}, req.query)
	})

	t.Run("GetByLegacyID reports ErrNotFound when the search comes back empty", func(t *testing.T) {
		c, _ := newClient(t, respondJSON(`{"items":[]}`))

		_, err := c.GetByLegacyID(ctx, 1, 42)
		assert.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("ListTags maps the tags query onto the tags route's parameters", func(t *testing.T) {
		c, seen := newClient(t, respondJSON(`{"tags":[{"tag":"outage","count":3}]}`))

		tags, err := c.ListTags(ctx, 1, &annotations.TagsQuery{OrgID: 1, Tag: "out", Limit: 25})
		require.NoError(t, err)
		require.Len(t, tags, 1)
		assert.Equal(t, "outage", tags[0].Tag)
		assert.Equal(t, float64(3), tags[0].Count)

		require.Len(t, *seen, 1)
		req := (*seen)[0]
		assert.Equal(t, http.MethodGet, req.method)
		assert.Equal(t, base+"/tags", req.path, "tags hangs off the namespace, not the annotations collection")
		assert.Equal(t, url.Values{
			"prefix": {"out"},
			"limit":  {"25"},
		}, req.query, "the legacy tag term becomes a prefix match")
	})

	t.Run("ListTags omits parameters the query leaves unset", func(t *testing.T) {
		c, seen := newClient(t, respondJSON(`{"tags":[]}`))

		tags, err := c.ListTags(ctx, 1, &annotations.TagsQuery{OrgID: 1})
		require.NoError(t, err)
		assert.Empty(t, tags)

		require.Len(t, *seen, 1)
		assert.Empty(t, (*seen)[0].query, "the server applies its own default limit")
	})

	t.Run("requests are scoped to the org's namespace", func(t *testing.T) {
		c, seen := newClient(t, respondJSON(`{"items":[]}`))

		_, err := c.Search(ctx, 7, &annotations.ItemQuery{})
		require.NoError(t, err)

		require.Len(t, *seen, 1)
		assert.Equal(t, "/apis/annotation.grafana.app/v0alpha1/namespaces/org-7/search", (*seen)[0].path)
	})
}
