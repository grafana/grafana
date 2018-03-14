package renderer

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

var ErrTimeout = errors.New("Timeout error. You can set timeout in seconds with &timeout url parameter")

type Opts struct {
	Width   int
	Height  int
	Timeout time.Duration
	OrgID   int64
	UserID  int64
	OrgRole models.RoleType
	Path    string
}

type Renderer interface {
	Render(opts Opts) (string, error)

	// Close cleans up renderer resources (kills the browser)
	Close()
}
