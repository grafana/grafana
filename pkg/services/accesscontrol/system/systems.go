package system

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type Systems struct {
	systems []*System
}

func ProvideSystems(router routing.RouteRegister, ac accesscontrol.AccessControl, store accesscontrol.ResourceStore) (*Systems, error) {
	return &Systems{systems: []*System{}}, nil
}
