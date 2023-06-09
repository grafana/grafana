package k8s

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/services/k8s/apiserver"
	"github.com/grafana/grafana/pkg/services/k8s/client"
)

var WireSet = wire.NewSet(apiserver.WireSet, client.WireSet)
