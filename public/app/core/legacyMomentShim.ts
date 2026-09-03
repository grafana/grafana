import type { LegacyMoment } from '@grafana/data/internal/legacyMoment';

let legacyMoment: LegacyMoment | undefined;
export let tz: LegacyMoment['tz'];

export function setLegacyMoment(implementation: LegacyMoment) {
  legacyMoment = implementation;
  tz = implementation.tz;
}

export { legacyMoment as default };
