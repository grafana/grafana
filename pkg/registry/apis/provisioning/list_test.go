package provisioning

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

type resourceLookupFunc func(context.Context, string, string, []string) (*provisioning.ResourceList, error)

func (f resourceLookupFunc) Lookup(ctx context.Context, namespace, repository string, paths []string) (*provisioning.ResourceList, error) {
	return f(ctx, namespace, repository, paths)
}

func TestListConnector_Lookup(t *testing.T) {
	ctx := request.WithNamespace(t.Context(), "default")
	want := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{{Path: "team/cpu.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "cpu"}}}
	lookup := resourceLookupFunc(func(got context.Context, namespace, repository string, paths []string) (*provisioning.ResourceList, error) {
		require.Same(t, ctx, got)
		require.Equal(t, "default", namespace)
		require.Equal(t, "repo", repository)
		require.Equal(t, []string{"team/cpu.json", "team/"}, paths)
		return want, nil
	})
	responder := &testResponder{}
	connector := NewListConnector(&testConnectorDeps{}, nil, lookup)
	require.Equal(t, []string{http.MethodGet, http.MethodPost}, connector.ConnectMethods())
	handler, err := connector.Connect(ctx, "repo", nil, responder)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"paths":["team/cpu.json","team/"]}`)).WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(httptest.NewRecorder(), req)
	require.NoError(t, responder.err)
	require.Equal(t, http.StatusOK, responder.statusCode)
	require.Equal(t, want, responder.object)
}

func TestListConnector_InvalidLookupBody(t *testing.T) {
	for _, body := range []string{`{`, `{"paths":"cpu.json"}`, `{"paths":["cpu.json"],"unexpected":true}`, `{"paths":["cpu.json"]} {}`} {
		t.Run(body[:min(len(body), 80)], func(t *testing.T) {
			responder := &testResponder{}
			handler, err := NewListConnector(nil, nil, nil).Connect(t.Context(), "repo", nil, responder)
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			handler.ServeHTTP(httptest.NewRecorder(), req)
			require.True(t, apierrors.IsBadRequest(responder.err), "%v", responder.err)
			require.Nil(t, responder.object)
		})
	}
}

func TestListConnector_LookupBodySize(t *testing.T) {
	for _, tc := range []struct {
		name string
		size int
	}{
		{name: "below limit", size: defaultMaxBodySize - 1},
		{name: "at limit", size: defaultMaxBodySize},
		{name: "above limit", size: defaultMaxBodySize + 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			called := false
			lookup := resourceLookupFunc(func(context.Context, string, string, []string) (*provisioning.ResourceList, error) {
				called = true
				return &provisioning.ResourceList{}, nil
			})
			responder := &testResponder{}
			handler, err := NewListConnector(&testConnectorDeps{}, nil, lookup).Connect(t.Context(), "repo", nil, responder)
			require.NoError(t, err)
			body := `{"paths":["cpu.json"]}`
			body = strings.Repeat(" ", tc.size-len(body)) + body
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			handler.ServeHTTP(httptest.NewRecorder(), req)

			if tc.size > defaultMaxBodySize {
				require.True(t, apierrors.IsBadRequest(responder.err), "%v", responder.err)
				require.ErrorContains(t, responder.err, errMsgRequestTooLarge)
				require.Nil(t, responder.object)
				require.False(t, called)
			} else {
				require.NoError(t, responder.err)
				require.Equal(t, http.StatusOK, responder.statusCode)
				require.True(t, called)
			}
		})
	}
}

func TestListConnector_LookupErrorDiscardsPartialResult(t *testing.T) {
	lookup := resourceLookupFunc(func(context.Context, string, string, []string) (*provisioning.ResourceList, error) {
		return &provisioning.ResourceList{Items: []provisioning.ResourceListItem{{Name: "partial"}}}, errors.New("search unavailable")
	})
	responder := &testResponder{}
	handler, err := NewListConnector(&testConnectorDeps{}, nil, lookup).Connect(t.Context(), "repo", nil, responder)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"paths":["cpu.json"]}`))
	req.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(httptest.NewRecorder(), req)
	require.ErrorContains(t, responder.err, "search unavailable")
	require.Nil(t, responder.object)
}
