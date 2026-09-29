package sso

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
)

type fakeInner struct {
	ssoStorage
	created *iamv0.SSOSetting
	listed  runtime.Object
	listErr error
}

func (f *fakeInner) Create(context.Context, runtime.Object, rest.ValidateObjectFunc, *metav1.CreateOptions) (runtime.Object, error) {
	return f.created, nil
}

func (f *fakeInner) List(context.Context, *internalversion.ListOptions) (runtime.Object, error) {
	return f.listed, f.listErr
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

func TestRedactingStore_ListRedactsResponse(t *testing.T) {
	list := &iamv0.SSOSettingList{Items: []iamv0.SSOSetting{
		// token_exchange_timeout is a legacy int64: redaction must skip non-string
		// values rather than DeepCopy them (which panics on int64).
		*ssoObj("generic_oauth", map[string]any{"client_id": "abc", "client_secret": "topsecret", "token_exchange_timeout": int64(30)}),
		// Nested LDAP server secret.
		*ssoObj("ldap", map[string]any{"config": map[string]any{"servers": []any{
			map[string]any{"host": "ldap.example", "bind_password": "ldapsecret"},
		}}}),
	}}
	store, err := NewRedactingStore(&fakeInner{listed: list})
	require.NoError(t, err)

	out, err := store.(rest.Lister).List(context.Background(), nil)
	require.NoError(t, err)
	got, ok := out.(*iamv0.SSOSettingList)
	require.True(t, ok)

	oauth := got.Items[0].Spec.Settings.Object
	assert.Equal(t, setting.RedactedPassword, oauth["client_secret"])
	assert.Equal(t, "abc", oauth["client_id"])
	assert.Equal(t, int64(30), oauth["token_exchange_timeout"], "non-string value left untouched")

	server := got.Items[1].Spec.Settings.Object["config"].(map[string]any)["servers"].([]any)[0].(map[string]any)
	assert.Equal(t, setting.RedactedPassword, server["bind_password"])
	assert.Equal(t, "ldap.example", server["host"])
}

func TestRedactingStore_ListPropagatesError(t *testing.T) {
	store, err := NewRedactingStore(&fakeInner{listErr: errors.New("boom")})
	require.NoError(t, err)
	_, err = store.(rest.Lister).List(context.Background(), nil)
	require.Error(t, err)
}

type onlyStorage struct{}

func (onlyStorage) New() runtime.Object { return nil }
func (onlyStorage) Destroy()            {}

func TestNewRedactingStore_RejectsIncompleteStorage(t *testing.T) {
	_, err := NewRedactingStore(onlyStorage{})
	require.Error(t, err)
}
