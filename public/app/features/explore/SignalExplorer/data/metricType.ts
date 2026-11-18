import type { MetricType } from '../types';

// Which suffixes mean "this series is one part of a classic (non-native) histogram or summary".
const CLASSIC_HISTOGRAM_SUFFIXES = ['_bucket', '_sum', '_count'];

// Which suffixes a series may carry that its *family* metadata does not. A superset of the above:
// `_total` belongs here because an OpenMetrics counter is exposed as `foo_total` with metadata keyed
// `foo`, but it must NOT reach the classic/native split above — a counter's `_total` is not a bucket.
const FAMILY_NAME_SUFFIXES = [...CLASSIC_HISTOGRAM_SUFFIXES, '_total'];

/**
 * The metric family a series belongs to: `foo_bucket` → `foo`.
 *
 * `/api/v1/metadata` is keyed by the family name while the catalog lists the series, and the two often
 * differ: a classic histogram or summary contributes only `_bucket`/`_sum`/`_count` and never the bare
 * family name, and an OpenMetrics counter appears as `foo_total`. Looking metadata up by series name
 * alone misses all of them — measured against a real Prometheus, that left 62% of the catalog typed
 * `unknown` and meant the histogram branch below never ran once.
 */
export function baseMetricName(name: string): string {
  const suffix = FAMILY_NAME_SUFFIXES.find((candidate) => name.endsWith(candidate));
  return suffix ? name.slice(0, -suffix.length) : name;
}

// The only two types worth guessing from prose: a metric that describes itself as a histogram or a
// summary almost always is one, and nothing else is described that reliably.
const HELP_TEXT_TYPES = ['histogram', 'summary'] as const;

/**
 * The type of a metric, from its `/api/v1/metadata` entry and, failing that, from its name and then
 * its help text. `catalog` is every metric name the datasource listed, which the name fallback needs
 * to tell a histogram's `_sum`/`_count` from a summary's.
 *
 * Adapted from `@grafana/prometheus`'s metrics-modal `generateMetricData`, with two deliberate
 * differences:
 * - upstream *appends* a help-text match to whatever the metadata says (`"counter (histogram)"`).
 *   `MetricType` is a closed union, so the help text is consulted only when the metadata carries no
 *   usable type — which is where it earns its keep, rescuing a metric that would render `unknown`.
 * - upstream treats only `_bucket` as a classic (non-native) histogram series; a classic histogram
 *   also explodes into `_sum` and `_count`, so those count here too.
 */
export function deriveMetricType(
  name: string,
  meta: { type?: string; help?: string } | undefined,
  catalog: ReadonlySet<string>
): MetricType {
  const declared = (meta?.type ?? '').toLowerCase();
  const raw = isKnownType(declared) ? declared : fromName(name, catalog) || fromHelpText(meta?.help);

  switch (raw) {
    case 'counter':
      return 'counter';
    case 'gauge':
      return 'gauge';
    case 'summary':
      return 'summary';
    case 'histogram': {
      const isClassic = CLASSIC_HISTOGRAM_SUFFIXES.some((s) => name.endsWith(s));
      return isClassic ? 'histogram' : 'native histogram';
    }
    default:
      return 'unknown';
  }
}

function isKnownType(type: string): boolean {
  return type === 'counter' || type === 'gauge' || type === 'summary' || type === 'histogram';
}

/**
 * Only suffixes Prometheus reserves for one type are trusted; anything else stays `unknown`, because
 * a wrong type is worse than none. A gauge has no such suffix, so it is never inferred.
 */
function fromName(name: string, catalog: ReadonlySet<string>): string {
  if (name.endsWith('_total')) {
    return 'counter';
  }
  if (name.endsWith('_bucket')) {
    return 'histogram';
  }
  // `_sum`/`_count` alone could be either a histogram or a summary, so the family's other series decide.
  if (name.endsWith('_sum') || name.endsWith('_count')) {
    const family = baseMetricName(name);
    if (catalog.has(`${family}_bucket`)) {
      return 'histogram';
    }
    return isSummaryFamily(family, catalog) ? 'summary' : '';
  }
  return isSummaryFamily(name, catalog) ? 'summary' : '';
}

// A summary's quantiles live under the bare family name. With `_bucket` present as well, the bare name
// is more likely a native histogram scraped alongside its classic form.
function isSummaryFamily(family: string, catalog: ReadonlySet<string>): boolean {
  return (
    catalog.has(family) &&
    catalog.has(`${family}_sum`) &&
    catalog.has(`${family}_count`) &&
    !catalog.has(`${family}_bucket`)
  );
}

function fromHelpText(help?: string): string {
  const lowered = help?.toLowerCase() ?? '';
  return HELP_TEXT_TYPES.find((type) => lowered.includes(type)) ?? '';
}
