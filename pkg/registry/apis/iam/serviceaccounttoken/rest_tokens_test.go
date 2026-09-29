package serviceaccounttoken

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"gopkg.in/ini.v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/setting"
)

func TestResolveExpirationSettingsFromConfigProvider(t *testing.T) {
	provider := &fakeConfigProvider{cfg: &setting.Cfg{
		ApiKeyMaxSecondsToLive:    3600,
		SATokenExpirationDayLimit: 7,
	}}
	settingService := &fakeSettingService{}
	rest := NewTokensREST(nil, nil, noop.NewTracerProvider().Tracer("test"), provider, settingService)

	resolved, err := rest.resolveExpirationSettings(context.Background())
	require.NoError(t, err)
	assert.Equal(t, expirationSettings{apiKeyMaxSecondsToLive: 3600, saTokenExpirationDays: 7}, resolved)
	assert.False(t, settingService.called)
}

func TestResolveExpirationSettingsFromSettingService(t *testing.T) {
	ctx := k8srequest.WithNamespace(context.Background(), "stacks-123")
	settingService := &fakeSettingService{
		settings: []*settingsvc.Setting{
			{Section: serviceAccountsSection, Key: tokenExpirationDayLimitKey, Value: " 14 "},
			{Section: "auth", Key: "unrelated", Value: "99"},
			{Section: authSection, Key: apiKeyMaxSecondsToLiveKey, Value: "7200"},
		},
	}
	rest := NewTokensREST(nil, nil, noop.NewTracerProvider().Tracer("test"), nil, settingService)

	resolved, err := rest.resolveExpirationSettings(ctx)
	require.NoError(t, err)
	assert.Equal(t, expirationSettings{apiKeyMaxSecondsToLive: 7200, saTokenExpirationDays: 14}, resolved)
	assert.Equal(t, tokenExpirationSettingsSelector, settingService.selector)
	assert.Equal(t, "stacks-123", settingService.namespace)
}

func TestResolveExpirationSettingsDefaultsForMissingOrBlankMTSettings(t *testing.T) {
	settingService := &fakeSettingService{
		settings: []*settingsvc.Setting{
			{Section: authSection, Key: apiKeyMaxSecondsToLiveKey, Value: "  "},
		},
	}
	rest := NewTokensREST(nil, nil, noop.NewTracerProvider().Tracer("test"), nil, settingService)

	resolved, err := rest.resolveExpirationSettings(context.Background())
	require.NoError(t, err)
	assert.Equal(t, expirationSettings{
		apiKeyMaxSecondsToLive: defaultTokenExpirationLimit,
		saTokenExpirationDays:  defaultTokenExpirationLimit,
	}, resolved)
}

func TestResolveExpirationSettingsErrors(t *testing.T) {
	loadErr := errors.New("load failed")
	tests := []struct {
		name           string
		cfgProvider    configprovider.ConfigProvider
		settingService settingsvc.Service
		errorContains  string
	}{
		{
			name:          "config provider error",
			cfgProvider:   &fakeConfigProvider{err: loadErr},
			errorContains: loadErr.Error(),
		},
		{
			name:          "config provider returns nil configuration",
			cfgProvider:   &fakeConfigProvider{},
			errorContains: "config provider returned nil configuration",
		},
		{
			name:           "setting service error",
			settingService: &fakeSettingService{err: loadErr},
			errorContains:  loadErr.Error(),
		},
		{
			name: "invalid multi-tenant value",
			settingService: &fakeSettingService{settings: []*settingsvc.Setting{
				{Section: authSection, Key: apiKeyMaxSecondsToLiveKey, Value: "not-a-number"},
			}},
			errorContains: "invalid setting auth.api_key_max_seconds_to_live",
		},
		{
			name:          "no configuration source",
			errorContains: "neither cfgProvider nor settingService is configured",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rest := NewTokensREST(nil, nil, noop.NewTracerProvider().Tracer("test"), tt.cfgProvider, tt.settingService)
			_, err := rest.resolveExpirationSettings(context.Background())
			require.ErrorContains(t, err, tt.errorContains)
		})
	}
}

