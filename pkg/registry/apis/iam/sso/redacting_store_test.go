package sso

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
)

type fakeInner struct {
	ssoStorage
	created *iamv0.SSOSetting
}

func (f *fakeInner) Create(context.Context, runtime.Object, rest.ValidateObjectFunc, *metav1.CreateOptions) (runtime.Object, error) {
	return f.created, nil
}

func TestRedactingStore_CreateRedactsResponse(t *testing.T) {
	inner := &fakeInner{created: ssoObj("generic_oauth", map[string]any{"client_id": "abc", "client_secret": "topsecret"})}
	store, err := NewRedactingStore(inner)
	require.NoError(t, err)

	out, err := store.(rest.Creater).Create(context.Background(), ssoObj("generic_oauth", map[string]any{}), nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	sso, ok := out.(*iamv0.SSOSetting)
	require.True(t, ok)
	assert.Equal(t, setting.RedactedPassword, sso.Spec.Settings.Object["client_secret"])
	assert.Equal(t, "abc", sso.Spec.Settings.Object["client_id"])
}

type onlyStorage struct{}

func (onlyStorage) New() runtime.Object { return nil }
func (onlyStorage) Destroy()            {}

func TestNewRedactingStore_RejectsIncompleteStorage(t *testing.T) {
	_, err := NewRedactingStore(onlyStorage{})
	require.Error(t, err)
}
