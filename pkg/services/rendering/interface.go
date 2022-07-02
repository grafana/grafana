package rendering

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

var ErrTimeout = errors.New("timeout error - you can set timeout in seconds with &timeout url parameter")
var ErrConcurrentLimitReached = errors.New("rendering concurrent limit reached")
var ErrRenderUnavailable = errors.New("rendering plugin not available")

type RenderType string

const (
	RenderCSV RenderType = "csv"
	RenderPNG RenderType = "png"
)

type TimeoutOpts struct {
	Timeout                  time.Duration // Timeout param passed to image-renderer service
	RequestTimeoutMultiplier time.Duration // RequestTimeoutMultiplier used for plugin/HTTP request context timeout
}

type AuthOpts struct {
	OrgID   int64
	UserID  int64
	OrgRole models.RoleType
}

func getRequestTimeout(opt TimeoutOpts) time.Duration {
	if opt.RequestTimeoutMultiplier == 0 {
		return opt.Timeout * 2 // default
	}

	return opt.Timeout * opt.RequestTimeoutMultiplier
}

type Opts struct {
	TimeoutOpts
	AuthOpts
	ErrorOpts
	Width             int
	Height            int
	Path              string
	Encoding          string
	Timezone          string
	ConcurrentLimit   int
	DeviceScaleFactor float64
	Headers           map[string][]string
	Theme             models.Theme
}

type ErrorOpts struct {
	// ErrorConcurrentLimitReached returns an ErrConcurrentLimitReached
	// error instead of a rendering limit exceeded image.
	ErrorConcurrentLimitReached bool
	// ErrorRenderUnavailable returns an ErrRunderUnavailable error
	// instead of a rendering unavailable image.
	ErrorRenderUnavailable bool
}

type CSVOpts struct {
	TimeoutOpts
	AuthOpts
	Path            string
	Encoding        string
	Timezone        string
	ConcurrentLimit int
	Headers         map[string][]string
}

type RenderResult struct {
	FilePath string
}

type RenderCSVResult struct {
	FilePath string
	FileName string
}

type renderFunc func(ctx context.Context, renderKey string, options Opts) (*RenderResult, error)
type renderCSVFunc func(ctx context.Context, renderKey string, options CSVOpts) (*RenderCSVResult, error)

type renderKeyProvider interface {
	get(ctx context.Context, opts AuthOpts) (string, error)
	afterRequest(ctx context.Context, opts AuthOpts, renderKey string)
}

type SessionOpts struct {
	Expiry                     time.Duration
	RefreshExpiryOnEachRequest bool
}

type Session interface {
	renderKeyProvider
	Dispose(ctx context.Context)
}

type CapabilitySupportRequestResult struct {
	IsSupported      bool
	SemverConstraint string
}

//go:generate mockgen -destination=mock.go -package=rendering github.com/grafana/grafana/pkg/services/rendering Service
type Service interface {
	IsAvailable() bool
	Version() string
	Render(ctx context.Context, opts Opts, session Session) (*RenderResult, error)
	RenderCSV(ctx context.Context, opts CSVOpts, session Session) (*RenderCSVResult, error)
	RenderErrorImage(theme models.Theme, error error) (*RenderResult, error)
	GetRenderUser(ctx context.Context, key string) (*RenderUser, bool)
	HasCapability(capability CapabilityName) (CapabilitySupportRequestResult, error)
	CreateRenderingSession(ctx context.Context, authOpts AuthOpts, sessionOpts SessionOpts) (Session, error)
}
