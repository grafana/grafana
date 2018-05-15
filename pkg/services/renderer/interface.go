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
	OrgId   int64
	UserId  int64
	OrgRole models.RoleType
	Path    string
}

type Renderer interface {
	Render(opts Opts) (string, error)
}
