package jwt

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSettings_RoundTrip(t *testing.T) {
	src := setting.AuthJWTSettings{
		Enabled:                 true,
		HeaderName:              "X-JWT-Assertion",
		EmailClaim:              "email",
		UsernameClaim:           "sub",
		ExpectClaims:            `{"iss":"https://example.com"}`,
		JWKSetURL:               "https://example.com/.well-known/jwks.json",
		CacheTTL:                30 * time.Minute,
		AutoSignUp:              true,
		RoleAttributePath:       "roles[0]",
		RoleAttributeStrict:     true,
		AllowAssignGrafanaAdmin: false,
		SkipOrgRoleSync:         false,
		OrgMapping:              []string{"team-a:1:Editor", "team-b:2:Viewer"},
		OrgAttributePath:        "groups",
	}

	got, err := SettingsFromMap(SettingsToMap(src))
	require.NoError(t, err)
	require.Equal(t, src, got)
}

func TestSettingsFromMap_RejectsTypeMismatch(t *testing.T) {
	_, err := SettingsFromMap(map[string]any{"header_name": 42})
	require.Error(t, err)
	require.Contains(t, err.Error(), "header_name")
}

func TestSettingsFromMap_RejectsInvalidCacheTTL(t *testing.T) {
	_, err := SettingsFromMap(map[string]any{"cache_ttl": "not-a-duration"})
	require.Error(t, err)
	require.Contains(t, err.Error(), "cache_ttl")
}

func TestValidate_NoOpWhenDisabled(t *testing.T) {
	s := &AuthService{Cfg: &setting.Cfg{}}

	err := s.Validate(context.Background(), models.SSOSettings{
		Settings: map[string]any{"enabled": false},
	}, models.SSOSettings{}, nil)
	require.NoError(t, err)
}

func TestValidate_RequiresHeaderOrURLLogin(t *testing.T) {
	s := &AuthService{Cfg: &setting.Cfg{}}

	err := s.Validate(context.Background(), models.SSOSettings{
		Settings: map[string]any{
			"enabled":     true,
			"jwk_set_url": "https://example.com/.well-known/jwks.json",
		},
	}, models.SSOSettings{}, nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "header_name")
}

func TestValidate_RejectsAmbiguousKeySource(t *testing.T) {
	s := &AuthService{Cfg: &setting.Cfg{}}

	err := s.Validate(context.Background(), models.SSOSettings{
		Settings: map[string]any{
			"enabled":      true,
			"header_name":  "X-JWT",
			"jwk_set_url":  "https://example.com/.well-known/jwks.json",
			"jwk_set_file": "/tmp/jwks.json",
		},
	}, models.SSOSettings{}, nil)
	require.ErrorIs(t, err, ErrKeySetConfigurationAmbiguous)
}

func TestValidate_RequiresHTTPSJWKSetURL(t *testing.T) {
	s := &AuthService{Cfg: &setting.Cfg{Env: setting.Prod}}

	err := s.Validate(context.Background(), models.SSOSettings{
		Settings: map[string]any{
			"enabled":     true,
			"header_name": "X-JWT",
			"jwk_set_url": "http://example.com/.well-known/jwks.json",
		},
	}, models.SSOSettings{}, nil)
	require.ErrorIs(t, err, ErrJWTSetURLMustHaveHTTPSScheme)
}

func TestValidate_RejectsInvalidExpectClaims(t *testing.T) {
	s := &AuthService{Cfg: &setting.Cfg{}}

	err := s.Validate(context.Background(), models.SSOSettings{
		Settings: map[string]any{
			"enabled":       true,
			"header_name":   "X-JWT",
			"jwk_set_url":   "https://example.com/.well-known/jwks.json",
			"expect_claims": "{not-json",
		},
	}, models.SSOSettings{}, nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "expect_claims")
}

func TestReload_DisabledClearsKeyset(t *testing.T) {
	s := &AuthService{Cfg: &setting.Cfg{}, log: log.New("test")}

	err := s.Reload(context.Background(), models.SSOSettings{
		Settings: map[string]any{"enabled": false},
	})
	require.NoError(t, err)
	require.False(t, s.Settings().Enabled)

	s.mu.RLock()
	defer s.mu.RUnlock()
	require.Nil(t, s.keySet)
}

// TestReload_RaceWithVerify exercises Verify against concurrent Reload calls
// under -race. The mutex contract on AuthService is what keeps Verify's
// snapshot of keySet/expect/expectRegistered consistent — this test exists to
// catch any future change that breaks that invariant.
func TestReload_RaceWithVerify(t *testing.T) {
	s := &AuthService{Cfg: &setting.Cfg{}, log: log.New("test")}

	disabled := models.SSOSettings{Settings: map[string]any{"enabled": false}}

	var wg sync.WaitGroup
	stop := make(chan struct{})

	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stop:
				return
			default:
				_ = s.Reload(context.Background(), disabled)
			}
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stop:
				return
			default:
				// Verify will return an error (no keyset configured) but must
				// not race or panic against the concurrent Reload.
				_, _ = s.Verify(context.Background(), "not.a.token")
			}
		}
	}()

	time.Sleep(50 * time.Millisecond)
	close(stop)
	wg.Wait()
}
