package jwt

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/setting"
)

var _ ssosettings.Reloadable = (*AuthService)(nil)

func (s *AuthService) Validate(_ context.Context, settings models.SSOSettings, _ models.SSOSettings, _ identity.Requester) error {
	parsed, err := SettingsFromMap(settings.Settings)
	if err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("%w", err)
	}
	if err := validateJWTSettings(parsed, s.Cfg.Env); err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("%w", err)
	}
	return nil
}

func (s *AuthService) Reload(_ context.Context, settings models.SSOSettings) error {
	parsed, err := SettingsFromMap(settings.Settings)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	return s.apply(parsed)
}

// validateJWKSetURL parses the URL and rejects non-https outside Dev mode.
// Empty input is a no-op so callers can pass through unconditionally.
func validateJWKSetURL(rawURL, env string) error {
	if rawURL == "" {
		return nil
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid jwk_set_url: %w", err)
	}
	if u.Scheme != "https" && env != setting.Dev {
		return ErrJWTSetURLMustHaveHTTPSScheme
	}
	return nil
}

func validateJWTSettings(parsed setting.AuthJWTSettings, env string) error {
	if !parsed.Enabled {
		return nil
	}

	if parsed.HeaderName == "" && !parsed.URLLogin {
		return fmt.Errorf("either header_name must be set or url_login must be enabled")
	}

	if err := checkKeySetConfiguration(parsed); err != nil {
		return err
	}

	if err := validateJWKSetURL(parsed.JWKSetURL, env); err != nil {
		return err
	}

	if parsed.ExpectClaims != "" {
		var dummy map[string]any
		if err := json.Unmarshal([]byte(parsed.ExpectClaims), &dummy); err != nil {
			return fmt.Errorf("invalid expect_claims: %w", err)
		}
	}

	return nil
}
