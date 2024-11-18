package watchers

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"go.opentelemetry.io/otel"

	secretv0alpha1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v0alpha1"
)

var _ operator.ResourceWatcher = &KeyManagerWatcher{}

type KeyManagerWatcher struct{}

func NewKeyManagerWatcher() (*KeyManagerWatcher, error) {
	return &KeyManagerWatcher{}, nil
}

// Add handles add events for secretv0alpha1.KeyManager resources.
func (w *KeyManagerWatcher) Add(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-add")
	defer span.End()

	object, ok := rObj.(*secretv0alpha1.KeyManager)
	if !ok {
		return fmt.Errorf("provided object is not of type *secretv0alpha1.KeyManager (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Added resource", "name", object.GetStaticMetadata().Identifier().Name)

	return nil
}

// Update handles update events for secretv0alpha1.KeyManager resources.
func (w *KeyManagerWatcher) Update(ctx context.Context, rOld resource.Object, rNew resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-update")
	defer span.End()

	oldObject, ok := rOld.(*secretv0alpha1.KeyManager)
	if !ok {
		return fmt.Errorf("provided object is not of type *secretv0alpha1.KeyManager (name=%s, namespace=%s, kind=%s)",
			rOld.GetStaticMetadata().Name, rOld.GetStaticMetadata().Namespace, rOld.GetStaticMetadata().Kind)
	}

	_, ok = rNew.(*secretv0alpha1.KeyManager)
	if !ok {
		return fmt.Errorf("provided object is not of type *secretv0alpha1.KeyManager (name=%s, namespace=%s, kind=%s)",
			rNew.GetStaticMetadata().Name, rNew.GetStaticMetadata().Namespace, rNew.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Updated resource", "name", oldObject.GetStaticMetadata().Identifier().Name)

	return nil
}

// Delete handles delete events for secretv0alpha1.KeyManager resources.
func (w *KeyManagerWatcher) Delete(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-delete")
	defer span.End()

	object, ok := rObj.(*secretv0alpha1.KeyManager)
	if !ok {
		return fmt.Errorf("provided object is not of type *secretv0alpha1.KeyManager (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Deleted resource", "name", object.GetStaticMetadata().Identifier().Name)

	return nil
}

// Sync is not a standard resource.Watcher function, but is used when wrapping this watcher in an operator.OpinionatedWatcher.
// It handles resources which MAY have been updated during an outage period where the watcher was not able to consume events.
func (w *KeyManagerWatcher) Sync(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-sync")
	defer span.End()

	object, ok := rObj.(*secretv0alpha1.KeyManager)
	if !ok {
		return fmt.Errorf("provided object is not of type *secretv0alpha1.KeyManager (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Possible resource update", "name", object.GetStaticMetadata().Identifier().Name)

	return nil
}
