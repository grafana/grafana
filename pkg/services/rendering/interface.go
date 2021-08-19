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

type Opts struct {
	Width             int
	Height            int
	Timeout           time.Duration
	OrgID             int64
	UserID            int64
	OrgRole           models.RoleType
	Path              string
	Encoding          string
	Timezone          string
	ConcurrentLimit   int
	DeviceScaleFactor float64
	Headers           map[string][]string
}

type CSVOpts struct {
	Timeout         time.Duration
	OrgID           int64
	UserID          int64
	OrgRole         models.RoleType
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

type Service interface {
	IsAvailable() bool
	Version() string
	Render(ctx context.Context, opts Opts) (*RenderResult, error)
	RenderCSV(ctx context.Context, opts CSVOpts) (*RenderCSVResult, error)
	RenderErrorImage(error error) (*RenderResult, error)
	GetRenderUser(key string) (*RenderUser, bool)
}
