package requestmeta

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/web"
)

const (
	TeamAlerting = "alerting"
	TeamAuth     = "auth"
	TeamBackend  = "backend"
)

type StatusSource string

const (
	StatusSourceServer     StatusSource = "server"
	StatusSourceDownstream StatusSource = "downstream"
)

type RequestMetaData struct {
	Team         string
	StatusSource StatusSource
	SLOGroup     SLOGroup
}

type SLOGroup string

const (
	// SLOGroupHighFast is the default slo group for handlers in Grafana
	// Most handlers should respond quickly
	SLOGroupHighFast SLOGroup = "high-fast"

	// SLOGroupHighMedium is used for handlers that might take some
	// time to respond.
	SLOGroupHighMedium SLOGroup = "high-medium"

	// SLOGroupHighSlow is used by handlers that proxies requests downstream.
	// We expect an high successrate but without latency garantess
	SLOGroupHighSlow SLOGroup = "high-slow"

	// SLOGroupLow should only be used for experimental features
	// that might not be stable enough for our normal SLO
	SLOGroupLow SLOGroup = "low"

	// SLOGroupNone means that errors are expect for this handler and
	// it should not be included in the SLO.
	SLOGroupNone SLOGroup = "none"
)

type rMDContextKey struct{}

var requestMetaDataContextKey = rMDContextKey{}

// SetupRequestMetadata injects defaul request metadata values
// on the request context.
func SetupRequestMetadata() web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rmd := defaultRequestMetadata()
			ctx := SetRequestMetaData(r.Context(), rmd)
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

	rmd := defaultRequestMetadata()
	return &rmd
}

// SetRequestMetaData sets the request metadata for the context.
func SetRequestMetaData(ctx context.Context, rmd RequestMetaData) context.Context {
	return context.WithValue(ctx, requestMetaDataContextKey, &rmd)
}

// SetOwner returns an `web.Handler` that sets the team name for an request.
func SetOwner(team string) web.Handler {
	return func(w http.ResponseWriter, r *http.Request) {
		v := GetRequestMetaData(r.Context())
		v.Team = team
	}
}

// WithDownstreamStatusSource sets the StatusSource field of the [RequestMetaData] for the
// context to [StatusSourceDownstream].
func WithDownstreamStatusSource(ctx context.Context) {
	v := GetRequestMetaData(ctx)
	v.StatusSource = StatusSourceDownstream
}

// WithStatusSource sets the StatusSource field of the [RequestMetaData] for the
// context based on the provided statusCode.
// If statusCode >= 500 then [StatusSourceDownstream].
// If statusCode < 500 then [StatusSourceServer].
func WithStatusSource(ctx context.Context, statusCode int) {
	v := GetRequestMetaData(ctx)

	if statusCode >= 500 {
		v.StatusSource = StatusSourceDownstream
		return
	}

	v.StatusSource = StatusSourceServer
}

func defaultRequestMetadata() RequestMetaData {
	return RequestMetaData{
		Team:         TeamBackend,
		StatusSource: StatusSourceServer,
		SLOGroup:     SLOGroupHighFast,
	}
}

// SetSLOGroup creates an middleware that sets the SLOGroup for the request
func SetSLOGroup(lvl SLOGroup) web.Handler {
	return func(w http.ResponseWriter, r *http.Request) {
		v := GetRequestMetaData(r.Context())
		v.SLOGroup = lvl
	}
}
