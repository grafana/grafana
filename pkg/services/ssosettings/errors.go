package ssosettings

import (
	"errors"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrNotFound = errors.New("not found")

	ErrInvalidSettings   = errutil.ValidationFailed("sso.settings", errutil.WithPublicMessage("settings field is invalid"))
	ErrEmptyClientId     = errutil.ValidationFailed("sso.emptyClientId", errutil.WithPublicMessage("settings.clientId cannot be empty"))
	ErrEmptyClientSecret = errutil.ValidationFailed("sso.emptyClientSecret", errutil.WithPublicMessage("settings.clientSecret cannot be empty"))
)
