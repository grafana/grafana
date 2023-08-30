package requestmeta

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/web"
)

const (
	TeamAlerting = "alerting"
	TeamAuth     = "auth"
	TeamCore     = "core"
)

type StatusSource string

const (
	StatusSourceServer     StatusSource = "server"
	StatusSourceDownstream StatusSource = "downstream"
)

func (ss StatusSource) String() string {
	return string(ss)
}

type rMDContextKey struct{}

type RequestMetaData struct {
	Team         string
	StatusSource StatusSource
}

var requestMetaDataContextKey = rMDContextKey{}

// SetupRequestMetadata injects defaul request metadata values
// on the request context.
func SetupRequestMetadata() web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rmd := defaultRequestMetadata()

			ctx := context.WithValue(r.Context(), requestMetaDataContextKey, rmd)
			*r = *r.WithContext(ctx)

			next.ServeHTTP(w, r)
		})
	}
}

// GetRequestMetaData returns the request metadata for the context.
// if request metadata is missing it will return the default values.
func GetRequestMetaData(ctx context.Context) *RequestMetaData {
	val := ctx.Value(requestMetaDataContextKey)

	value, ok := val.(*RequestMetaData)
	if ok {
		return value
	}

	return defaultRequestMetadata()
}

// SetOwner returns an `web.Handler` that sets the team name for an request.
func SetOwner(team string) web.Handler {
	return func(w http.ResponseWriter, r *http.Request) {
		v := GetRequestMetaData(r.Context())
		v.Team = team
	}
}

// SetOwner returns an `web.Handler` that sets the team name for an request.
func WithDownstreamStatusSource(ctx context.Context) {
	v := GetRequestMetaData(ctx)
	v.StatusSource = StatusSourceDownstream
}

func defaultRequestMetadata() *RequestMetaData {
	return &RequestMetaData{
		Team:         TeamCore,
		StatusSource: StatusSourceServer,
	}
}
