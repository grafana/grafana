const DEFAULT_UNIT = 'short';

// Get unit from metric name (e.g. "go_gc_duration_seconds" -> "seconds")
export function getUnitFromMetric(metric: string) {
  const metricParts = metric.split('_');
  const suffix = metricParts.at(-1) ?? '';
  const secondToLastSuffix = metricParts.at(-2) ?? '';
  if (UNIT_LIST.includes(suffix)) {
    return suffix;
  } else if (UNIT_LIST.includes(secondToLastSuffix)) {
    return secondToLastSuffix;
  } else {
    return null;
  }
}

// Get Grafana unit for a panel (e.g. "go_gc_duration_seconds" -> "s")
export function getUnit(metricPart: string | undefined) {
  return (metricPart && UNIT_MAP[metricPart]) || DEFAULT_UNIT;
}

const UNIT_MAP: Record<string, string> = {
  bytes: 'bytes',
  seconds: 's',
};

const UNIT_LIST = ['bytes', 'seconds'];

const RATE_UNIT_MAP: Record<string, string> = {
  bytes: 'Bps', // bytes per second
  seconds: 'short', // seconds per second is unitless -- this may indicate a count of some resource that is active
};

const DEFAULT_RATE_UNIT = 'cps'; // Count per second

export function getPerSecondRateUnit(metricPart: string | undefined) {
  return (metricPart && RATE_UNIT_MAP[metricPart]) || DEFAULT_RATE_UNIT;
}
