package sso

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssomodels "github.com/grafana/grafana/pkg/services/ssosettings/models"
)

// fakeSSOService embeds Service so only the methods Create exercises need bodies.
// GetForProviderWithRedactedSecrets reads back whatever Upsert stored, so the
// happy path observes its own write.
type fakeSSOService struct {
	ssosettings.Service
	upserted  *ssomodels.SSOSettings // last model handed to Upsert
	upsertErr error
}

func (f *fakeSSOService) Upsert(_ context.Context, s *ssomodels.SSOSettings, _ identity.Requester) error {
	if f.upsertErr != nil {
		return f.upsertErr
	}
	f.upserted = s
	return nil
}

func (f *fakeSSOService) GetForProviderWithRedactedSecrets(_ context.Context, _ string) (*ssomodels.SSOSettings, error) {
	if f.upserted == nil {
		return nil, ssosettings.ErrNotFound
	}
	return f.upserted, nil
}

func reqCtx() context.Context {
	return identity.WithRequester(context.Background(), &identity.StaticRequester{})
}

func TestLegacyStore_Create(t *testing.T) {
	tests := []struct {
		name   string
		svc    *fakeSSOService
		op     func(s *LegacyStore) (runtime.Object, error)
		assert func(t *testing.T, sso *iamv0.SSOSetting, err error, svc *fakeSSOService)
	}{
		{
			name: "upserts the provider and returns the stored object",
			svc:  &fakeSSOService{},
			op: func(s *LegacyStore) (runtime.Object, error) {
				return s.Create(reqCtx(), ssoObj("azuread", map[string]any{"enabled": "true"}), nil, &metav1.CreateOptions{})
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, err error, svc *fakeSSOService) {
				require.NoError(t, err)
				require.NotNil(t, sso)
				assert.Equal(t, "azuread", sso.Name)
				assert.Equal(t, map[string]any{"enabled": "true"}, sso.Spec.Settings.Object)
				require.NotNil(t, svc.upserted)
				assert.Equal(t, "azuread", svc.upserted.Provider)
			},
		},
		{
			name: "fails without an identity and does not upsert",
			svc:  &fakeSSOService{},
			op: func(s *LegacyStore) (runtime.Object, error) {
				return s.Create(context.Background(), ssoObj("azuread", map[string]any{"enabled": "true"}), nil, &metav1.CreateOptions{})
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, err error, svc *fakeSSOService) {
				require.Error(t, err)
				assert.Nil(t, sso)
				assert.Nil(t, svc.upserted)
			},
		},
		{
			name: "rejects a non-SSOSetting object",
			svc:  &fakeSSOService{},
			op: func(s *LegacyStore) (runtime.Object, error) {
				return s.Create(reqCtx(), &iamv0.SSOSettingList{}, nil, &metav1.CreateOptions{})
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, err error, svc *fakeSSOService) {
				require.Error(t, err)
				assert.Nil(t, sso)
				assert.Nil(t, svc.upserted)
			},
		},
		{
			name: "surfaces a validation failure before upserting",
			svc:  &fakeSSOService{},
			op: func(s *LegacyStore) (runtime.Object, error) {
				deny := func(context.Context, runtime.Object) error { return errors.New("denied") }
				return s.Create(reqCtx(), ssoObj("azuread", map[string]any{"enabled": "true"}), deny, &metav1.CreateOptions{})
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, err error, svc *fakeSSOService) {
				require.Error(t, err)
				assert.Nil(t, sso)
				assert.Nil(t, svc.upserted)
			},
		},
		{
			name: "propagates an upsert error",
			svc:  &fakeSSOService{upsertErr: errors.New("boom")},
			op: func(s *LegacyStore) (runtime.Object, error) {
				return s.Create(reqCtx(), ssoObj("azuread", map[string]any{"enabled": "true"}), nil, &metav1.CreateOptions{})
			},
			assert: func(t *testing.T, sso *iamv0.SSOSetting, err error, _ *fakeSSOService) {
				require.Error(t, err)
				assert.Nil(t, sso)
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			obj, err := tc.op(NewLegacyStore(tc.svc, noop.NewTracerProvider().Tracer("test")))
			sso, _ := obj.(*iamv0.SSOSetting) // may be nil; each assert decides what "valid" means
			tc.assert(t, sso, err, tc.svc)
		})
	}
}
