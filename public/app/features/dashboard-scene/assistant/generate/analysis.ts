import { type DataSourceApi, type DataSourceInstanceSettings, type MetricFindValue } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { detectCapabilities } from './capabilities';
import { type DatasourceAnalysis, type ExplorationOption } from './types';

/**
 * How many label keys we consider when suggesting exploration options — enough to
 * catch the interesting dimensions on most datasources without flooding the UI.
 */
const MAX_LABEL_KEYS = 40;

/**
 * Upper bound on rows shown in the wizard's first screen. Beyond this the picker
 * gets unscannable — the goal is "pick a dimension" not "audit every label".
 * Well-known categories are always kept; the remainder is filled with uncategorised
 * labels that have real sample values.
 */
const MAX_OPTIONS_SHOWN = 8;

/** How many sample values we surface per label — plenty for a preview, cheap to fetch. */
const MAX_SAMPLE_VALUES = 5;

/**
 * Curated ordering — we surface these dimensions first when present. Both the
 * Prometheus (`service_name`) and OpenTelemetry (`service.name`) spellings are
 * listed so either datasource style gets prioritised; {@link trimAndDedupeOptions}
 * later collapses the variants of one dimension into a single row.
 */
const PREFERRED_LABEL_KEYS = [
  'service',
  'service_name',
  'service.name',
  'namespace',
  'k8s_namespace',
  'k8s.namespace.name',
  'kubernetes_namespace',
  'job',
  'deployment',
  'workload',
  'k8s.deployment.name',
  'pod',
  'pod_name',
  'k8s.pod.name',
  'k8s_pod_name',
  'node',
  'node_name',
  'k8s.node.name',
  'cluster',
  'k8s.cluster.name',
  'container',
  'container_name',
  'k8s.container.name',
  'instance',
  'host.name',
];

/** Label keys we skip because they're rarely useful pivots (too high-cardinality or too internal). */
const SKIP_LABEL_KEYS = new Set(['__name__', '__meta_kubernetes_pod_annotation', 'le', 'quantile']);

/**
 * "Meta" label keys we always sample values for (even outside the prioritized set)
 * because their values are strongly diagnostic for capability detection —
 * `db_system=postgresql` is a definitive Postgres signal, `cloud.provider=aws` an
 * unambiguous AWS one, etc. These labels rarely make sense as user-facing pivots,
 * but their values massively improve `detectCapabilities`'s hit rate on large or
 * non-Prometheus datasources.
 */
const CAPABILITY_META_LABEL_KEYS = [
  'db_system',
  'db.system',
  'messaging_system',
  'messaging.system',
  'cloud_provider',
  'cloud.provider',
  'telemetry_sdk_language',
  'telemetry.sdk.language',
];

/**
 * Well-known dimensions we know how to categorise. The set is intentionally small —
 * anything else is treated as `other` and gets a generic description.
 */
export type LabelCategory =
  | 'service'
  | 'namespace'
  | 'job'
  | 'deployment'
  | 'pod'
  | 'node'
  | 'cluster'
  | 'container'
  | 'instance'
  | 'other';

/**
 * Normalises a raw label key so one matcher table can cover Prometheus,
 * OpenTelemetry and exporter naming conventions. Everything is lower-cased and
 * any run of non-alphanumeric characters (dots, dashes, slashes, spaces) collapses
 * to a single underscore — so `k8s.pod.name`, `k8s_pod_name` and
 * `app.kubernetes.io/name` all reduce to a comparable canonical form.
 */
