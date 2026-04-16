package globalrole

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

// fakeStorage records what context was used for Get and List calls.
type fakeStorage struct {
	grafanarest.Storage
	lastGetCtx  context.Context
	lastListCtx context.Context
}

func (f *fakeStorage) Get(ctx context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
	f.lastGetCtx = ctx
	return &iamv0.GlobalRole{}, nil
}

func (f *fakeStorage) List(ctx context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	f.lastListCtx = ctx
	return &iamv0.GlobalRoleList{}, nil
}

func TestGlobalRoleIdentityWrapperGetSwitchesIdentity(t *testing.T) {
	inner := &fakeStorage{}
	wrapper := &GlobalRoleIdentityWrapper{Storage: inner}

	_, err := wrapper.Get(context.Background(), "test", &metav1.GetOptions{})
	require.NoError(t, err)

	// The context should now have a service identity
	assert.True(t, identity.IsServiceIdentity(inner.lastGetCtx))
}

func TestGlobalRoleIdentityWrapperListSwitchesIdentity(t *testing.T) {
	inner := &fakeStorage{}
	wrapper := &GlobalRoleIdentityWrapper{Storage: inner}

	_, err := wrapper.List(context.Background(), nil)
	require.NoError(t, err)

	// The context should now have a service identity
	assert.True(t, identity.IsServiceIdentity(inner.lastListCtx))
}
