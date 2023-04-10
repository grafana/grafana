package k8s

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/services/k8s/apiserver"
	"github.com/grafana/grafana/pkg/services/k8s/authnz"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/services/k8s/informer"
	"github.com/grafana/grafana/pkg/services/k8s/resources"
	"github.com/grafana/grafana/pkg/services/k8s/resources/publicdashboard/webhooks"
)

var WireSet = wire.NewSet(resources.WireSet, client.WireSet, informer.WireSet, apiserver.WireSet, authnz.WireSet, webhooks.ProvideWebhooks)