export function normalizeLabelKey(labelKey: string): string {
  return labelKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Canonical (normalised) label keys per well-known dimension. Ordered so the
 * first match wins for keys that could plausibly land in two buckets — e.g.
 * `service_namespace` (OTel) is a grouping dimension, so `namespace` is checked
 * before `service`.
 */
const CATEGORY_KEYS: Array<[Exclude<LabelCategory, 'other'>, readonly string[]]> = [
  [
    'namespace',
    [
      'namespace',
      'namespace_name',
      'k8s_namespace',
      'k8s_namespace_name',
      'kubernetes_namespace',
      'kube_namespace',
      'service_namespace',
    ],
  ],
  [
    'deployment',
    [
      'deployment',
      'deployment_name',
      'k8s_deployment_name',
      'kube_deployment',
      'workload',
      'workload_name',
      'workload_type',
      'statefulset',
      'statefulset_name',
      'daemonset',
      'daemonset_name',
      'replicaset',
      'replicaset_name',
      'cronjob',
      'cronjob_name',
    ],
  ],
  [
    'service',
    ['service', 'service_name', 'svc', 'app', 'application', 'app_name', 'app_kubernetes_io_name', 'k8s_app'],
  ],
  ['job', ['job', 'job_name']],
  ['pod', ['pod', 'pod_name', 'k8s_pod_name', 'kubernetes_pod_name', 'kube_pod']],
  ['node', ['node', 'node_name', 'nodename', 'k8s_node_name', 'kube_node', 'kubernetes_io_hostname']],
  ['cluster', ['cluster', 'cluster_name', 'k8s_cluster_name', 'kubernetes_cluster', 'kube_cluster']],
  ['container', ['container', 'container_name', 'k8s_container_name', 'kubernetes_container_name', 'kube_container']],
  ['instance', ['instance', 'host', 'hostname', 'host_name', 'fqdn', 'server']],
];

/**
 * Suffix fallbacks for derived / vendor-specific labels not covered by the exact
 * table (e.g. `destination_service`, `source_node`). Checked only after the exact
 * table, so canonical keys always take precedence.
 */
const CATEGORY_SUFFIXES: Array<[Exclude<LabelCategory, 'other'>, string]> = [
  ['namespace', '_namespace'],
  ['deployment', '_deployment'],
  ['service', '_service'],
  ['container', '_container'],
  ['cluster', '_cluster'],
  ['node', '_node'],
  ['pod', '_pod'],
  ['instance', '_host'],
  ['instance', '_hostname'],
  ['instance', '_instance'],
];

/**
 * Best-effort mapping from a raw label key to a well-known dimension.
 * Only used to pick the row title/description and intent set — everything else
 * uses the raw label key. Matching is convention-agnostic (see
 * {@link normalizeLabelKey}), so OpenTelemetry (`service.name`) and Prometheus
 * (`service_name`) spellings resolve to the same dimension.
 */
export function categorizeLabelKey(labelKey: string): LabelCategory {
  const key = normalizeLabelKey(labelKey);
  for (const [category, keys] of CATEGORY_KEYS) {
    if (keys.includes(key)) {
      return category;
    }
  }
  for (const [category, suffix] of CATEGORY_SUFFIXES) {
    if (key.endsWith(suffix)) {
      return category;
    }
  }
  return 'other';
}

/**
 * Human-readable title for a label key.
 * Kept close to the raw key so users can still recognise it; unknown labels get title-cased.
 */
export function titleForLabelKey(labelKey: string): string {
  switch (categorizeLabelKey(labelKey)) {
    case 'service':
      return 'Services';
    case 'namespace':
      return 'Namespaces';
    case 'job':
      return 'Jobs';
    case 'deployment':
      return 'Workloads';
    case 'pod':
      return 'Pods';
    case 'node':
      return 'Nodes';
    case 'cluster':
      return 'Clusters';
    case 'container':
      return 'Containers';
    case 'instance':
      return 'Instances';
    case 'other':
    default: {
      const words = labelKey.replace(/[_-]+/g, ' ').split(/\s+/).filter(Boolean);
      return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    }
  }
}

export function descriptionForLabelKey(labelKey: string): string {
  switch (categorizeLabelKey(labelKey)) {
    case 'service':
      return 'Named apps or APIs';
    case 'namespace':
      return 'Workload groups by team or environment';
    case 'job':
      return 'Apps or exporters Prometheus collects from';
    case 'deployment':
      return 'Deployments, statefulsets and daemonsets';
    case 'pod':
      return 'Running app instances in Kubernetes';
    case 'node':
      return 'Kubernetes nodes or physical hosts';
    case 'cluster':
      return 'Kubernetes clusters';
    case 'container':
      return 'Containers running inside pods';
    case 'instance':
      return 'Hosts or agents reporting metrics';
    case 'other':
    default:
      return `Break down by \`${labelKey}\``;
  }
}

function hasDataArray(result: unknown): result is { data: MetricFindValue[] } {
  if (!result || typeof result !== 'object' || !('data' in result)) {
    return false;
  }
  const { data } = result;
  return Array.isArray(data);
}

/** Unwraps a `getTagKeys`/`getTagValues` result (which can be a raw array or a `{ data }` envelope). */
function unwrapTagResult(result: unknown): MetricFindValue[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (hasDataArray(result)) {
    return result.data;
  }
  return [];
}

/**
 * Fetches label keys from the selected datasource. Returns an empty array if the
 * datasource doesn't implement `getTagKeys` — the caller falls back to generic options.
 */
export async function fetchLabelKeys(dsSettings: DataSourceInstanceSettings): Promise<string[]> {
  const ds: DataSourceApi = await getDataSourceSrv().get(dsSettings);
  if (typeof ds.getTagKeys !== 'function') {
    return [];
  }
  try {
    const raw = await ds.getTagKeys({ filters: [] });
    return unwrapTagResult(raw)
      .map((v) => v.text)
      .filter((text): text is string => typeof text === 'string' && text.length > 0)
      .filter((text) => !SKIP_LABEL_KEYS.has(text));
  } catch {
    return [];
  }
}

/**
 * Fetches example values for a label. Falls back to an empty array on any error —
 * the exploration option is still usable, just without a preview.
 *
 * We defensively HTML-entity-decode every value: some datasource pipelines return
 * OWASP-escaped strings (e.g. `AWS&#x2F;ApiGateway` instead of `AWS/ApiGateway`,
 * `&lt;aggregated&gt;` instead of `<aggregated>`), which look broken in the wizard
 * *and* would confuse the Assistant if we forwarded them verbatim as sample values.
 */
export async function fetchLabelValues(
  dsSettings: DataSourceInstanceSettings,
  labelKey: string,
  limit = MAX_SAMPLE_VALUES
): Promise<string[]> {
  const ds: DataSourceApi = await getDataSourceSrv().get(dsSettings);
  if (typeof ds.getTagValues !== 'function') {
    return [];
  }
  try {
    const raw = await ds.getTagValues({ key: labelKey, filters: [] });
    const values = unwrapTagResult(raw)
      .map((v) => v.text)
      .filter((text): text is string => typeof text === 'string' && text.length > 0)
      .map(decodeHtmlEntities);
    return values.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Decodes HTML entities that datasource pipelines sometimes leave in label values.
 * Handles the common named entities plus numeric (`&#123;`) and hex (`&#x7B;`) escapes.
 *
 * We deliberately avoid `DOMParser` / `template.innerHTML` — parsing untrusted strings
 * as HTML pulls the whole parser attack surface into a pure-text util for no benefit.
 * The decoded string is only ever rendered through React's escaping text bindings,
 * so this stays safe even if a value contains genuine `<script>` characters.
 */
export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => safeFromCharCode(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => safeFromCharCode(parseInt(code, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function safeFromCharCode(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
    return '';
  }
  return String.fromCodePoint(code);
}

/**
 * Orders and trims raw label keys before we expand them into exploration options.
 * Preferred keys come first (in the order defined by {@link PREFERRED_LABEL_KEYS});
 * everything else keeps the datasource's ordering.
 */
export function prioritizeLabelKeys(labelKeys: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const preferred of PREFERRED_LABEL_KEYS) {
    if (labelKeys.includes(preferred) && !seen.has(preferred)) {
      ordered.push(preferred);
      seen.add(preferred);
    }
  }
  for (const key of labelKeys) {
    if (!seen.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  }
  return ordered.slice(0, MAX_LABEL_KEYS);
}

/**
 * Builds the deterministic fallback set of exploration options from raw label keys.
 * Used when we couldn't fetch sample values so we can still show the user something.
 */
export function buildFallbackOptions(labelKeys: string[]): ExplorationOption[] {
  const raw = prioritizeLabelKeys(labelKeys).map((labelKey) => ({
    id: labelKey,
    labelKey,
    title: titleForLabelKey(labelKey),
    description: descriptionForLabelKey(labelKey),
  }));
  return trimAndDedupeOptions(raw);
}

/**
 * Collapses categorically-equivalent options into a single row, then trims the list
 * so the wizard shows a scannable set. When e.g. `pod`, `pod_name`, and `k8s_pod_name`
 * are all present, they become one "Pods" row using the highest-priority label key as
 * the primary; the others are stored on `mergedLabelKeys` so the Assistant can still
 * fall back to them if the metrics live on a different variant.
 */
export function trimAndDedupeOptions(options: ExplorationOption[]): ExplorationOption[] {
  // The first option we see for a well-known category wins because {@link prioritizeLabelKeys}
  // has already ordered by preference (e.g. `pod` before `pod_name`).
  const byCategory = new Map<Exclude<LabelCategory, 'other'>, ExplorationOption>();
  const other: ExplorationOption[] = [];

  for (const option of options) {
    const category = categorizeLabelKey(option.labelKey);
    if (category === 'other') {
      other.push(option);
      continue;
    }
    const existing = byCategory.get(category);
    if (!existing) {
      byCategory.set(category, option);
      continue;
    }
    // Merge: keep existing as primary, remember the extra key, prefer the richer sample set.
    const mergedKeys = [...(existing.mergedLabelKeys ?? []), option.labelKey];
    const preferSamples =
      (option.sampleValues?.length ?? 0) > (existing.sampleValues?.length ?? 0)
        ? option.sampleValues
        : existing.sampleValues;
    byCategory.set(category, {
      ...existing,
      mergedLabelKeys: mergedKeys,
      sampleValues: preferSamples,
    });
  }

  const knownRows = Array.from(byCategory.values());
  // Prefer uncategorised options that actually have sample values — a label without
  // any values is not useful as a pivot and just adds noise.
  const otherWithSamples = other.filter((o) => (o.sampleValues?.length ?? 0) > 0);
  const otherWithoutSamples = other.filter((o) => (o.sampleValues?.length ?? 0) === 0);
  const remainingSlots = Math.max(0, MAX_OPTIONS_SHOWN - knownRows.length);
  const extras = [...otherWithSamples, ...otherWithoutSamples].slice(0, remainingSlots);

  return [...knownRows, ...extras];
}

/**
 * Analyses the selected datasource and returns everything we need for the
 * wizard UI *and* the Assistant handoff: ordered label keys, sample values for
 * each of them, and the derived exploration options.
 *
 * An empty `options` array means the datasource has no label metadata we can
 * use — callers should show a friendly "no options available" state.
 */
export async function analyzeDatasource(dsSettings: DataSourceInstanceSettings): Promise<DatasourceAnalysis> {
  const rawLabelKeys = await fetchLabelKeys(dsSettings);
  if (rawLabelKeys.length === 0) {
    const capabilities = await detectCapabilities(dsSettings, [], {});
    return { labelKeys: [], labelSamples: {}, options: [], capabilities };
  }

  const labelKeys = prioritizeLabelKeys(rawLabelKeys);
  const labelSamples: Record<string, string[]> = {};
  const rawOptions: ExplorationOption[] = await Promise.all(
    labelKeys.map(async (labelKey) => {
      const sampleValues = await fetchLabelValues(dsSettings, labelKey);
      if (sampleValues.length > 0) {
        labelSamples[labelKey] = sampleValues;
      }
      return {
        id: labelKey,
        labelKey,
        title: titleForLabelKey(labelKey),
        description: descriptionForLabelKey(labelKey),
        sampleValues: sampleValues.length > 0 ? sampleValues : undefined,
      };
    })
  );

  const options = trimAndDedupeOptions(rawOptions);

  // Also sample values for the fixed "capability meta" label keys — these rarely
  // make sense as exploration pivots but their values are the strongest signal we
  // have for detecting databases, cloud providers, and OTel SDK languages.
  const rawKeySet = new Set(rawLabelKeys);
  const alreadySampled = new Set(Object.keys(labelSamples));
  const metaSamplesEntries = await Promise.all(
    CAPABILITY_META_LABEL_KEYS.filter((key) => rawKeySet.has(key) && !alreadySampled.has(key)).map(
      async (key): Promise<[string, string[]] | undefined> => {
        const values = await fetchLabelValues(dsSettings, key);
        return values.length ? [key, values] : undefined;
      }
    )
  );
  const capabilitySamples = { ...labelSamples };
  for (const entry of metaSamplesEntries) {
    if (entry) {
      capabilitySamples[entry[0]] = entry[1];
    }
  }

  // Capabilities detection consumes the full set of label keys we discovered (not
  // just the prioritized subset). That way K8s-specific keys like `namespace` /
  // `pod` are always considered even if they don't win a slot in the wizard's
  // exploration options.
  const capabilities = await detectCapabilities(dsSettings, rawLabelKeys, capabilitySamples);
  return { labelKeys, labelSamples, options, capabilities };
}
