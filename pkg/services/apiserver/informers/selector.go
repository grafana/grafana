// Package informers builds the informers of every controller that can be fed by
// NATS, in-process and in the standalone operators, so that which watch
// mechanism serves a kind is decided in one place.
//
// Each kind declares what its handlers need as an operator.WatchOptions, and each
// mechanism advertises what it provides. The SDK's selecting supplier (the
// decider) gives the kind the first, least capable mechanism that satisfies it,
// and the API watch when none does.
package informers

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/setting"
)

// DeltaSource is the subset of cache.SharedIndexInformer the controllers use to
// receive events: register a handler (whose registration reports HasSynced) and
// run until stopped. An apiserver SharedIndexInformer and the NATS-backed
// informers all satisfy it, so a controller does not know which it was given.
type DeltaSource interface {
	AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error)
	Run(stopCh <-chan struct{})
}

// What each mechanism provides, least capable first: the order they are offered in.
var (
	// ReList has no live channel: it re-lists every object on a schedule.
	ReList = operator.WatchOptions{
		Resync: &operator.WatchResyncOptions{},
	}
	// NotifyOnly delivers identities live, round-robined over the replicas, with no resync.
	NotifyOnly = operator.WatchOptions{
		Live: &operator.WatchLiveOptions{Detail: operator.WatchDetailIdentity, Distribution: operator.WatchDistributionShared},
	}
	// NotifyWithReList is NotifyOnly plus a keys-only re-list delivered to every replica.
	NotifyWithReList = operator.WatchOptions{
		Live:   NotifyOnly.Live,
		Resync: &operator.WatchResyncOptions{Detail: operator.WatchDetailIdentity},
	}
	// apiWatch is the fallback: whole objects live and on resync, to every replica.
	apiWatch = operator.WatchOptions{
		Live:   &operator.WatchLiveOptions{},
		Resync: &operator.WatchResyncOptions{},
	}
)

// KeyedNeeds is what a work-queue controller needs when it enqueues keys and reads
// each object fresh: identities are enough, each key is worked once so live
// deliveries may be shared, and the resync recovers whatever the live channel
// missed.
var KeyedNeeds = operator.WatchOptions{
	Live:   &operator.WatchLiveOptions{Detail: operator.WatchDetailIdentity, Distribution: operator.WatchDistributionShared},
	Resync: &operator.WatchResyncOptions{Detail: operator.WatchDetailIdentity},
}

var errNotImplemented = errors.New("not implemented")

// Selector offers the watch mechanisms this deployment has. A nil Selector offers
// none, so every kind gets the API watch.
type Selector struct {
	// reList is offered whenever NATS is configured: under NATS there is no
	// apiserver watch worth keeping a cache for. It reads the flag rather than the
	// subscriber because it needs no subscription.
	reList     bool
	subscriber nats.Subscriber
}

// ProvideSelector builds the Selector from the NATS configuration and subscriber.
// subscriber may be nil, which offers no live mechanism.
func ProvideSelector(cfg *setting.Cfg, subscriber nats.Subscriber) *Selector {
	return &Selector{reList: cfg.NATS.Enabled, subscriber: subscriber}
}

func (p *Selector) offersReList() bool { return p != nil && p.reList }
func (p *Selector) offersLive() bool   { return p != nil && nats.Enabled(p.subscriber) }

// Supplier is the decider for SDK-based apps and operators, to set as
// simple.AppInformerConfig.InformerSupplier or simple.OperatorConfig.InformerSupplier.
// Only the re-list is implemented as an SDK informer; the NATS mechanisms are
// advertised but fail to build until they have SDK implementations.
func (p *Selector) Supplier() operator.InformerSupplier {
	return operator.NewSelectingInformerSupplier(simple.DefaultInformerSupplier,
		offer(p.offersReList(), ReList, newReListInformer),
		offer(p.offersLive(), NotifyOnly, unimplemented("NATS notify-only")),
		offer(p.offersLive(), NotifyWithReList, unimplemented("NATS notify with re-list")),
	)
}

