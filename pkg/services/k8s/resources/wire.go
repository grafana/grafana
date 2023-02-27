package resources

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/services/k8s/resources/dashboard"
)

var WireSet = wire.NewSet(
	dashboard.WireSet,
	GeneratedWireSet,
)
