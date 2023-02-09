package modules

import "github.com/grafana/dskit/services"

const (
	HTTPServer string = "http-server"
	Core       string = "core"
)

type Service interface {
	RegisterModule(name string, initFn func() (services.Service, error), deps ...string) error
}
