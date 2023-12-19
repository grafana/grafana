package ssosettings

import (
	"errors"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrNotFound = errors.New("not found")

	ErrInvalidProvider = errutil.ValidationFailed("sso.invalidProvider", errutil.WithPublicMessage("provider is invalid"))
)
