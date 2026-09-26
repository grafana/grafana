package sso

import (
	"context"
	"errors"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	store, err := NewRedactingStore(inner, nil)
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
	store, err := NewRedactingStore(&fakeInner{listed: list}, nil)
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
	store, err := NewRedactingStore(&fakeInner{listErr: errors.New("boom")}, nil)
	require.NoError(t, err)
	_, err = store.(rest.Lister).List(context.Background(), nil)
	require.Error(t, err)
}

// fakeAccessClient compiles to an ItemChecker that allows only the names in allow.
type fakeAccessClient struct {
	allow      map[string]bool
	compileErr error
}

func (f *fakeAccessClient) Check(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: true}, nil
}

func (f *fakeAccessClient) Compile(context.Context, authlib.AuthInfo, authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	if f.compileErr != nil {
		return nil, nil, f.compileErr
	}
	return func(name, _ string) bool { return f.allow[name] }, authlib.NoopZookie{}, nil
}

func (f *fakeAccessClient) BatchCheck(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}

// listCtx seeds the namespace and requester that the per-provider List filter reads.
func listCtx() context.Context {
	ctx := genericapirequest.WithNamespace(context.Background(), "stacks-11")
	return identity.WithRequester(ctx, &identity.StaticRequester{Type: authlib.TypeUser, OrgID: 1})
}

func TestRedactingStore_ListFiltersByProvider(t *testing.T) {
	list := &iamv0.SSOSettingList{Items: []iamv0.SSOSetting{
		*ssoObj("github", map[string]any{"client_id": "gh", "client_secret": "ghsecret"}),
		*ssoObj("google", map[string]any{"client_id": "goo", "client_secret": "goosecret"}),
		*ssoObj("saml", map[string]any{"private_key": "pk"}),
	}}
	ac := &fakeAccessClient{allow: map[string]bool{"auth.github": true}}
	store, err := NewRedactingStore(&fakeInner{listed: list}, ac)
	require.NoError(t, err)

	out, err := store.(rest.Lister).List(listCtx(), nil)
	require.NoError(t, err)
	got, ok := out.(*iamv0.SSOSettingList)
	require.True(t, ok)

	require.Len(t, got.Items, 1)
	assert.Equal(t, "github", got.Items[0].Name)
	assert.Equal(t, setting.RedactedPassword, got.Items[0].Spec.Settings.Object["client_secret"], "surviving item is still redacted")
}

func TestRedactingStore_ListEmptyWhenNoProviderAllowed(t *testing.T) {
	list := &iamv0.SSOSettingList{Items: []iamv0.SSOSetting{
		*ssoObj("github", map[string]any{"client_secret": "x"}),
	}}
	store, err := NewRedactingStore(&fakeInner{listed: list}, &fakeAccessClient{allow: map[string]bool{}})
	require.NoError(t, err)

	out, err := store.(rest.Lister).List(listCtx(), nil)
	require.NoError(t, err)
	got, ok := out.(*iamv0.SSOSettingList)
	require.True(t, ok)
	assert.Empty(t, got.Items)
}

func TestRedactingStore_ListCompileErrorPropagates(t *testing.T) {
	store, err := NewRedactingStore(&fakeInner{listed: &iamv0.SSOSettingList{}}, &fakeAccessClient{compileErr: errors.New("boom")})
	require.NoError(t, err)

	_, err = store.(rest.Lister).List(listCtx(), nil)
	require.Error(t, err)
}

type onlyStorage struct{}

func (onlyStorage) New() runtime.Object { return nil }
func (onlyStorage) Destroy()            {}

func TestNewRedactingStore_RejectsIncompleteStorage(t *testing.T) {
	_, err := NewRedactingStore(onlyStorage{}, nil)
	require.Error(t, err)
}
