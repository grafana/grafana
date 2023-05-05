package k8s

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/services/k8s/apiserver"
)

var WireSet = wire.NewSet(apiserver.WireSet)
