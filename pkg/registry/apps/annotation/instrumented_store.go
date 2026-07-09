package annotation

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
)

// instrumentedStore decorates any Store with tracing, logging, and metrics.
type instrumentedStore struct {
	innerStore Store
	tracer     trace.Tracer
	metrics    *Metrics
	logger     log.Logger
}

var _ Store = (*instrumentedStore)(nil)

func newInstrumentedStore(innerStore Store, tracer trace.Tracer, metrics *Metrics, logger log.Logger) *instrumentedStore {
	return &instrumentedStore{
		innerStore: innerStore,
		tracer:     tracer,
		metrics:    metrics,
		logger:     logger,
	}
}

func (s *instrumentedStore) Get(ctx context.Context, namespace, name string) (out *annotationV0.Annotation, err error) {
	ctx, span := s.tracer.Start(ctx, "annotation.store.get", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", name),
	))
	defer span.End()
	start := time.Now()
	defer func() { observe(ctx, s.logger, s.metrics.StoreOperationDuration, "get", start, err) }()

	return s.innerStore.Get(ctx, namespace, name)
}

func (s *instrumentedStore) List(ctx context.Context, namespace string, opts ListOptions) (out *AnnotationList, err error) {
	attrs := []attribute.KeyValue{
		attribute.String("namespace", namespace),
		attribute.Int64("limit", opts.Limit),
		attribute.Bool("has_continue", opts.Continue != ""),
	}
	if opts.DashboardUID != "" {
		attrs = append(attrs, attribute.String("dashboard_uid", opts.DashboardUID))
	}
	if opts.PanelID != 0 {
		attrs = append(attrs, attribute.Int64("panel_id", opts.PanelID))
	}
	ctx, span := s.tracer.Start(ctx, "annotation.store.list", trace.WithAttributes(attrs...))
	defer span.End()
	start := time.Now()
	defer func() {
		if out != nil {
			span.SetAttributes(attribute.Int("item_count", len(out.Items)))
		}
		observe(ctx, s.logger, s.metrics.StoreOperationDuration, "list", start, err)
	}()

	return s.innerStore.List(ctx, namespace, opts)
}

func (s *instrumentedStore) Create(ctx context.Context, anno *annotationV0.Annotation) (out *annotationV0.Annotation, err error) {
	ctx, span := s.tracer.Start(ctx, "annotation.store.create", trace.WithAttributes(
		attribute.String("namespace", anno.Namespace),
	))
	defer span.End()
	start := time.Now()
	defer func() { observe(ctx, s.logger, s.metrics.StoreOperationDuration, "create", start, err) }()

	return s.innerStore.Create(ctx, anno)
}

func (s *instrumentedStore) Update(ctx context.Context, anno *annotationV0.Annotation) (out *annotationV0.Annotation, err error) {
	ctx, span := s.tracer.Start(ctx, "annotation.store.update", trace.WithAttributes(
		attribute.String("namespace", anno.Namespace),
		attribute.String("name", anno.Name),
	))
	defer span.End()
	start := time.Now()
	defer func() { observe(ctx, s.logger, s.metrics.StoreOperationDuration, "update", start, err) }()

	return s.innerStore.Update(ctx, anno)
}

func (s *instrumentedStore) Delete(ctx context.Context, namespace, name string) (err error) {
	ctx, span := s.tracer.Start(ctx, "annotation.store.delete", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", name),
	))
	defer span.End()
	start := time.Now()
	defer func() { observe(ctx, s.logger, s.metrics.StoreOperationDuration, "delete", start, err) }()

	return s.innerStore.Delete(ctx, namespace, name)
}

func (s *instrumentedStore) Close() error {
	return s.innerStore.Close()
}