func TestValidateExpiration(t *testing.T) {
	now := time.Date(2026, time.August, 18, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name             string
		expiresInSeconds int64
		settings         expirationSettings
		wantError        bool
	}{
		{
			name:             "defaults allow no expiration",
			expiresInSeconds: 0,
			settings:         expirationSettings{apiKeyMaxSecondsToLive: -1, saTokenExpirationDays: -1},
		},
		{
			name:             "global maximum requires expiration",
			expiresInSeconds: 0,
			settings:         expirationSettings{apiKeyMaxSecondsToLive: 60, saTokenExpirationDays: -1},
			wantError:        true,
		},
		{
			name:             "global maximum rejects value over limit",
			expiresInSeconds: 61,
			settings:         expirationSettings{apiKeyMaxSecondsToLive: 60, saTokenExpirationDays: -1},
			wantError:        true,
		},
		{
			name:             "global maximum accepts value at limit",
			expiresInSeconds: 60,
			settings:         expirationSettings{apiKeyMaxSecondsToLive: 60, saTokenExpirationDays: -1},
		},
		{
			name:             "explicit zero global maximum permits no positive lifetime",
			expiresInSeconds: 1,
			settings:         expirationSettings{apiKeyMaxSecondsToLive: 0, saTokenExpirationDays: -1},
			wantError:        true,
		},
		{
			name:             "day limit requires expiration",
			expiresInSeconds: 0,
			settings:         expirationSettings{apiKeyMaxSecondsToLive: -1, saTokenExpirationDays: 1},
			wantError:        true,
		},
		{
			name:             "day limit rejects expiration date over limit",
			expiresInSeconds: 36 * 60 * 60,
			settings:         expirationSettings{apiKeyMaxSecondsToLive: -1, saTokenExpirationDays: 1},
			wantError:        true,
		},
		{
			name:             "day limit accepts expiration date within limit",
			expiresInSeconds: 24 * 60 * 60,
			settings:         expirationSettings{apiKeyMaxSecondsToLive: -1, saTokenExpirationDays: 1},
		},
		{
			name:             "explicit zero day limit is disabled",
			expiresInSeconds: 0,
			settings:         expirationSettings{apiKeyMaxSecondsToLive: -1, saTokenExpirationDays: 0},
		},
		{
			name:             "global maximum remains enforced when both enabled",
			expiresInSeconds: 25 * 60 * 60,
			settings:         expirationSettings{apiKeyMaxSecondsToLive: 24 * 60 * 60, saTokenExpirationDays: 2},
			wantError:        true,
		},
		{
			name:             "day limit remains enforced when both enabled",
			expiresInSeconds: 36 * 60 * 60,
			settings:         expirationSettings{apiKeyMaxSecondsToLive: 48 * 60 * 60, saTokenExpirationDays: 1},
			wantError:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateExpiration(tt.expiresInSeconds, tt.settings, now)
			if tt.wantError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestHandleCreateDoesNotStoreRejectedToken(t *testing.T) {
	loadErr := errors.New("load failed")
	tests := []struct {
		name       string
		provider   configprovider.ConfigProvider
		isExpected func(error) bool
	}{
		{
			name: "expiration validation failure returns bad request",
			provider: &fakeConfigProvider{cfg: &setting.Cfg{
				ApiKeyMaxSecondsToLive:    60,
				SATokenExpirationDayLimit: -1,
			}},
			isExpected: apierrors.IsBadRequest,
		},
		{
			name:       "configuration failure returns internal error",
			provider:   &fakeConfigProvider{err: loadErr},
			isExpected: apierrors.IsInternalError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := &fakeLegacyStore{}
			rest := NewTokensREST(nil, store, noop.NewTracerProvider().Tracer("test"), tt.provider, nil)
			req, err := http.NewRequest(http.MethodPost, "/tokens", bytes.NewBufferString(`{"tokenName":"test-token","expiresInSeconds":61}`))
			require.NoError(t, err)
			responder := &fakeResponder{}

			rest.handleCreate(context.Background(), claims.NamespaceInfo{OrgID: 1}, "sa-uid", req, responder)

			require.Error(t, responder.err)
			assert.True(t, tt.isExpected(responder.err))
			assert.False(t, store.createCalled)
		})
	}
}

type fakeConfigProvider struct {
	configprovider.ConfigProvider
	cfg *setting.Cfg
	err error
}

func (f *fakeConfigProvider) Get(context.Context) (*setting.Cfg, error) {
	return f.cfg, f.err
}

type fakeSettingService struct {
	settings  []*settingsvc.Setting
	err       error
	called    bool
	selector  metav1.LabelSelector
	namespace string
}

func (f *fakeSettingService) List(ctx context.Context, selector metav1.LabelSelector) ([]*settingsvc.Setting, error) {
	f.called = true
	f.selector = selector
	f.namespace, _ = k8srequest.NamespaceFrom(ctx)
	return f.settings, f.err
}

func (f *fakeSettingService) ListAsIni(context.Context, metav1.LabelSelector) (*ini.File, error) {
	return nil, f.err
}

func (f *fakeSettingService) Describe(chan<- *prometheus.Desc) {}
func (f *fakeSettingService) Collect(chan<- prometheus.Metric) {}

type fakeLegacyStore struct {
	legacy.LegacyIdentityStore
	createCalled bool
}

func (f *fakeLegacyStore) CreateServiceAccountTokenWithHash(context.Context, claims.NamespaceInfo, legacy.CreateServiceAccountTokenWithHashCommand) error {
	f.createCalled = true
	return nil
}

type fakeResponder struct {
	err error
}

func (f *fakeResponder) Object(int, runtime.Object) {}

func (f *fakeResponder) Error(err error) {
	f.err = err
}
