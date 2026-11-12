package provisioning

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func serveStats(t *testing.T, lister resources.ResourceLister, namespace, name string) *testResponder {
	t.Helper()
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), namespace)
	handler, err := NewStatsConnector(lister).Connect(ctx, name, nil, responder)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx))
	return responder
}

func TestStatsConnector_Connect(t *testing.T) {
	counts := []provisioning.ResourceCount{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 24},
		{Group: "folder.grafana.app", Resource: "folders", Count: 2},
	}

	t.Run("answers with the counts for the requested namespace and repository", func(t *testing.T) {
		lister := resources.NewMockResourceLister(t)
		lister.EXPECT().RepositoryStats(mock.Anything, "ns-1", "repo-1").Return(counts, nil).Once()

		responder := serveStats(t, lister, "ns-1", "repo-1")

		require.NoError(t, responder.err)
		assert.Equal(t, http.StatusOK, responder.statusCode)
		assert.Equal(t, &provisioning.ResourceCountList{Items: counts}, responder.object)
	})

	t.Run("a repository the index counts nothing for is reported as not found", func(t *testing.T) {
		notFound := apierrors.NewNotFound(schema.GroupResource{Group: provisioning.GROUP, Resource: "stats"}, "repo-1")
		lister := resources.NewMockResourceLister(t)
		lister.EXPECT().RepositoryStats(mock.Anything, "ns-1", "repo-1").Return(nil, notFound).Once()

		responder := serveStats(t, lister, "ns-1", "repo-1")

		require.Nil(t, responder.object)
		assert.True(t, apierrors.IsNotFound(responder.err), "expected a not-found error, got %v", responder.err)
	})

	// The namespace route reports every manager; this one must never widen to that.
	t.Run("never asks for namespace-wide stats", func(t *testing.T) {
		lister := resources.NewMockResourceLister(t)
		lister.EXPECT().RepositoryStats(mock.Anything, mock.Anything, mock.Anything).Return(counts, nil).Once()

		serveStats(t, lister, "ns-1", "repo-1")

		lister.AssertNotCalled(t, "Stats", mock.Anything, mock.Anything)
	})
}

func TestStatsConnector_Metadata(t *testing.T) {
	connector := NewStatsConnector(resources.NewMockResourceLister(t))

	assert.Equal(t, []string{http.MethodGet}, connector.ConnectMethods(), "read-only")
	assert.Equal(t, &provisioning.ResourceCountList{}, connector.New())
	assert.Equal(t, &provisioning.ResourceCountList{}, connector.ProducesObject(http.MethodGet))

	// No {path} component: the repository name is the whole address.
	obj, hasPath, pathParam := connector.NewConnectOptions()
	assert.Nil(t, obj)
	assert.False(t, hasPath)
	assert.Empty(t, pathParam)
}
