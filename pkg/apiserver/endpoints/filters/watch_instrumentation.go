package filters

import (
	"net/http"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/endpoints/responsewriter"
)

// WatchEstablishmentRecorder records how long a watch took to establish (from
// receiving the request to the first byte written to the client). The apiserver
// already tracks watch concurrency with the STABLE apiserver_longrunning_requests
// gauge, so establishment is the one setup signal upstream does not provide.
//
// Establishment is recorded as a metric rather than a span on purpose: the watch
// request span lives for the whole connection, so a setup span would share its
// trace and be dropped together by any tail-sampling policy that filters watches
// out. A metric is unaffected by trace sampling.
type WatchEstablishmentRecorder func(group, resource string, d time.Duration)

// WithWatchInstrumentation instruments watch requests. Watches are long-running
// connections whose request span duration reflects the connection lifetime, not
// latency, and whose HTTP method (GET) makes them indistinguishable from a LIST
// by span name alone. For a watch it:
//   - tags and renames the active request span so a tracing backend can tell it
//     apart from GET/LIST and filter it out of latency views, and
//   - records the establishment duration (entry to first byte written).
//
// Must run after WithRequestInfo (i.e. inside DefaultBuildHandlerChain) so that
// RequestInfo is populated, and after the upstream tracing filter so the span it
// renames is the resource-named request span. A nil recorder disables the metric.
func WithWatchInstrumentation(handler http.Handler, record WatchEstablishmentRecorder) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info, ok := request.RequestInfoFrom(r.Context())
		if !ok || !info.IsResourceRequest || info.Verb != "watch" {
			handler.ServeHTTP(w, r)
			return
		}

		span := trace.SpanFromContext(r.Context())
		span.SetAttributes(attribute.Bool("grafana.watch", true))
		span.SetName("WATCH " + info.APIGroup + "/" + info.Resource)

		if record == nil {
			handler.ServeHTTP(w, r)
			return
		}

		tracker := &firstByteTracker{start: time.Now()}
		tracker.onFirstByte = func() {
			record(info.APIGroup, info.Resource, time.Since(tracker.start))
		}
		decorator := &watchResponseWriter{ResponseWriter: w, tracker: tracker}
		handler.ServeHTTP(responsewriter.WrapForHTTP1Or2(decorator), r)
	})
}

type firstByteTracker struct {
	start       time.Time
	seen        bool
	onFirstByte func()
}

func (t *firstByteTracker) mark() {
	if t.seen {
		return
	}
	t.seen = true
	t.onFirstByte()
}

// watchResponseWriter records the establishment duration the first time the watch
// handler writes to the client. For a watch, the status header and first framed
// event are flushed once the watch stream is ready, so the first write is a good
// proxy for "watch established".
type watchResponseWriter struct {
	http.ResponseWriter
	tracker *firstByteTracker
}

var _ responsewriter.UserProvidedDecorator = &watchResponseWriter{}

func (w *watchResponseWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (w *watchResponseWriter) WriteHeader(code int) {
	w.tracker.mark()
	w.ResponseWriter.WriteHeader(code)
}

func (w *watchResponseWriter) Write(b []byte) (int, error) {
	w.tracker.mark()
	return w.ResponseWriter.Write(b)
}
