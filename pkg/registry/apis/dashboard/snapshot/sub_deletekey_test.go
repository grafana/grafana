package snapshot

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

// capturingResponder records the object/error passed by the subresource handler.
type capturingResponder struct {
	obj runtime.Object
	err error
}

func (r *capturingResponder) Object(_ int, obj runtime.Object) { r.obj = obj }
func (r *capturingResponder) Error(err error)                  { r.err = err }

func newDeleteKeyREST(t *testing.T) *deleteKeyREST {
	t.Helper()
	mockService := dashboardsnapshots.NewMockService(t)
	mockService.On("GetDashboardSnapshot", mock.Anything, mock.Anything).
		Return(&dashboardsnapshots.DashboardSnapshot{
			Key:       "snap-1",
			DeleteKey: "secret-delete-key",
			OrgID:     1,
			Dashboard: simplejson.New(),
		}, nil)

	store := &SnapshotLegacyStore{
		ResourceInfo: dashv0.SnapshotResourceInfo,
		Service:      mockService,
		Namespacer:   authlib.OrgNamespaceFormatter,
	}
	return &deleteKeyREST{getter: store}
}

func TestDeleteKeyREST_Connect_SameOrg(t *testing.T) {
	r := newDeleteKeyREST(t)
	responder := &capturingResponder{}

	// Caller in org 1, snapshot owned by org 1.
	handler, err := r.Connect(ctxForOrg(1), "snap-1", nil, responder)
	require.NoError(t, err)
	require.NotNil(t, handler)

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	require.NoError(t, responder.err)

	result, ok := responder.obj.(*dashv0.DashboardSnapshotWithDeleteKey)
	require.True(t, ok, "expected DashboardSnapshotWithDeleteKey, got %T", responder.obj)
	assert.Equal(t, "secret-delete-key", result.DeleteKey)
	// The embedded spec must not carry the deleteKey.
	assert.Nil(t, result.Snapshot.Spec.DeleteKey)
}

func TestDeleteKeyREST_Connect_CrossOrg(t *testing.T) {
	r := newDeleteKeyREST(t)
	responder := &capturingResponder{}

	// Caller in org 2, snapshot owned by org 1: must not leak the deleteKey.
	handler, err := r.Connect(ctxForOrg(2), "snap-1", nil, responder)
	require.Error(t, err)
	assert.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
	assert.Nil(t, handler)
	assert.Nil(t, responder.obj)
}
