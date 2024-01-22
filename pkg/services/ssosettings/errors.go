package ssosettings

import (
	"errors"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrNotFound = errors.New("not found")

	ErrInvalidProvider = errutil.ValidationFailed("sso.invalidProvider", errutil.WithPublicMessage("Provider is invalid"))
	ErrInvalidSettings = errutil.ValidationFailed("sso.settings", errutil.WithPublicMessage("Settings field is invalid"))
	ErrEmptyClientId   = errutil.ValidationFailed("sso.emptyClientId", errutil.WithPublicMessage("ClientId cannot be empty"))
)
