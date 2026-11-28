package provisioning

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestListConnector_PagingParameters(t *testing.T) {
	tests := []struct {
		name  string
		query string
		want  resources.ListOptions
	}{
		{name: "no parameters lists everything", query: "/"},
		{name: "limit only", query: "/?limit=10", want: resources.ListOptions{Limit: 10}},
		{name: "continue only", query: "/?continue=abc", want: resources.ListOptions{Continue: "abc"}},
		{name: "both", query: "/?limit=10&continue=abc", want: resources.ListOptions{Limit: 10, Continue: "abc"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lister := resources.NewMockResourceLister(t)
			lister.EXPECT().List(mock.Anything, "default", "repo", tt.want).
				Return(&provisioning.ResourceList{}, nil).Once()

			responder := &testResponder{}
			ctx := request.WithNamespace(context.Background(), "default")
			handler, err := NewListConnector(nil, lister).Connect(ctx, "repo", nil, responder)
			require.NoError(t, err)

			handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, tt.query, nil).WithContext(ctx))
			require.NoError(t, responder.err)
			require.Equal(t, 200, responder.statusCode)
		})
	}
}

func TestListConnector_RejectsAnInvalidLimit(t *testing.T) {
	for _, limit := range []string{"ten", "-1", "1.5"} {
		t.Run(limit, func(t *testing.T) {
			// No expectation on the lister: a rejected limit must not reach storage.
			lister := resources.NewMockResourceLister(t)
			responder := &testResponder{}
			ctx := request.WithNamespace(context.Background(), "default")
			handler, err := NewListConnector(nil, lister).Connect(ctx, "repo", nil, responder)
			require.NoError(t, err)

			handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/?limit="+limit, nil).WithContext(ctx))
			require.True(t, apierrors.IsBadRequest(responder.err), "got %v", responder.err)
		})
	}
}