// Sources is how a client-go controller can be watched: what its handlers need,
// and a constructor for each mechanism it has an implementation of. Watch, the
// API watch, is required since it is the fallback.
type Sources struct {
	GVR   schema.GroupVersionResource
	Needs operator.WatchOptions
	Watch func() DeltaSource
	// ReList builds a source with no live channel that re-lists on a schedule.
	ReList func() DeltaSource
	// NotifyWithReList builds a source fed live by the NATS subscriber, with a
	// keys-only re-list.
	NotifyWithReList func(subscriber nats.Subscriber) DeltaSource
}

// Source selects and builds the DeltaSource for a client-go controller with the
// same decider Supplier uses. It fails when the selected mechanism provides less
// than the controller needs, as the SDK does for its own informers.
func (p *Selector) Source(s Sources) (DeltaSource, error) {
	if s.Watch == nil {
		return nil, fmt.Errorf("%s: no API watch to fall back to", s.GVR)
	}
	var notify func() DeltaSource
	if s.NotifyWithReList != nil {
		notify = func() DeltaSource { return s.NotifyWithReList(p.subscriber) }
	}
	kind := resource.Kind{Schema: resource.NewSimpleSchema(s.GVR.Group, s.GVR.Version,
		&resource.UntypedObject{}, &resource.UntypedList{}, resource.WithPlural(s.GVR.Resource))}

	inf, err := operator.BuildInformer(operator.InformerRequest{
		Kind: kind,
		Supplier: operator.NewSelectingInformerSupplier(sourceSupplier(apiWatch, s.Watch),
			offer(p.offersReList() && s.ReList != nil, ReList, sourceSupplier(ReList, s.ReList)),
			// No controller has a notify-only source.
			nil,
			offer(p.offersLive() && notify != nil, NotifyWithReList, sourceSupplier(NotifyWithReList, notify)),
		),
		Options: operator.InformerOptions{WatchNeeds: s.Needs},
	})
	if err != nil {
		return nil, err
	}
	built, ok := inf.(sourceInformer)
	if !ok {
		return nil, fmt.Errorf("%s: selected informer %T is not a client-go source", s.GVR, inf)
	}
	return built.source, nil
}

// offer lists a mechanism when the deployment has it; a nil mechanism is skipped.
func offer(available bool, provides operator.WatchOptions, supplier operator.InformerSupplier) operator.InformerMechanism {
	if !available {
		return nil
	}
	return operator.NewInformerMechanism(provides, supplier)
}

func unimplemented(mechanism string) operator.InformerSupplier {
	return func(kind resource.Kind, _ resource.ClientGenerator, _ operator.InformerOptions) (operator.Informer, error) {
		return nil, fmt.Errorf("%s informer for %s: %w", mechanism, kind.GroupVersionKind(), errNotImplemented)
	}
}

func sourceSupplier(provides operator.WatchOptions, build func() DeltaSource) operator.InformerSupplier {
	return func(resource.Kind, resource.ClientGenerator, operator.InformerOptions) (operator.Informer, error) {
		return sourceInformer{source: build(), provides: provides}, nil
	}
}

// sourceInformer carries a client-go DeltaSource through the SDK's selection. It
// is only ever unwrapped by Source; handlers register on the DeltaSource.
type sourceInformer struct {
	source   DeltaSource
	provides operator.WatchOptions
}

var errRegisterOnSource = errors.New("register handlers on the client-go DeltaSource")

func (s sourceInformer) Run(ctx context.Context) error {
	s.source.Run(ctx.Done())
	return nil
}

func (s sourceInformer) WaitForSync(context.Context) error              { return errRegisterOnSource }
func (s sourceInformer) AddEventHandler(operator.ResourceWatcher) error { return errRegisterOnSource }
func (s sourceInformer) WatchOptions() operator.WatchOptions            { return s.provides }
