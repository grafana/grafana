package ssosettings

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errNotFoundBase = errutil.NotFound("sso.notFound", errutil.WithPublicMessage("The provider was not found."))
	ErrNotFound     = errNotFoundBase.Errorf("not found")

	ErrNotConfigurable = errNotFoundBase.Errorf("not configurable")

	errInvalidOAuthInfo = errutil.ValidationFailed("sso.invalidOAuthInfo")

	ErrOauthValidationError = func(msg string, payload map[string]any) error {
		base := errInvalidOAuthInfo.Errorf("OAuth settings are invalid")
		base.PublicMessage = msg
		base.PublicPayload = payload
		return base
	}

	ErrInvalidProvider = errutil.ValidationFailed("sso.invalidProvider", errutil.WithPublicMessage("Provider is invalid"))
	ErrInvalidSettings = errutil.ValidationFailed("sso.settings", errutil.WithPublicMessage("Settings field is invalid"))
	ErrEmptyClientId   = errutil.ValidationFailed("sso.emptyClientId", errutil.WithPublicMessage("ClientId cannot be empty"))
)
