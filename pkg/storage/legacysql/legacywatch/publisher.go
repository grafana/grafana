// Package legacywatch announces writes to the legacy SQL tables on the NATS bus,
// for resources that are not (or not yet only) stored in unified storage. Unified
// storage announces its own writes on resourcewatch.Subject; these go to
// resourcewatch.LegacySubject with the same WatchNotification payload.
package legacywatch

import (
	"context"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

const (
	Added    = resourcepb.WatchNotification_ADDED
	Modified = resourcepb.WatchNotification_MODIFIED
	Deleted  = resourcepb.WatchNotification_DELETED
)

// Bus is the subset of infra/nats.Publisher used here. Declaring it locally keeps
// the user and team services that depend on this package from linking the NATS
// client and embedded server.
type Bus interface {
	Enabled() bool
	Publish(ctx context.Context, subject string, data []byte) error
}

// Publisher is nil-safe: a nil *Publisher, or one whose bus is disabled, drops
// every notification, so writers can call it unconditionally.
//
// Publishing is a best-effort side effect of a committed write: a failure is
// logged and never fails the write. Delivery is at-most-once, so consumers must
// still re-list to recover anything missed.
type Publisher struct {
	bus       Bus
	namespace request.NamespaceMapper
}

// LegacyWatchNotification is a change to announce once the SQL transaction that makes it
// commits. A writer that runs inside a caller's xorm transaction, and so cannot
// publish itself, queues it with db.Session.PublishAfterCommit; the Publisher
// receives it from the in-process bus after the commit. Its name is the bus key.
type LegacyWatchNotification struct {
	Type            resourcepb.WatchNotification_Type
	Resource        schema.GroupResource
	OrgID           int64
	Name            string
	ResourceVersion int64
}

func ProvidePublisher(cfg *setting.Cfg, nats Bus, events bus.Bus) *Publisher {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagGrafanaPublishLegacySQLEvents, false, openfeature.TransactionContext(ctx)) {
		return nil
	}
	p := NewPublisher(nats, request.GetNamespaceMapper(cfg))
	events.AddEventListener(p.onNotification)
	return p
}

func (p *Publisher) onNotification(ctx context.Context, n *LegacyWatchNotification) error {
	p.Publish(ctx, n.Type, n.Resource, n.OrgID, n.Name, n.ResourceVersion)
	return nil
}

func NewPublisher(bus Bus, namespace request.NamespaceMapper) *Publisher {
	return &Publisher{bus: bus, namespace: namespace}
}

// Enabled reports whether Publish can deliver, so a writer can skip work (e.g. a
// lookup of the name) that only a notification needs.
func (p *Publisher) Enabled() bool {
	return p != nil && p.bus != nil && p.bus.Enabled()
}

// Publish announces a change to the named resource in the org's namespace.
// resourceVersion is the row's updated time in milliseconds, or 0 when the
// caller does not have it; consumers re-fetch the object, so it is advisory.
//
// Call it only after the write has committed. A writer running inside a caller's
// transaction cannot know that, so a notification may precede the commit (or
// announce a rolled back write); consumers that re-fetch then see the old state.
func (p *Publisher) Publish(ctx context.Context, typ resourcepb.WatchNotification_Type, gr schema.GroupResource, orgID int64, name string, resourceVersion int64) {
	if !p.Enabled() || name == "" {
		return
	}

	namespace := p.namespace(orgID)
	subject := resourcewatch.LegacySubject(gr.WithVersion(""), namespace)
	payload, err := proto.Marshal(&resourcepb.WatchNotification{
		Type:            typ,
		Group:           gr.Group,
		Resource:        gr.Resource,
		Namespace:       namespace,
		Name:            name,
		ResourceVersion: resourceVersion,
	})
	if err != nil {
		logging.FromContext(ctx).Warn("failed to marshal legacy watch notification", "subject", subject, "error", err)
		return
	}

	// The write has committed, so announce it even if the request that made it
	// has since been cancelled.
	if err := p.bus.Publish(context.WithoutCancel(ctx), subject, payload); err != nil {
		logging.FromContext(ctx).Warn("failed to publish legacy watch notification", "subject", subject, "name", name, "error", err)
	}
}
