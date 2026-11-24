package informer

import (
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/informers"
)

// DeltaSource is what the provisioning controllers receive events from; see
// informers.DeltaSource.
type DeltaSource = informers.DeltaSource

// queueGroup is the NATS queue group every provisioning informer joins, so each
// notification is round-robined to a single replica rather than broadcast to all.
const queueGroup = "provisioning-informer"

// The per-resource constructors (one per type file) bind LIST to that resource's
// typed client and build the minimal live-event object as the resource's concrete
// type, so the controller's event handler keys off the right type. namespace
// scopes the NATS subscription and the LIST; pass "" to watch every namespace.
// Each type file also has a New<Type>DeltaSource that declares what its
// controller needs and builds the informer the supplier selects for it.

// newDeltaSource builds the informer supplier selects for info's resource given
// needs, delivering each object to the controller as a newObject().
func newDeltaSource(supplier operator.InformerSupplier, clients resource.ClientGenerator, info utils.ResourceInfo, needs operator.WatchOptions, resync time.Duration, newObject func() runtime.Object) (DeltaSource, error) {
	return informers.NewDeltaSource(operator.InformerRequest{
		Kind:     informers.UntypedKind(info.GroupVersionResource(), info.GroupVersionKind().Kind),
		Clients:  clients,
		Supplier: supplier,
		Options:  operator.InformerOptions{WatchNeeds: needs, CacheResyncInterval: resync},
	}, newObject)
}
