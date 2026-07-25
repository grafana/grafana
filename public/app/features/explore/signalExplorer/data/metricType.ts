import { t } from '@grafana/i18n';

import type { MetricType } from '../types';

const CLASSIC_HISTOGRAM_SUFFIXES = ['_bucket', '_sum', '_count'];

// The only two types worth guessing from prose: a metric that describes itself as a histogram or a
// summary almost always is one, and nothing else is described that reliably.
const HELP_TEXT_TYPES = ['histogram', 'summary'] as const;

/**
 * The type of a metric, from its `/api/v1/metadata` entry and, failing that, from its help text.
 *
 * Adapted from `@grafana/prometheus`'s metrics-modal `generateMetricData`, with two deliberate
 * differences:
 * - upstream *appends* a help-text match to whatever the metadata says (`"counter (histogram)"`).
 *   `MetricType` is a closed union, so the help text is consulted only when the metadata carries no
 *   usable type — which is where it earns its keep, rescuing a metric that would render `unknown`.
 * - upstream treats only `_bucket` as a classic (non-native) histogram series; a classic histogram
 *   also explodes into `_sum` and `_count`, so those count here too.
 */
export function deriveMetricType(name: string, meta?: { type?: string; help?: string }): MetricType {
  const declared = (meta?.type ?? '').toLowerCase();
  const raw = isKnownType(declared) ? declared : fromHelpText(meta?.help);

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

function fromHelpText(help?: string): string {
  const lowered = help?.toLowerCase() ?? '';
  return HELP_TEXT_TYPES.find((type) => lowered.includes(type)) ?? '';
}

/**
 * The translated label for one metric type. Rebuilds the whole option list per call (and so calls
 * `t()` six times), so call it from a `useMemo` rather than inside a render loop.
 */
export function getMetricTypeLabel(type: MetricType): string {
  return getMetricTypeOptions().find((option) => option.value === type)?.label ?? type;
}

export function getMetricTypeOptions(): Array<{ value: MetricType; label: string }> {
  return [
    { value: 'counter', label: t('explore.signal-explorer.type.counter', 'Counter') },
    { value: 'gauge', label: t('explore.signal-explorer.type.gauge', 'Gauge') },
    { value: 'histogram', label: t('explore.signal-explorer.type.histogram', 'Histogram') },
    { value: 'native histogram', label: t('explore.signal-explorer.type.native-histogram', 'Native histogram') },
    { value: 'summary', label: t('explore.signal-explorer.type.summary', 'Summary') },
    { value: 'unknown', label: t('explore.signal-explorer.type.unknown', 'Unknown') },
  ];
}
