export const DEFAULT_UNIT = 'short';
export const DEFAULT_RATE_UNIT = 'cps'; // Count per second

const UNIT_MAP: Record<string, string> = { bytes: 'bytes', seconds: 's' };
const UNIT_LIST = Object.keys(UNIT_MAP);
const RATE_UNIT_MAP: Record<string, string> = {
  bytes: 'Bps', // bytes per second
  // seconds per second is unitless
  // this may indicate a count of some resource that is active
  seconds: 'short',
};

// Get unit from metric name (e.g. "go_gc_duration_seconds" -> "seconds")
export function getUnitFromMetric(metric: string) {
  if (!metric) {
    return null;
  }

  const metricParts = metric.toLowerCase().split('_').slice(-2); // Get last two parts
  for (let i = metricParts.length - 1; i >= 0; i--) {
    if (UNIT_LIST.includes(metricParts[i])) {
      return metricParts[i];
    }
  }
  return null;
}

// Get Grafana unit for a panel (e.g. "go_gc_duration_seconds" -> "s")
export function getUnit(metricPart: string | undefined) {
  return (metricPart && UNIT_MAP[metricPart]) || DEFAULT_UNIT;
}

export function getPerSecondRateUnit(metricPart: string | undefined) {
  return (metricPart && RATE_UNIT_MAP[metricPart]) || DEFAULT_RATE_UNIT;
}
