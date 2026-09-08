package informer

import (
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// DeltaSource aliases the unified-storage informer's event-source seam, kept
// under this package's name because it is the type the provisioning wiring and
// controllers reference.
type DeltaSource = usinformer.DeltaSource

// queueGroup is the NATS queue group every provisioning informer joins, so each
// notification is round-robined to a single replica rather than broadcast to all.
const queueGroup = "provisioning-informer"

// The per-resource constructors (one per type file) bind LIST to that resource's
// typed client and build the minimal live-event object as the resource's concrete
// type, so the controller's event handler keys off the right type. namespace
// scopes the NATS subscription and the LIST; pass "" to watch every namespace.
// Each type file also has a New<Type>DeltaSource selector that picks a
// NATS-backed informer when nats.Enabled(subscriber), else an apiserver-backed one.
