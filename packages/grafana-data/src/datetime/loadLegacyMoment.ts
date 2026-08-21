// eslint-disable-next-line no-restricted-imports
import type legacyMomentType from 'moment-timezone';

export type LegacyMoment = typeof legacyMomentType;

export async function loadLegacyMoment(): Promise<LegacyMoment> {
  const { default: legacyMoment } = await import('moment-timezone/index');
  return legacyMoment;
}
