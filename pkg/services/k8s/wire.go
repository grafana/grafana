package k8s

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/services/k8s/informer"
	"github.com/grafana/grafana/pkg/services/k8s/resources"
)

var WireSet = wire.NewSet(resources.WireSet, client.WireSet, informer.WireSet)
