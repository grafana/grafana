package ssosettings

import (
	"errors"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrNotFound = errors.New("not found")

	ErrInvalidProvider = errutil.ValidationFailed("sso.invalidProvider", errutil.WithPublicMessage("provider is invalid"))
	ErrInvalidSettings = errutil.ValidationFailed("sso.settings", errutil.WithPublicMessage("settings field is invalid"))
	ErrEmptyClientId   = errutil.ValidationFailed("sso.emptyClientId", errutil.WithPublicMessage("settings.clientId cannot be empty"))
)
