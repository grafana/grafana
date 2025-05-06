package rendering

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
)

var ErrTimeout = errors.New("timeout error - you can set timeout in seconds with &timeout url parameter")
var ErrConcurrentLimitReached = errors.New("rendering concurrent limit reached")
var ErrRenderUnavailable = errors.New("rendering plugin not available")
var ErrServerTimeout = errutil.NewBase(errutil.StatusUnknown, "rendering.serverTimeout", errutil.WithPublicMessage("error trying to connect to image-renderer service"))
var ErrTooManyRequests = errutil.NewBase(errutil.StatusTooManyRequests, "rendering.tooManyRequests", errutil.WithPublicMessage("trying to send too many requests to image-renderer service"))

type RenderType string

const (
	RenderCSV RenderType = "csv"
	RenderPNG RenderType = "png"
	RenderPDF RenderType = "pdf"
)

type TimeoutOpts struct {
	Timeout                  time.Duration // Timeout param passed to image-renderer service
	RequestTimeoutMultiplier time.Duration // RequestTimeoutMultiplier used for plugin/HTTP request context timeout
}

type AuthOpts struct {
	OrgID   int64
	UserID  int64
	OrgRole org.RoleType
}

func getRequestTimeout(opt TimeoutOpts) time.Duration {
	if opt.RequestTimeoutMultiplier == 0 {
		return opt.Timeout * 2 // default
	}

	return opt.Timeout * opt.RequestTimeoutMultiplier
}

type CommonOpts struct {
	TimeoutOpts
	AuthOpts
	Path            string
	Timezone        string
	ConcurrentLimit int
	Headers         map[string][]string
}

type CSVOpts struct {
	CommonOpts
}

type Opts struct {
	CommonOpts
	ErrorOpts
	Width             int
	Height            int
	DeviceScaleFactor float64
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

type SanitizeSVGRequest struct {
	Filename string
	Content  []byte
}

type SanitizeSVGResponse struct {
	Sanitized []byte
}

type Result struct {
	FilePath string
	FileName string
}

type RenderResult struct {
	FilePath string
}

type RenderCSVResult struct {
	FilePath string
	FileName string
}

type renderFunc func(ctx context.Context, renderType RenderType, renderKey string, options Opts) (*RenderResult, error)
type renderCSVFunc func(ctx context.Context, renderKey string, options CSVOpts) (*RenderCSVResult, error)
type sanitizeFunc func(ctx context.Context, req *SanitizeSVGRequest) (*SanitizeSVGResponse, error)

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
	IsAvailable(ctx context.Context) bool
	Version() string
	Render(ctx context.Context, renderType RenderType, opts Opts, session Session) (*RenderResult, error)
	RenderCSV(ctx context.Context, opts CSVOpts, session Session) (*RenderCSVResult, error)
	RenderErrorImage(theme models.Theme, error error) (*RenderResult, error)
	GetRenderUser(ctx context.Context, key string) (*RenderUser, bool)
	HasCapability(ctx context.Context, capability CapabilityName) (CapabilitySupportRequestResult, error)
	IsCapabilitySupported(ctx context.Context, capability CapabilityName) error
	CreateRenderingSession(ctx context.Context, authOpts AuthOpts, sessionOpts SessionOpts) (Session, error)
	SanitizeSVG(ctx context.Context, req *SanitizeSVGRequest) (*SanitizeSVGResponse, error)
}
