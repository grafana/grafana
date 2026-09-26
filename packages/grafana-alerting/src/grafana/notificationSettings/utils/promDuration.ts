// Ported from public/app/features/alerting/unified/utils/time.ts (not exported by @grafana/data) to
// avoid an internals dependency. A bare "0" is rejected — despite that source's doc comment claiming otherwise.

const PROMETHEUS_SUFFIX_MULTIPLIER: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

const DURATION_REGEXP = new RegExp(/^(?:(?<value>\d+)(?<type>ms|s|m|h|d|w|y))|0$/);

/** Parses a Prometheus-style duration string (e.g. "30s", "5m", "1h30m") into milliseconds. */
export function parsePromDuration(duration: string): number {
  let input = duration;
  const parts: Array<[number, string]> = [];

  function matchDuration(part: string) {
    const match = DURATION_REGEXP.exec(part);
    const value = match?.groups?.value;
    const type = match?.groups?.type;

    if (!match || !value || !type) {
      throw new Error(`Invalid duration: ${duration}`);
    }

    input = input.replace(match[0], '');
    parts.push([Number(value), type]);

    if (input) {
      matchDuration(input);
    }
  }

  matchDuration(duration);

  if (!parts.length) {
    throw new Error(`Invalid duration: ${duration}`);
  }

  return parts.reduce((acc, [value, type]) => acc + value * PROMETHEUS_SUFFIX_MULTIPLIER[type], 0);
}

/** Empty/undefined is valid (the field is optional) — mirrors the internal amroutes.ts validator's behavior. */
export function isValidPromDuration(duration?: string): boolean {
  if (!duration || duration.length === 0) {
    return true;
  }
  try {
    parsePromDuration(duration);
    return true;
  } catch {
    return false;
  }
}
