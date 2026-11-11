package provisioning

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestHandleStats(t *testing.T) {
	const ns = "stacks-1234"

	t.Run("reads the namespace from the path, not from a wildcard-scoped service identity", func(t *testing.T) {
		lister := resources.NewMockResourceLister(t)
		lister.EXPECT().Stats(mock.Anything, ns, "").Return(&provisioning.ResourceStats{}, nil)

		b := &APIBuilder{resourceLister: lister}

		req := httptest.NewRequest(http.MethodGet, "/stats", nil)
		ctx := identity.WithRequester(req.Context(), &identity.StaticRequester{
			Type:      authlib.TypeAccessPolicy,
			UserUID:   "provisioning-jobs-operator",
			Namespace: "*",
		})
		rec := httptest.NewRecorder()
		b.handleStats(rec, req.WithContext(request.WithNamespace(ctx, ns)))

		assert.Equal(t, http.StatusOK, rec.Code)
	})

	t.Run("rejects a request with no namespace in the path", func(t *testing.T) {
		b := &APIBuilder{resourceLister: resources.NewMockResourceLister(t)}

		rec := httptest.NewRecorder()
		b.handleStats(rec, httptest.NewRequest(http.MethodGet, "/stats", nil))

		require.Equal(t, http.StatusBadRequest, rec.Code)
	})
}
