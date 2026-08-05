package sso

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
)

// fakeReader embeds Service so only List needs an implementation; the store
// never exercises the other methods.
type fakeReader struct {
	settingsvc.Service
	rows []*settingsvc.Setting
}

func (f *fakeReader) List(context.Context, metav1.LabelSelector) ([]*settingsvc.Setting, error) {
	return f.rows, nil
}

type fakeWriter struct {
	upserts  map[string]string // key -> value
	sections map[string]string // key -> section
	deleted  []string          // deleted keys, in call order
}

func newFakeWriter() *fakeWriter {
	return &fakeWriter{upserts: map[string]string{}, sections: map[string]string{}}
}

func (f *fakeWriter) Upsert(_ context.Context, s *settingsvc.Setting) error {
	f.upserts[s.Key] = s.Value
	f.sections[s.Key] = s.Section
	return nil
}

func (f *fakeWriter) Delete(_ context.Context, _, key string) error {
	f.deleted = append(f.deleted, key)
	return nil
}

func nsCtx() context.Context {
	return genericapirequest.WithNamespace(context.Background(), "stacks-11")
}

func ssoObj(name string, settings map[string]any) *iamv0.SSOSetting {
	return &iamv0.SSOSetting{
		ObjectMeta: metav1.ObjectMeta{Name: name},
		Spec:       iamv0.SSOSettingSpec{Settings: common.Unstructured{Object: settings}},
	}
}

func usRow(section, key, value string) *settingsvc.Setting {
	return &settingsvc.Setting{Section: section, Key: key, Value: value, Labels: map[string]string{"source": "us"}}
}

func defaultRow(section, key, value string) *settingsvc.Setting {
	return &settingsvc.Setting{Section: section, Key: key, Value: value, Labels: map[string]string{"source": "defaults"}}
}

