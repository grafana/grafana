import { type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

/**
 * Everything we can figure out about the selected datasource without opening the
 * Assistant. Populated from three complementary signal sources:
 *
 * 1. Label keys — very cheap, often diagnostic (`namespace` + `pod` = Kubernetes,
 *    `db_system` = OTel database instrumentation, ...).
 * 2. Label values — for a handful of well-known "meta" keys (`db_system`,
 *    `cloud_provider`, `telemetry_sdk_language`, `job`, `service`, ...) the values
 *    tell us exactly which stack the datasource is monitoring.
 * 3. Metric names — for Prometheus-shaped datasources we pull a sizeable sample of
 *    `__name__` values and match them against exporter naming conventions.
 *
 * Plus the datasource *type* itself: `cloudwatch` implies AWS, `azuremonitor` implies
 * Azure, and so on — trivial signal but the strongest one we have when metric-name
 * discovery isn't available (e.g. native cloud datasources).
 *
 * Capabilities are best-effort *hints*. False negatives are fine (we fall back to a
 * generic dashboard shape); false positives are the concerning case, so the
 * detection thresholds err on the strict side.
 */
export interface DatasourceCapabilities {
  /** Metric-naming conventions the datasource appears to use. */
  metricConventions: MetricConvention[];
  /** Kubernetes-related exporters detected. */
  kubernetes: KubernetesSignals;
  /** Backend databases the datasource is observing (via exporters or SDK metrics). */
  databases: DatabaseSignal[];
  /** Cloud providers the datasource is observing (via labels or exporter names). */
  clouds: CloudSignal[];
  /** Service-mesh / gateway systems detected. */
  serviceMesh: ServiceMeshSignal[];
  /** Language runtimes producing metrics on this datasource. */
  runtimes: RuntimeSignal[];
  /** Aggregate hint: does the datasource look like a Prometheus/Mimir/Cortex-shaped store? */
  isPrometheusLike: boolean;
  /** Aggregate hint: does the datasource look like a Loki-shaped store? */
  isLokiLike: boolean;
  /**
   * A breadth-diverse sample of the datasource's metric names (up to
   * `MAX_RETAINED_METRIC_NAMES`). Unlike a plain head-slice, families that sort
   * late alphabetically (`redis_*`, `up`, ...) are still represented, so the
   * per-intent relevance ranker downstream has the metrics it actually needs.
   */
  sampledMetricNames: string[];
  /**
   * Metric-name families (first name segment) with occurrence counts over the
   * FULL sampled set — a compact map of the datasource's metric namespace that
   * gives the LLM breadth even when a specific name didn't make the curated list.
   */
  metricFamilies: MetricFamily[];
  /**
   * Prometheus metric metadata (type / help / unit) keyed by metric family name,
   * restricted to the families present in `sampledMetricNames`. Lets the LLM pick
   * the right query shape (rate() for counters, histogram_quantile for histograms)
   * and the right panel unit. Empty for datasources without a metadata endpoint.
   */
  metricMetadata: Record<string, MetricMeta>;
}

/** A metric-name family (prefix) and how many sampled metrics belong to it. */
export interface MetricFamily {
  prefix: string;
  count: number;
}

/** Prometheus metric kind, normalised to the handful the query shape depends on. */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary' | 'unknown';

/** Metadata for a single metric family, sourced from Prometheus `/api/v1/metadata`. */
export interface MetricMeta {
  type: MetricType;
  /** One-line description of what the metric measures (truncated). */
  help?: string;
  /** Unit as reported by the exporter (often empty in practice). */
  unit?: string;
}

export type MetricConvention = 'prometheus' | 'opentelemetry' | 'statsd';
export type DatabaseSignal = 'postgres' | 'mysql' | 'redis' | 'mongodb' | 'kafka' | 'elasticsearch' | 'cassandra';
export type CloudSignal = 'aws' | 'gcp' | 'azure';
export type ServiceMeshSignal = 'istio' | 'envoy' | 'linkerd';
export type RuntimeSignal = 'go' | 'jvm' | 'nodejs' | 'python' | 'dotnet' | 'ruby';

export interface KubernetesSignals {
  /** kube-state-metrics is exporting workload metadata (`kube_*`). */
  kubeStateMetrics: boolean;
  /** cAdvisor / kubelet is exporting per-container metrics (`container_*`). */
  cAdvisor: boolean;
  /** node-exporter is exporting host metrics (`node_*`). */
  nodeExporter: boolean;
  /** API-server metrics are visible (`apiserver_*`). */
  apiServer: boolean;
  /** Any of the above detected, or K8s-flavoured label keys are present. */
  detected: boolean;
}

/**
 * How many metric names we pull from Prometheus for detection. Bumped generously
 * because real observability stores routinely expose tens of thousands of series
 * and truncating too early was causing whole categories (Postgres, K8s, mesh, ...)
 * to slip through undetected. The one-off cost is fine — this fetch runs once per
 * modal open.
 */
const MAX_METRIC_SAMPLES = 5000;

/**
 * How many metric names we keep on the capabilities snapshot for prompt curation.
 * Detection runs on the full `MAX_METRIC_SAMPLES` set; this smaller, breadth-diverse
 * pool is what the per-intent relevance ranker later selects from, so it needs to
 * cover every metric family without ballooning memory.
 */
const MAX_RETAINED_METRIC_NAMES = 800;

/** How many metric families we compute for the namespace overview. */
const MAX_METRIC_FAMILIES = 40;

/** Upper bound on metric families we ask the metadata endpoint for. */
const MAX_METADATA_ENTRIES = 3000;

/** Metric `help` text is truncated to this many characters before we retain it. */
const MAX_METRIC_HELP_LENGTH = 140;

/**
 * How many distinct hits a pattern needs before we count it as "detected". Set to 1
 * for cheap patterns (a single `apiserver_request_total` is enough to confirm the
 * control plane) and to a higher number for noisier heuristics.
 */
const DEFAULT_HIT_THRESHOLD = 1;

/**
 * Discovers datasource capabilities from a metric-name sample plus label metadata.
 * Failures are non-fatal — we degrade to a mostly-empty snapshot rather than
 * blocking the wizard.
 */
export async function detectCapabilities(
  dsSettings: DataSourceInstanceSettings,
  labelKeys: string[],
  labelSamples: Record<string, string[]>
): Promise<DatasourceCapabilities> {
  // Metric names and metadata come from independent endpoints — fetch together.
  const [metricNames, metricMetadata] = await Promise.all([
    fetchMetricNames(dsSettings),
    fetchMetricMetadata(dsSettings),
  ]);
  return buildCapabilities(dsSettings, metricNames, labelKeys, labelSamples, metricMetadata);
}

/**
 * Pure builder — exported so callers with already-sampled metric names (tests or
 * cached snapshots) can compute capabilities without a datasource round-trip.
 */
export function buildCapabilities(
  dsSettings: DataSourceInstanceSettings,
  metricNames: string[],
  labelKeys: string[],
  labelSamples: Record<string, string[]>,
  metricMetadata: Record<string, MetricMeta> = {}
): DatasourceCapabilities {
  const type = dsSettings.type.toLowerCase();
  const labelKeySet = new Set(labelKeys.map((k) => k.toLowerCase()));
  const valuesByKey = normaliseLabelSamples(labelSamples);
  const flatLabelValues = Array.from(valuesByKey.values()).flat();
  const jobLikeValues = collectValues(valuesByKey, ['job', 'exported_job', 'service', 'service_name', 'app']);
  const dbSystemValues = collectValues(valuesByKey, ['db_system', 'db.system']);
  const messagingSystemValues = collectValues(valuesByKey, ['messaging_system', 'messaging.system']);
  const cloudProviderValues = collectValues(valuesByKey, ['cloud_provider', 'cloud.provider']);
  const telemetrySdkLanguages = collectValues(valuesByKey, ['telemetry_sdk_language', 'telemetry.sdk.language']);

  const kubernetes = detectKubernetes(metricNames, labelKeySet);
  const metricConventions = detectMetricConventions(metricNames, labelKeySet, telemetrySdkLanguages);
  const databases = detectDatabases(
    metricNames,
    jobLikeValues,
    dbSystemValues,
    messagingSystemValues,
    labelKeySet,
    type
  );
  const clouds = detectClouds(metricNames, flatLabelValues, cloudProviderValues, type);
  const serviceMesh = detectServiceMesh(metricNames, jobLikeValues, labelKeySet);
  const runtimes = detectRuntimes(metricNames, telemetrySdkLanguages, labelKeySet);
  const retainedMetricNames = diverseMetricSample(metricNames, MAX_RETAINED_METRIC_NAMES);

  return {
    metricConventions,
    kubernetes,
    databases,
    clouds,
    serviceMesh,
    runtimes,
    isPrometheusLike: type.includes('prometheus') || type.includes('mimir') || type.includes('cortex'),
    isLokiLike: type.includes('loki'),
    sampledMetricNames: retainedMetricNames,
    metricFamilies: computeMetricFamilies(metricNames, MAX_METRIC_FAMILIES),
    metricMetadata: retainMetadataForPool(metricMetadata, retainedMetricNames),
  };
}

/**
 * Metric-name prefix used to bucket names into families. Takes the segment before
 * the first `_` or `.` (`http_requests_total` → `http`, `k8s.pod.count` → `k8s`).
 */
function metricPrefix(name: string): string {
  const segment = name.split(/[_.]/, 1)[0];
  return segment || name;
}

/**
 * Picks a breadth-diverse subset of metric names: names are bucketed by family and
 * drawn round-robin, so a huge family (say 900 `go_*` names) can't crowd out small
 * but important ones (`up`, `redis_*`) the way a plain head-slice would.
 */
function diverseMetricSample(names: string[], cap: number): string[] {
  if (names.length <= cap) {
    return names;
  }
  const buckets = new Map<string, string[]>();
  for (const name of names) {
    const prefix = metricPrefix(name);
    const bucket = buckets.get(prefix);
    if (bucket) {
      bucket.push(name);
    } else {
      buckets.set(prefix, [name]);
    }
  }
  const queues = Array.from(buckets.values());
  const out: string[] = [];
  let cursor = 0;
  while (out.length < cap && queues.some((q) => q.length > 0)) {
    const queue = queues[cursor % queues.length];
    const next = queue.shift();
    if (next !== undefined) {
      out.push(next);
    }
    cursor++;
  }
  return out;
}

/** Counts metric names per family over the full sample, returning the largest first. */
function computeMetricFamilies(names: string[], cap: number): MetricFamily[] {
  const counts = new Map<string, number>();
  for (const name of names) {
    const prefix = metricPrefix(name);
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count || (a.prefix < b.prefix ? -1 : a.prefix > b.prefix ? 1 : 0))
    .slice(0, cap);
}

/**
 * Kubernetes-specific detection. Any *one* strong signal is enough; we specifically
 * accept just K8s-shaped label keys (`namespace`, `pod`, `container`, `node`) so
 * environments where we can't sample metric names (native cloud datasources, small
 * Loki stores, ...) still get correctly identified.
 */
function detectKubernetes(metricNames: string[], labelKeySet: Set<string>): KubernetesSignals {
  const kubeStateMetrics = countMatching(metricNames, /^kube_/) >= DEFAULT_HIT_THRESHOLD;
  const cAdvisor = countMatching(metricNames, /^container_(cpu|memory|network|fs)_/) >= DEFAULT_HIT_THRESHOLD;
  const nodeExporter =
    countMatching(metricNames, /^node_(cpu|memory|filesystem|network|disk|load)_/) >= DEFAULT_HIT_THRESHOLD;
  const apiServer = countMatching(metricNames, /^(apiserver_|etcd_)/) >= DEFAULT_HIT_THRESHOLD;

  // Label-key-based fallback: a datasource exposing pod + namespace labels is,
  // in practice, always K8s. Requiring both keeps this narrow — some non-K8s
  // datasources use just one of them for other reasons.
  const hasNamespace =
    labelKeySet.has('namespace') || labelKeySet.has('k8s_namespace') || labelKeySet.has('kubernetes_namespace');
  const hasPod = labelKeySet.has('pod') || labelKeySet.has('pod_name') || labelKeySet.has('k8s_pod_name');
  const hasContainer = labelKeySet.has('container') || labelKeySet.has('container_name');
  const hasNode = labelKeySet.has('node') || labelKeySet.has('kubernetes_node');
  const labelBasedK8s = (hasNamespace && hasPod) || (hasPod && hasContainer) || (hasNamespace && hasNode);

  const detected = kubeStateMetrics || cAdvisor || nodeExporter || apiServer || labelBasedK8s;
  return { kubeStateMetrics, cAdvisor, nodeExporter, apiServer, detected };
}

/**
 * Metric-naming convention detection: OTel semantic conventions (dot-separated
 * or `otel_`/`otelcol_` prefixed), classical Prometheus (_total / _seconds / _bytes),
 * and StatsD (`statsd_*`).
 */
function detectMetricConventions(
  metricNames: string[],
  labelKeySet: Set<string>,
  telemetrySdkLanguages: string[]
): MetricConvention[] {
  const out: MetricConvention[] = [];

  // OTel: strong signals are dedicated collector metrics, `otel_*` prefix, semconv
  // HTTP names, an explicit `service.name` label (dotted form is unambiguous OTel),
  // or any `telemetry.sdk.language` value.
  const hasOtelSemconv =
    metricNames.some((name) => name.includes('.')) ||
    countMatching(metricNames, /^otelcol_/) >= DEFAULT_HIT_THRESHOLD ||
    countMatching(metricNames, /^otel_/) >= DEFAULT_HIT_THRESHOLD ||
    countMatching(metricNames, /^http_server_request_duration_seconds/) >= DEFAULT_HIT_THRESHOLD ||
    countMatching(metricNames, /^http_client_request_duration_seconds/) >= DEFAULT_HIT_THRESHOLD ||
    labelKeySet.has('service.name') ||
    labelKeySet.has('telemetry.sdk.language') ||
    labelKeySet.has('telemetry_sdk_language') ||
    telemetrySdkLanguages.length > 0;
  if (hasOtelSemconv) {
    out.push('opentelemetry');
  }

  // Classical Prometheus naming.
  if (
    countMatching(metricNames, /_total$/) >= 3 ||
    countMatching(metricNames, /_seconds(_bucket|_sum|_count)?$/) >= 3 ||
    countMatching(metricNames, /_bytes$/) >= 2
  ) {
    out.push('prometheus');
  }

  // StatsD via prometheus_statsd_exporter tends to leave underscore-heavy names
  // without the classical suffixes.
  if (countMatching(metricNames, /^statsd_/) >= DEFAULT_HIT_THRESHOLD) {
    out.push('statsd');
  }

  return out;
}

/**
 * Database detection combines three signals:
 * 1. Exporter metric prefixes (`pg_*`, `mysql_*`, ...).
 * 2. Well-known job/service label values (`postgres-exporter`, `mysqld-exporter`, ...).
 * 3. OTel semantic-convention `db.system` label values (`postgresql`, `mysql`, ...).
 *
 * Also treats native database datasource types as an implicit hit — a Grafana Postgres
 * datasource observing itself is definitely Postgres, even if metric-name discovery
 * fails.
 */
function detectDatabases(
  metricNames: string[],
  jobLikeValues: string[],
  dbSystemValues: string[],
  messagingSystemValues: string[],
  labelKeySet: Set<string>,
  datasourceType: string
): DatabaseSignal[] {
  const out = new Set<DatabaseSignal>();

  if (
    matchesAny(metricNames, [/^pg_/, /^postgres_/, /^postgresql_/]) ||
    jobLikeValues.some((v) => /postgres|postgresql|pgbouncer/.test(v)) ||
    dbSystemValues.some((v) => v === 'postgresql' || v === 'postgres') ||
    labelKeySet.has('datname') ||
    datasourceType === 'postgres' ||
    datasourceType === 'grafana-postgresql-datasource'
  ) {
    out.add('postgres');
  }
  if (
    matchesAny(metricNames, [/^mysql_/, /^mariadb_/, /^mysqld_/]) ||
    jobLikeValues.some((v) => /mysqld?|mariadb/.test(v)) ||
    dbSystemValues.some((v) => v === 'mysql' || v === 'mariadb') ||
    datasourceType === 'mysql'
  ) {
    out.add('mysql');
  }
  if (
    matchesAny(metricNames, [/^redis_/]) ||
    jobLikeValues.some((v) => /redis/.test(v)) ||
    dbSystemValues.some((v) => v === 'redis')
  ) {
    out.add('redis');
  }
  if (
    matchesAny(metricNames, [/^mongodb_/]) ||
    jobLikeValues.some((v) => /mongo/.test(v)) ||
    dbSystemValues.some((v) => v === 'mongodb')
  ) {
    out.add('mongodb');
  }
  if (
    matchesAny(metricNames, [/^kafka_/, /^kafka_consumer_/, /^kafka_producer_/, /^kafka_server_/, /^kafka_network_/]) ||
    jobLikeValues.some((v) => /kafka/.test(v)) ||
    messagingSystemValues.some((v) => v === 'kafka') ||
    labelKeySet.has('topic') ||
    labelKeySet.has('consumergroup') ||
    labelKeySet.has('consumer_group')
  ) {
    out.add('kafka');
  }
  if (
    matchesAny(metricNames, [/^elasticsearch_/, /^opensearch_/]) ||
    jobLikeValues.some((v) => /elasticsearch|opensearch/.test(v)) ||
    dbSystemValues.some((v) => v === 'elasticsearch' || v === 'opensearch') ||
    datasourceType === 'elasticsearch'
  ) {
    out.add('elasticsearch');
  }
  if (
    matchesAny(metricNames, [/^cassandra_/, /^scylladb_/]) ||
    jobLikeValues.some((v) => /cassandra|scylla/.test(v)) ||
    dbSystemValues.some((v) => v === 'cassandra' || v === 'scylladb')
  ) {
    out.add('cassandra');
  }

  return Array.from(out);
}

/**
 * Cloud provider detection. Native cloud datasources (`cloudwatch`, `azuremonitor`,
 * `googlecloud`/`stackdriver`) count as an implicit hit, which fixes the previous
 * behaviour where they only showed up when we happened to catch an ARN or
 * `Microsoft.*` in the sampled label values.
 */
function detectClouds(
  metricNames: string[],
  flatLabelValues: string[],
  cloudProviderValues: string[],
  datasourceType: string
): CloudSignal[] {
  const out = new Set<CloudSignal>();

  if (
    matchesAny(metricNames, [/^aws_/, /^cloudwatch_/, /^amazon_/]) ||
    flatLabelValues.some((v) => v.startsWith('arn:aws:') || v.startsWith('AWS/')) ||
    cloudProviderValues.some((v) => v === 'aws' || v === 'amazon') ||
    datasourceType === 'cloudwatch' ||
    datasourceType === 'grafana-x-ray-datasource'
  ) {
    out.add('aws');
  }
  if (
    matchesAny(metricNames, [/^stackdriver_/, /^gcp_/, /^gcloud_/, /^google_/]) ||
    flatLabelValues.some((v) => v.startsWith('projects/') && v.includes('/instances/')) ||
    cloudProviderValues.some((v) => v === 'gcp' || v === 'google_cloud_platform') ||
    datasourceType === 'stackdriver' ||
    datasourceType === 'googlecloud-monitoring-datasource' ||
    datasourceType === 'grafana-googlecloud-monitoring-datasource'
  ) {
    out.add('gcp');
  }
  if (
    matchesAny(metricNames, [/^azure_/]) ||
    flatLabelValues.some((v) => v.includes('Microsoft.') || v.includes('/resourceGroups/')) ||
    cloudProviderValues.some((v) => v === 'azure' || v === 'azure_public_cloud') ||
    datasourceType === 'grafana-azure-monitor-datasource'
  ) {
    out.add('azure');
  }

  return Array.from(out);
}

/**
 * Service-mesh detection. Metric prefixes are the strongest signal; well-known job
 * values (`istio-telemetry`, `envoy-stats`, `linkerd-proxy`) fill the gap when
 * metric-name discovery is limited.
 */
function detectServiceMesh(
  metricNames: string[],
  jobLikeValues: string[],
  labelKeySet: Set<string>
): ServiceMeshSignal[] {
  const out = new Set<ServiceMeshSignal>();

  if (
    matchesAny(metricNames, [/^istio_/, /^istio_requests_total/]) ||
    jobLikeValues.some((v) => /istio/.test(v)) ||
    labelKeySet.has('destination_workload') ||
    labelKeySet.has('source_workload')
  ) {
    out.add('istio');
  }
  if (matchesAny(metricNames, [/^envoy_/]) || jobLikeValues.some((v) => /envoy/.test(v))) {
    out.add('envoy');
  }
  if (matchesAny(metricNames, [/^linkerd_/, /^response_latency_ms/]) || jobLikeValues.some((v) => /linkerd/.test(v))) {
    out.add('linkerd');
  }

  return Array.from(out);
}

/**
 * Runtime detection. Handles three flavours of instrumentation:
 * - Classic Prometheus client libraries (`go_*`, `jvm_*`, `python_*`, ...).
 * - OTel semantic-convention runtime metrics (`process_runtime_*`), keyed on the
 *   `telemetry.sdk.language` label rather than the metric name (which is generic).
 * - Explicit `telemetry.sdk.language` label values.
 */
function detectRuntimes(
  metricNames: string[],
  telemetrySdkLanguages: string[],
  labelKeySet: Set<string>
): RuntimeSignal[] {
  const out = new Set<RuntimeSignal>();

  if (matchesAny(metricNames, [/^go_/, /^process_runtime_go_/]) || telemetrySdkLanguages.some((v) => v === 'go')) {
    out.add('go');
  }
  if (
    matchesAny(metricNames, [/^jvm_/, /^process_runtime_jvm_/]) ||
    telemetrySdkLanguages.some((v) => v === 'java' || v === 'jvm')
  ) {
    out.add('jvm');
  }
  if (
    matchesAny(metricNames, [/^nodejs_/, /^process_runtime_nodejs_/]) ||
    telemetrySdkLanguages.some((v) => v === 'nodejs' || v === 'js' || v === 'javascript')
  ) {
    out.add('nodejs');
  }
  if (
    matchesAny(metricNames, [/^python_/, /^process_runtime_cpython_/, /^process_runtime_python_/]) ||
    telemetrySdkLanguages.some((v) => v === 'python' || v === 'cpython')
  ) {
    out.add('python');
  }
  if (
    matchesAny(metricNames, [/^dotnet_/, /^process_runtime_dotnet_/]) ||
    telemetrySdkLanguages.some((v) => v === 'dotnet' || v === '.net' || v === 'net')
  ) {
    out.add('dotnet');
  }
  if (
    matchesAny(metricNames, [/^ruby_/, /^process_runtime_ruby_/]) ||
    telemetrySdkLanguages.some((v) => v === 'ruby')
  ) {
    out.add('ruby');
  }

  // Handy nudge: `nodejs_*` metrics can appear via other means, but the presence
  // of the `nodejs.eventloop.lag.seconds` OTel label key is a strong Node.js
  // signal even without matching metric names.
  if (labelKeySet.has('nodejs.eventloop.lag.seconds') || labelKeySet.has('nodejs_eventloop_lag_seconds')) {
    out.add('nodejs');
  }

  return Array.from(out);
}

/**
 * Pulls a sample of metric names via the datasource's `__name__` label. Prometheus
 * (and Prometheus-compatible stores) support this; Loki and other datasources return
 * nothing, which is fine — the capabilities detector will just have less to work with.
 */
async function fetchMetricNames(dsSettings: DataSourceInstanceSettings): Promise<string[]> {
  try {
    const ds: DataSourceApi = await getDataSourceSrv().get(dsSettings);
    if (typeof ds.getTagValues !== 'function') {
      return [];
    }
    const raw = await ds.getTagValues({ key: '__name__', filters: [] });
    const values = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && 'data' in raw && Array.isArray(raw.data)
        ? raw.data
        : [];
    const names = values
      .map((v) => (typeof v.text === 'string' ? v.text : ''))
      .filter((name): name is string => name.length > 0);
    return names.slice(0, MAX_METRIC_SAMPLES);
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Pulls metric metadata (type / help / unit) from a Prometheus-compatible datasource
 * via its `/api/v1/metadata` resource endpoint (served by `DataSourceWithBackend`).
 * Gated on the datasource type and fully best-effort: any failure (non-Prometheus
 * store, missing endpoint, network error) degrades to an empty map so analysis never
 * blocks on it. The response is untyped over the wire, so we validate it defensively.
 */
async function fetchMetricMetadata(dsSettings: DataSourceInstanceSettings): Promise<Record<string, MetricMeta>> {
  const type = dsSettings.type.toLowerCase();
  if (!(type.includes('prometheus') || type.includes('mimir') || type.includes('cortex'))) {
    return {};
  }
  try {
    const ds: DataSourceApi = await getDataSourceSrv().get(dsSettings);
    // `getResource` lives on DataSourceWithBackend, not the DataSourceApi base type.
    const getResource: unknown = Reflect.get(ds, 'getResource');
    if (typeof getResource !== 'function') {
      return {};
    }
    const response: unknown = await getResource.call(ds, 'api/v1/metadata', { limit: MAX_METADATA_ENTRIES });
    const data = isRecord(response) ? response.data : undefined;
    if (!isRecord(data)) {
      return {};
    }
    const out: Record<string, MetricMeta> = {};
    for (const [name, entries] of Object.entries(data)) {
      const first = Array.isArray(entries) ? entries[0] : undefined;
      if (!isRecord(first)) {
        continue;
      }
      const unit = typeof first.unit === 'string' ? first.unit.trim() : '';
      out[name] = {
        type: normaliseMetricType(typeof first.type === 'string' ? first.type : undefined),
        help: truncateHelp(typeof first.help === 'string' ? first.help : undefined),
        unit: unit || undefined,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Maps a raw Prometheus metadata type to the small set the query shape depends on. */
function normaliseMetricType(type: string | undefined): MetricType {
  switch ((type ?? '').toLowerCase()) {
    case 'counter':
      return 'counter';
    case 'gauge':
      return 'gauge';
    case 'histogram':
    case 'gaugehistogram':
      return 'histogram';
    case 'summary':
      return 'summary';
    default:
      return 'unknown';
  }
}

function truncateHelp(help: string | undefined): string | undefined {
  if (typeof help !== 'string') {
    return undefined;
  }
  const trimmed = help.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > MAX_METRIC_HELP_LENGTH ? trimmed.slice(0, MAX_METRIC_HELP_LENGTH) : trimmed;
}

/** Strips histogram/summary suffixes so a name maps to its metadata family key. */
function metricBaseName(name: string): string {
  return name.replace(/_(bucket|sum|count)$/, '');
}

/**
 * Keeps only the metadata for families present in the retained metric pool, so the
 * snapshot doesn't carry help text for thousands of metrics we'll never surface.
 */
function retainMetadataForPool(
  metadata: Record<string, MetricMeta>,
  retainedNames: string[]
): Record<string, MetricMeta> {
  if (!Object.keys(metadata).length || !retainedNames.length) {
    return {};
  }
  const bases = new Set(retainedNames.map(metricBaseName));
  const out: Record<string, MetricMeta> = {};
  for (const base of bases) {
    const meta = metadata[base];
    if (meta) {
      out[base] = meta;
    }
  }
  return out;
}

/**
 * Lower-cased, whitespace-trimmed sample values keyed by (lower-cased) label name.
 * Centralising the normalisation here means detection functions can do plain
 * equality / `.includes()` checks without worrying about label casing.
 */
function normaliseLabelSamples(labelSamples: Record<string, string[]>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [key, values] of Object.entries(labelSamples)) {
    const lowered = values
      .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
      .filter((v) => v.length > 0);
    if (lowered.length) {
      out.set(key.toLowerCase(), lowered);
    }
  }
  return out;
}

function collectValues(valuesByKey: Map<string, string[]>, keys: string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const values = valuesByKey.get(key.toLowerCase());
    if (values) {
      out.push(...values);
    }
  }
  return out;
}

function countMatching(names: string[], pattern: RegExp): number {
  let hits = 0;
  for (const name of names) {
    if (pattern.test(name)) {
      hits++;
    }
  }
  return hits;
}

function matchesAny(names: string[], patterns: RegExp[]): boolean {
  return names.some((name) => patterns.some((p) => p.test(name)));
}
