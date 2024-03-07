package models

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrInternalNotImplementedError = errutil.Internal("cloudmigrations.notImplemented", errutil.WithPublicMessage("Internal server error"))
	ErrFeatureDisabledError        = errutil.Internal("cloudmigrations.disabled", errutil.WithPublicMessage("Cloud migrations are disabled on this instance"))
)
