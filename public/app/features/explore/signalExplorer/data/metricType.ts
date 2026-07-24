import { t } from '@grafana/i18n';

import type { MetricType } from '../types';

const CLASSIC_HISTOGRAM_SUFFIXES = ['_bucket', '_sum', '_count'];

// Heuristic mirrors @grafana/prometheus metrics-modal getPromTypes/generateMetricData:
// a metadata `type` of "histogram" on a base metric name (no classic _bucket/_sum/_count
// suffix) is treated as a native histogram; the classic exploded series stay "histogram".
export function deriveMetricType(name: string, meta?: { type?: string; help?: string }): MetricType {
  const raw = (meta?.type ?? '').toLowerCase();
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
