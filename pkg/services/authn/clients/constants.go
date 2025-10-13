package clients

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

const (
	basicPrefix             = "Basic "
	bearerPrefix            = "Bearer "
	authorizationHeaderName = "Authorization"
)

var (
	errIdentityNotFound = errutil.NotFound("identity.not-found")
)
