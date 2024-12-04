package watchers

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/apps/feedback/pkg/apis/feedback/v0alpha1"
	feedback "github.com/grafana/grafana/apps/feedback/pkg/apis/feedback/v0alpha1"
)

var _ operator.ResourceWatcher = &FeedbackWatcher{}

type FeedbackWatcher struct {
	feedbackStore *resource.TypedStore[*v0alpha1.Feedback]
}

func NewFeedbackWatcher(feedbackStore *resource.TypedStore[*v0alpha1.Feedback]) (*FeedbackWatcher, error) {
	return &FeedbackWatcher{
		feedbackStore: feedbackStore,
	}, nil
}

// Add handles add events for feedback.Feedback resources.
func (s *FeedbackWatcher) Add(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-add")
	defer span.End()
	object, ok := rObj.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	object.Spec.ScreenshotUrl = "http://test.com"
	object.Spec.Screenshot = nil
	if _, err := s.feedbackStore.Update(ctx, resource.Identifier{Namespace: rObj.GetNamespace(), Name: rObj.GetName()}, object); err != nil {
		return fmt.Errorf("updating screenshot url: %w", err)
	}

	logging.FromContext(ctx).Debug("Added resource", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}

// Update handles update events for feedback.Feedback resources.
func (s *FeedbackWatcher) Update(ctx context.Context, rOld resource.Object, rNew resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-update")
	defer span.End()
	oldObject, ok := rOld.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rOld.GetStaticMetadata().Name, rOld.GetStaticMetadata().Namespace, rOld.GetStaticMetadata().Kind)
	}

	_, ok = rNew.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rNew.GetStaticMetadata().Name, rNew.GetStaticMetadata().Namespace, rNew.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Updated resource", "name", oldObject.GetStaticMetadata().Identifier().Name)
	return nil
}

// Delete handles delete events for feedback.Feedback resources.
func (s *FeedbackWatcher) Delete(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-delete")
	defer span.End()
	object, ok := rObj.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Deleted resource", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}

// Sync is not a standard resource.Watcher function, but is used when wrapping this watcher in an operator.OpinionatedWatcher.
// It handles resources which MAY have been updated during an outage period where the watcher was not able to consume events.
func (s *FeedbackWatcher) Sync(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-sync")
	defer span.End()
	object, ok := rObj.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Possible resource update", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}
