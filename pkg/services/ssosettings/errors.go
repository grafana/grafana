package ssosettings

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errNotFoundBase = errutil.NotFound("sso.notFound", errutil.WithPublicMessage("The provider was not found."))
	ErrNotFound     = errNotFoundBase.Errorf("not found")

	ErrNotConfigurable = errNotFoundBase.Errorf("not configurable")

	ErrInvalidProvider = errutil.ValidationFailed("sso.invalidProvider", errutil.WithPublicMessage("Provider is invalid"))
	ErrInvalidSettings = errutil.ValidationFailed("sso.settings", errutil.WithPublicMessage("Settings field is invalid"))
	ErrEmptyClientId   = errutil.ValidationFailed("sso.emptyClientId", errutil.WithPublicMessage("ClientId cannot be empty"))
)
