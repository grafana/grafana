package clients

import "github.com/grafana/grafana/pkg/util/errutil"

const (
	basicPrefix             = "Basic "
	bearerPrefix            = "Bearer "
	authorizationHeaderName = "Authorization"
)

var (
	errIdentityNotFound = errutil.NewBase(errutil.StatusNotFound, "identity.not-found")
	errInvalidPassword  = errutil.NewBase(errutil.StatusBadRequest, "identity.invalid-password", errutil.WithPublicMessage("Invalid password or username"))
)
