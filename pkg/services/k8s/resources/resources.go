package resources

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/services/k8s/resources/dashboards"
)

var WireSet = wire.NewSet(dashboards.WireSet)
