import { lokiCount, promInstant, tempoSearch } from '../realdata/labApi';

const CALLS = 'traces_span_metrics_calls_total';
const WINDOW_S = 1800;

// One OpenTelemetry resource attribute and how each backend spells it.
const ATTRIBUTES = [
  { otel: 'service.name', trace: 'resource.service.name', metric: 'service_name', log: 'service_name' },
  {
    otel: 'service.namespace',
    trace: 'resource.service.namespace',
    metric: 'service_namespace',
    log: 'service_namespace',
  },
  {
    otel: 'deployment.environment.name',
    trace: 'resource.deployment.environment.name',
    metric: 'deployment_environment_name',
    log: 'deployment_environment_name',
  },
  { otel: 'service.version', trace: 'resource.service.version', metric: 'service_version', log: 'service_version' },
  { otel: 'k8s.cluster.name', trace: 'resource.k8s.cluster.name', metric: 'k8s_cluster_name', log: 'k8s_cluster_name' },
];

export type TraceState = 'ok' | 'missing';
export type MetricState = 'ok' | 'missing';
// A Loki stream label is indexed. Structured metadata is stored with each line and needs a stream selector to filter.
export type LogState = 'index' | 'metadata' | 'missing';

export interface AttributeRow {
  otel: string;
  trace: { name: string; state: TraceState };
  metric: { name: string; state: MetricState };
  log: { name: string; state: LogState };
}

const nowSec = () => Math.floor(Date.now() / 1000);
const esc = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// Checks, for one service, whether each attribute reaches traces, span metrics and logs.
export async function loadAttributeMap(service: string): Promise<AttributeRow[]> {
  const end = nowSec();
  const start = end - WINDOW_S;
  const name = esc(service);

  return Promise.all(
    ATTRIBUTES.map(async (attribute): Promise<AttributeRow> => {
      const [inTraces, inMetrics, asLabel, asMetadata] = await Promise.all([
        tempoSearch(`{ resource.service.name="${name}" && ${attribute.trace} != nil }`, start, end, 1)
          .then((hits) => hits.length > 0)
          .catch(() => false),
        promInstant(`count(${CALLS}{service_name="${name}", ${attribute.metric}!=""})`, end)
          .then((rows) => rows.length > 0)
          .catch(() => false),
        lokiCount(`sum(count_over_time({service_name="${name}", ${attribute.log}=~".+"}[30m]))`, end).catch(() => 0),
        lokiCount(`sum(count_over_time({service_name="${name}"} | ${attribute.log}!="" [30m]))`, end).catch(() => 0),
      ]);
      const log: LogState = asLabel > 0 ? 'index' : asMetadata > 0 ? 'metadata' : 'missing';
      return {
        otel: attribute.otel,
        trace: { name: attribute.trace, state: inTraces ? 'ok' : 'missing' },
        metric: { name: attribute.metric, state: inMetrics ? 'ok' : 'missing' },
        log: { name: attribute.log, state: log },
      };
    })
  );
}
