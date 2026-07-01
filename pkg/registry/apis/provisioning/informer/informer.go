package informer

import (
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// Informer aliases the generic NATS-backed informer so provisioning wiring has a
// single import for both the per-resource constructors (one per file in this
// package) and the informer type.
type Informer = usinformer.Informer

// queueGroup is the NATS queue group every provisioning informer joins, so each
// notification is round-robined to a single replica rather than broadcast to all.
const queueGroup = "provisioning-informer"

// The per-resource constructors bind LIST to that resource's typed client and
// build the minimal live-event object as the resource's concrete type, so the
// controller's event handler keys off the right type. namespace scopes the NATS
// subscription and the LIST; pass "" to watch every namespace.
