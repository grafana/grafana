package annotation

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
)

// newGraphiteHandler creates the handler for the POST /graphite custom route. It
// translates the Graphite event format into an Annotation and delegates to the
// REST creator so it shares authorization, scope validation, createdBy stamping
// and legacy-ID handling with the standard Create path.
func newGraphiteHandler(
	creator rest.Creater,
	tracer trace.Tracer,
	metrics *Metrics,
	logger log.Logger,
) func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	return func(ctx context.Context, writer app.CustomRouteResponseWriter, req *app.CustomRouteRequest) (err error) {
		namespace := req.ResourceIdentifier.Namespace

		ctx, span := tracer.Start(ctx, "annotation.k8s.graphite", trace.WithAttributes(
			attribute.String("namespace", namespace),
		))
		defer span.End()
		start := time.Now()
		defer func() { observe(ctx, logger, metrics.RequestDuration, "graphite", start, err) }()

		var cmd PostGraphiteAnnotationsCmd
		if err = json.NewDecoder(req.Body).Decode(&cmd); err != nil {
			return apierrors.NewBadRequest("bad request data")
		}

		tags, err := cmd.Validate()
		if err != nil {
			return apierrors.NewBadRequest(err.Error())
		}

		timeMs := cmd.When * 1000
		if cmd.When == 0 {
			timeMs = time.Now().UnixMilli()
		}

		anno := &annotationV0.Annotation{
			TypeMeta: metav1.TypeMeta{
				APIVersion: annotationV0.AnnotationKind().GroupVersionKind().GroupVersion().String(),
				Kind:       annotationV0.AnnotationKind().Kind(),
			},
			ObjectMeta: metav1.ObjectMeta{
				Namespace:    namespace,
				GenerateName: "a-",
			},
			Spec: annotationV0.AnnotationSpec{
				Text: FormatGraphiteText(cmd.What, cmd.Data),
				Time: timeMs,
				Tags: tags,
			},
		}

		ctx = k8srequest.WithNamespace(ctx, namespace)
		created, err := creator.Create(ctx, anno, nil, &metav1.CreateOptions{})
		if err != nil {
			return err
		}

		writer.Header().Set("Content-Type", "application/json")
		return json.NewEncoder(writer).Encode(created)
	}
}
