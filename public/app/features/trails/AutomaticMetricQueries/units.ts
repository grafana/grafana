const DEFAULT_UNIT = 'short';

export function getUnitFromMetric(metric: string) {
  const metricParts = metric.split('_');
  if (metricParts.at(-1) === 'bytes' || metricParts.at(-1) === 'seconds') {
    return getUnit(metricParts.at(-1));
  } else {
    return getUnit(metricParts.at(-2));
  }
}

export function getUnit(metricPart: string | undefined) {
  return (metricPart && UNIT_MAP[metricPart]) || DEFAULT_UNIT;
}

const UNIT_MAP: Record<string, string> = {
  bytes: 'bytes',
  seconds: 's',
};

const RATE_UNIT_MAP: Record<string, string> = {
  bytes: 'Bps', // bytes per second
  seconds: 'short', // seconds per second is unitless -- this may indicate a count of some resource that is active
};

const DEFAULT_RATE_UNIT = 'cps'; // Count per second

export function getPerSecondRateUnit(metricPart: string | undefined) {
  return (metricPart && RATE_UNIT_MAP[metricPart]) || DEFAULT_RATE_UNIT;
}
