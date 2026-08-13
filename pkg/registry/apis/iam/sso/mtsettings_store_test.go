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

// fakeSettings is a stateful in-memory MT-Settings double implementing both the
// reader (List) and writer (Upsert/Delete) surfaces. Writes mutate the us layer
// and List returns it merged with the immutable seeded layers (defaults/hgapi),
// so a re-read after a write observes that write — which the store's responses
// now rely on.
type fakeSettings struct {
	settingsvc.Service
	us       map[string]*settingsvc.Setting // section|key -> us row
	seeded   []*settingsvc.Setting          // immutable non-us rows
	upserts  map[string]string              // key -> value, for write assertions
	sections map[string]string              // key -> section, for write assertions
	deleted  []string                       // deleted keys, in call order
}

func newFakeSettings(seed []*settingsvc.Setting) *fakeSettings {
	f := &fakeSettings{
		us:       map[string]*settingsvc.Setting{},
		upserts:  map[string]string{},
		sections: map[string]string{},
	}
	for _, r := range seed {
		if r.Labels["source"] == "us" {
			f.us[r.Section+"|"+r.Key] = r
		} else {
			f.seeded = append(f.seeded, r)
		}
	}
	return f
}

func (f *fakeSettings) List(_ context.Context, sel metav1.LabelSelector) ([]*settingsvc.Setting, error) {
	section := sel.MatchLabels["section"]
	var out []*settingsvc.Setting
	for _, r := range f.seeded {
		if r.Section == section {
			out = append(out, r)
		}
	}
	for _, r := range f.us {
		if r.Section == section {
			out = append(out, r)
		}
	}
	return out, nil
}

func (f *fakeSettings) Upsert(_ context.Context, s *settingsvc.Setting) error {
	f.upserts[s.Key] = s.Value
	f.sections[s.Key] = s.Section
	f.us[s.Section+"|"+s.Key] = &settingsvc.Setting{
		Section: s.Section, Key: s.Key, Value: s.Value,
		Labels: map[string]string{"source": "us"},
	}
	return nil
}

func (f *fakeSettings) Delete(_ context.Context, section, key string) error {
	f.deleted = append(f.deleted, key)
	delete(f.us, section+"|"+key)
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
		rows   []*settingsvc.Setting // seeds the store
		op     func(s *MTSettingsStore) (runtime.Object, bool, error)
		assert func(t *testing.T, sso *iamv0.SSOSetting, ok bool, err error, f *fakeSettings)
	}{
		{
			name: "Get assembles rows into a blob; source=db when a us row is present",
			rows: []*settingsvc.Setting{usRow("auth.saml", "enabled", "true"), defaultRow("auth.saml", "name", "SAML")},
			op: func(s *MTSettingsStore) (runtime.Object, bool, error) {
				o, e := s.Get(nsCtx(), "saml", &metav1.GetOptions{})
				return o, false, e
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, _ *fakeSettings) {
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
			op: func(s *MTSettingsStore) (runtime.Object, bool, error) {
				o, e := s.Get(nsCtx(), "saml", &metav1.GetOptions{})
				return o, false, e
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, _ *fakeSettings) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.Equal(t, iamv0.SourceSystem, sso.Spec.Source)
			},
		},
		{
			name: "Get returns NotFound when the provider has no rows",
			rows: nil,
			op: func(s *MTSettingsStore) (runtime.Object, bool, error) {
				o, e := s.Get(nsCtx(), "saml", &metav1.GetOptions{})
				return o, false, e
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, _ *fakeSettings) {
				assert.True(t, apierrors.IsNotFound(err))
				assert.Nil(t, sso)
			},
		},
		{
			name: "Create upserts every blob key and returns the stored projection, not the request",
			rows: []*settingsvc.Setting{defaultRow("auth.generic_oauth", "auto_login", "false")},
			op: func(s *MTSettingsStore) (runtime.Object, bool, error) {
				o, e := s.Create(nsCtx(), ssoObj("generic_oauth", map[string]any{"enabled": "true", "client_id": "abc"}), nil, &metav1.CreateOptions{})
				return o, false, e
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, f *fakeSettings) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.Equal(t, map[string]string{"enabled": "true", "client_id": "abc"}, f.upserts)
				assert.Equal(t, "auth.generic_oauth", f.sections["client_id"])
				assert.Equal(t, "stacks-11", sso.Namespace)
				assert.NotEmpty(t, sso.ResourceVersion)
				// Projection, not echo: Spec.Source is resolved and the seeded
				// default-layer key is merged in — neither is in the request.
				assert.Equal(t, iamv0.SourceDB, sso.Spec.Source)
				assert.Equal(t, map[string]any{"enabled": "true", "client_id": "abc", "auto_login": "false"}, sso.Spec.Settings.Object)
			},
		},
		{
			name: "Update upserts desired keys, prunes only stale us rows, and returns the merged projection",
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
			assert: func(t *testing.T, sso *iamv0.SSOSetting, created bool, err error, f *fakeSettings) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.False(t, created)
				assert.Equal(t, map[string]string{"enabled": "false", "new_key": "y"}, f.upserts)
				assert.Equal(t, []string{"stale"}, f.deleted)
				assert.Equal(t, "stacks-11", sso.Namespace)
				assert.Equal(t, iamv0.SourceDB, sso.Spec.Source)
				assert.Equal(t, map[string]any{"enabled": "false", "new_key": "y", "name": "SAML"}, sso.Spec.Settings.Object)
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
			assert: func(t *testing.T, sso *iamv0.SSOSetting, created bool, err error, f *fakeSettings) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.True(t, created)
				assert.Equal(t, map[string]string{"enabled": "true"}, f.upserts)
				assert.Equal(t, iamv0.SourceDB, sso.Spec.Source)
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
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, _ *fakeSettings) {
				assert.True(t, apierrors.IsNotFound(err))
				assert.Nil(t, sso)
			},
		},
		{
			name: "Delete removes only the unified-storage (us) rows",
			rows: []*settingsvc.Setting{usRow("auth.saml", "enabled", "true"), defaultRow("auth.saml", "name", "SAML")},
			op: func(s *MTSettingsStore) (runtime.Object, bool, error) {
				return s.Delete(nsCtx(), "saml", nil, &metav1.DeleteOptions{})
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, deleted bool, err error, f *fakeSettings) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.True(t, deleted)
				assert.Equal(t, []string{"enabled"}, f.deleted)
			},
		},
		{
			name: "List is not implemented",
			rows: nil,
			op: func(s *MTSettingsStore) (runtime.Object, bool, error) {
				o, e := s.List(nsCtx(), nil)
				return o, false, e
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, _ bool, err error, _ *fakeSettings) {
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
			f := newFakeSettings(tc.rows)
			obj, ok, err := tc.op(NewMTSettingsStore(f, f))
			sso, _ := obj.(*iamv0.SSOSetting) // may be nil; each assert decides what "valid" means
			tc.assert(t, sso, ok, err, f)
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
