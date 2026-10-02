package serviceaccounttoken

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	authSection                 = "auth"
	apiKeyMaxSecondsToLiveKey   = "api_key_max_seconds_to_live"
	serviceAccountsSection      = "service_accounts"
	tokenExpirationDayLimitKey  = "token_expiration_day_limit"
	defaultTokenExpirationLimit = int64(-1)
)

var tokenExpirationSettingsSelector = metav1.LabelSelector{
	MatchExpressions: []metav1.LabelSelectorRequirement{
		{
			Key:      "section",
			Operator: metav1.LabelSelectorOpIn,
			Values:   []string{authSection, serviceAccountsSection},
		},
		{
			Key:      "key",
			Operator: metav1.LabelSelectorOpIn,
			Values:   []string{apiKeyMaxSecondsToLiveKey, tokenExpirationDayLimitKey},
		},
	},
}

type expirationSettings struct {
	apiKeyMaxSecondsToLive int64
	saTokenExpirationDays  int64
}

func (s *TokensREST) resolveExpirationSettings(ctx context.Context) (expirationSettings, error) {
	if s.cfgProvider != nil {
		cfg, err := s.cfgProvider.Get(ctx)
		if err != nil {
			return expirationSettings{}, err
		}
		if cfg == nil {
			return expirationSettings{}, errors.New("config provider returned nil configuration")
		}
		return expirationSettings{
			apiKeyMaxSecondsToLive: cfg.ApiKeyMaxSecondsToLive,
			saTokenExpirationDays:  int64(cfg.SATokenExpirationDayLimit),
		}, nil
	}

	if s.settingService != nil {
		resolved := expirationSettings{
			apiKeyMaxSecondsToLive: defaultTokenExpirationLimit,
			saTokenExpirationDays:  defaultTokenExpirationLimit,
		}
		settings, err := s.settingService.List(ctx, tokenExpirationSettingsSelector)
		if err != nil {
			return expirationSettings{}, err
		}
		for _, setting := range settings {
			if setting == nil || strings.TrimSpace(setting.Value) == "" {
				continue
			}

			var target *int64
			switch {
			case setting.Section == authSection && setting.Key == apiKeyMaxSecondsToLiveKey:
				target = &resolved.apiKeyMaxSecondsToLive
			case setting.Section == serviceAccountsSection && setting.Key == tokenExpirationDayLimitKey:
				target = &resolved.saTokenExpirationDays
			default:
				continue
			}

			value, err := strconv.ParseInt(strings.TrimSpace(setting.Value), 10, 64)
			if err != nil {
				return expirationSettings{}, fmt.Errorf("invalid setting %s.%s: %w", setting.Section, setting.Key, err)
			}
			*target = value
		}
		return resolved, nil
	}

	return expirationSettings{}, errors.New("service account token REST: neither cfgProvider nor settingService is configured")
}

func validateExpiration(expiresInSeconds int64, settings expirationSettings, now time.Time) error {
	if settings.apiKeyMaxSecondsToLive != defaultTokenExpirationLimit {
		if expiresInSeconds == 0 {
			return errors.New("expiresInSeconds is required when auth.api_key_max_seconds_to_live is set")
		}
		if expiresInSeconds > settings.apiKeyMaxSecondsToLive {
			return errors.New("expiresInSeconds exceeds auth.api_key_max_seconds_to_live")
		}
	}

	if settings.saTokenExpirationDays > 0 {
		if expiresInSeconds == 0 {
			return errors.New("expiresInSeconds is required when service_accounts.token_expiration_day_limit is set")
		}

		dayExpireLimit := now.Add(time.Duration(settings.saTokenExpirationDays) * 24 * time.Hour).Truncate(24 * time.Hour)
		expirationDate := now.Add(time.Duration(expiresInSeconds) * time.Second).Truncate(24 * time.Hour)
		if expirationDate.After(dayExpireLimit) {
			return errors.New("expiration date exceeds service_accounts.token_expiration_day_limit")
		}
	}

	return nil
}
