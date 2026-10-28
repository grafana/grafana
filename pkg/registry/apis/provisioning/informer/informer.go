package informer

import (
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// DeltaSource is the subset of cache.SharedIndexInformer the controllers use to
// receive events. Aliased rather than redeclared: an apiserver-backed
// SharedIndexInformer and the app-sdk-backed sources satisfy the same interface,
// and the wiring picks one without the controller knowing which.
type DeltaSource = usinformer.DeltaSource

// queueGroup is the NATS queue group every provisioning informer joins, so each
// notification is round-robined to a single replica rather than broadcast to all.
const queueGroup = "provisioning-informer"

// The per-resource constructors (one per type file) bind LIST to that resource's
// typed client and name the object the controller's event handler expects back.
// namespace scopes both the subscription and the LIST; pass "" to cover every
// namespace. Each type file also has a New<Type>DeltaSource selector that picks a
// bus-backed source when nats.Enabled(subscriber), else an apiserver-backed one.
