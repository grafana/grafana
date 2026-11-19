// What a producer of span metrics calls its series. An OpenTelemetry Collector connector writes milliseconds under
// service_name. Tempo's metrics-generator writes seconds under service.
export interface SpanMetrics {
  calls: string;
  bucket: string;
  service: string;
  // What multiplies the latency buckets into milliseconds.
  toMs: number;
}

export const COLLECTOR_SPAN_METRICS: SpanMetrics = {
  calls: 'traces_span_metrics_calls_total',
  bucket: 'traces_span_metrics_duration_milliseconds_bucket',
  service: 'service_name',
  toMs: 1,
};

export const TEMPO_SPAN_METRICS: SpanMetrics = {
  calls: 'traces_spanmetrics_calls_total',
  bucket: 'traces_spanmetrics_latency_bucket',
  service: 'service',
  toMs: 1000,
};

// A service that only consumes messages has consumer spans where a request handler has server spans.
export const SERVER_OR_CONSUMER = 'span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"';