func TestMTSettingsStore(t *testing.T) {
	tests := []struct {
		name   string
		rows   []*settingsvc.Setting // seeds the reader
		op     func(s *MTSettingsStore) (runtime.Object, bool, error)
		assert func(t *testing.T, sso *iamv0.SSOSetting, ok bool, err error, w *fakeWriter)
	}{
		{
			name: "Get assembles rows into a blob; source=db when a us row is present",
			rows: []*settingsvc.Setting{usRow("auth.saml", "enabled", "true"), defaultRow("auth.saml", "name", "SAML")},
			op:   func(s *MTSettingsStore) (runtime.Object, bool, error) { o, e := s.Get(nsCtx(), "saml", &metav1.GetOptions{}); return o, false, e },
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, _ *fakeWriter) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.Equal(t, "saml", sso.Name)
				assert.Equal(t, "stacks-11", sso.Namespace)
				assert.Equal(t, iamv0.SourceDB, sso.Spec.Source)
				assert.Equal(t, map[string]any{"enabled": "true", "name": "SAML"}, sso.Spec.Settings.Object)
			},
		},
		{
			name: "Get returns source=system when no us row is present",
			rows: []*settingsvc.Setting{defaultRow("auth.saml", "name", "SAML")},
			op:   func(s *MTSettingsStore) (runtime.Object, bool, error) { o, e := s.Get(nsCtx(), "saml", &metav1.GetOptions{}); return o, false, e },
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, _ *fakeWriter) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.Equal(t, iamv0.SourceSystem, sso.Spec.Source)
			},
		},
		{
			name: "Get returns NotFound when the provider has no rows",
			rows: nil,
			op:   func(s *MTSettingsStore) (runtime.Object, bool, error) { o, e := s.Get(nsCtx(), "saml", &metav1.GetOptions{}); return o, false, e },
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, _ *fakeWriter) {
				assert.True(t, apierrors.IsNotFound(err))
				assert.Nil(t, sso)
			},
		},
		{
			name: "Create upserts every blob key under auth.<provider>",
			rows: nil,
			op: func(s *MTSettingsStore) (runtime.Object, bool, error) {
				o, e := s.Create(nsCtx(), ssoObj("generic_oauth", map[string]any{"enabled": "true", "client_id": "abc"}), nil, &metav1.CreateOptions{})
				return o, false, e
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, w *fakeWriter) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.Equal(t, map[string]string{"enabled": "true", "client_id": "abc"}, w.upserts)
				assert.Equal(t, "auth.generic_oauth", w.sections["client_id"])
				assert.Equal(t, "stacks-11", sso.Namespace)
				assert.NotEmpty(t, sso.ResourceVersion)
			},
		},
		{
			name: "Update upserts desired keys and prunes only stale unified-storage (us) rows",
			rows: []*settingsvc.Setting{
				usRow("auth.saml", "enabled", "true"),   // kept (in desired)
				usRow("auth.saml", "stale", "x"),        // pruned (us, not in desired)
				defaultRow("auth.saml", "name", "SAML"), // never pruned (not us)
			},
			op: func(s *MTSettingsStore) (runtime.Object, bool, error) {
				return s.Update(nsCtx(), "saml",
					rest.DefaultUpdatedObjectInfo(ssoObj("saml", map[string]any{"enabled": "false", "new_key": "y"})),
					nil, nil, false, &metav1.UpdateOptions{})
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, created bool, err error, w *fakeWriter) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.False(t, created)
				assert.Equal(t, map[string]string{"enabled": "false", "new_key": "y"}, w.upserts)
				assert.Equal(t, []string{"stale"}, w.deleted)
				assert.Equal(t, "stacks-11", sso.Namespace)
			},
		},
		{
			name: "Update creates on update when absent and forceAllowCreate is set",
			rows: nil,
			op: func(s *MTSettingsStore) (runtime.Object, bool, error) {
				return s.Update(nsCtx(), "saml",
					rest.DefaultUpdatedObjectInfo(ssoObj("saml", map[string]any{"enabled": "true"})),
					nil, nil, true, &metav1.UpdateOptions{})
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, created bool, err error, w *fakeWriter) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.True(t, created)
				assert.Equal(t, map[string]string{"enabled": "true"}, w.upserts)
			},
		},
		{
			name: "Update returns NotFound when absent and forceAllowCreate is not set",
			rows: nil,
			op: func(s *MTSettingsStore) (runtime.Object, bool, error) {
				return s.Update(nsCtx(), "saml",
					rest.DefaultUpdatedObjectInfo(ssoObj("saml", map[string]any{"enabled": "true"})),
					nil, nil, false, &metav1.UpdateOptions{})
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, _ *fakeWriter) {
				assert.True(t, apierrors.IsNotFound(err))
				assert.Nil(t, sso)
			},
		},
		{
			name: "Delete removes only the unified-storage (us) rows",
			rows: []*settingsvc.Setting{usRow("auth.saml", "enabled", "true"), defaultRow("auth.saml", "name", "SAML")},
			op:   func(s *MTSettingsStore) (runtime.Object, bool, error) { return s.Delete(nsCtx(), "saml", nil, &metav1.DeleteOptions{}) },
			assert: func(t *testing.T, sso *iamv0.SSOSetting, deleted bool, err error, w *fakeWriter) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.True(t, deleted)
				assert.Equal(t, []string{"enabled"}, w.deleted)
			},
		},
		{
			name: "List is not implemented",
			rows: nil,
			op:   func(s *MTSettingsStore) (runtime.Object, bool, error) { o, e := s.List(nsCtx(), nil); return o, false, e },
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, _ *fakeWriter) {
				require.Error(t, err)
				status, ok := err.(apierrors.APIStatus)
				require.True(t, ok)
				assert.Equal(t, int32(http.StatusNotImplemented), status.Status().Code)
				assert.Nil(t, sso)
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := newFakeWriter()
			obj, ok, err := tc.op(NewMTSettingsStore(&fakeReader{rows: tc.rows}, w))
			sso, _ := obj.(*iamv0.SSOSetting) // may be nil; each assert decides what "valid" means
			tc.assert(t, sso, ok, err, w)
		})
	}
}

func TestCoarseResourceVersion(t *testing.T) {
	base := map[string]any{"a": "1", "b": "2"}
	assert.Equal(t, coarseResourceVersion(base), coarseResourceVersion(map[string]any{"b": "2", "a": "1"}), "order-independent")
	assert.NotEqual(t, coarseResourceVersion(base), coarseResourceVersion(map[string]any{"a": "1", "b": "3"}), "value change moves the version")
}

func TestValueToString(t *testing.T) {
	tests := []struct {
		in   any
		want string
	}{
		{nil, ""},
		{"hello", "hello"},
		{true, "true"},
		{42, "42"},
	}
	for _, tc := range tests {
		assert.Equal(t, tc.want, valueToString(tc.in))
	}
}

func TestSectionFor(t *testing.T) {
	assert.Equal(t, "auth.saml", sectionFor("saml"))
	assert.Equal(t, "auth.generic_oauth", sectionFor("generic_oauth"))
}
