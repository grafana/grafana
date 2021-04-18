package schemaloader

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/remotecache"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	remotecache.Register(&RenderUser{})
	registry.Register(&registry.Descriptor{
		Name:     ServiceName,
		Instance: &SchemaLoaderService{},
	})
}

const ServiceName = "SchemaLoader"

type RenderUser struct {
	OrgID   int64
	UserID  int64
	OrgRole string
}

type SchemaLoaderService struct {
	log log.Logger
	Cfg *setting.Cfg `inject:""`
}

func (rs *SchemaLoaderService) Init() error {
	rs.log = log.New("schemaloader")

	fmt.Println("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<I passed")
	// // ensure ImagesDir exists
	// err := os.MkdirAll(rs.Cfg.ImagesDir, 0700)
	// if err != nil {
	// 	return fmt.Errorf("failed to create images directory %q: %w", rs.Cfg.ImagesDir, err)
	// }

	// set value used for domain attribute of renderKey cookie
	// switch {
	// case rs.Cfg.RendererUrl != "":
	// RendererCallbackUrl has already been passed, it won't generate an error.
	// u, _ := url.Parse(rs.Cfg.RendererCallbackUrl)
	// 	rs.domain = u.Hostname()
	// case rs.Cfg.HTTPAddr != setting.DefaultHTTPAddr:
	// 	rs.domain = rs.Cfg.HTTPAddr
	// default:
	// 	rs.domain = "localhost"
	// }

	return nil
}
