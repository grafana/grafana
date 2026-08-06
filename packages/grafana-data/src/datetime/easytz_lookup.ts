import { formatOffset, getTimeZone, getTimeZoneAt, getTimeZonesAt as getEasyTzTimeZonesAt } from './easytz';

export interface EasyTzInfo {
  name: string;
  abbr: string;
  offset: number;
  offsetDisplay: string;
  aliasOf?: string;
}

const displayListCache = new WeakMap<ReturnType<typeof getEasyTzTimeZonesAt>, EasyTzInfo[]>();

const withOffsetDisplay = (tz: NonNullable<ReturnType<typeof getTimeZoneAt>>): EasyTzInfo => ({
  ...tz,
  offsetDisplay: formatOffset(tz.offset),
});

export const getTimeZonesAt = (timestamp: number, withAliases?: boolean): EasyTzInfo[] => {
  const source = getEasyTzTimeZonesAt(timestamp, withAliases);
  let list = displayListCache.get(source);

  if (!list) {
    list = source.map(withOffsetDisplay);
    displayListCache.set(source, list);
  }

  return list;
};

/**
 * Looks up a zone by either its canonical id or its legacy spelling; either
 * way the canonical entry is returned (e.g. Asia/Calcutta finds the
 * Asia/Kolkata entry), mirroring how the picker's search resolves legacy
 * names to the canonical option.
 */
export const findTimeZoneAt = (zone: string, timestamp: number): EasyTzInfo | undefined => {
  const tz = getTimeZoneAt(zone, timestamp, false);
  return tz ? withOffsetDisplay(tz) : undefined;
};

/**
 * Returns the canonical IANA id for a zone (e.g. Asia/Calcutta -> Asia/Kolkata).
 * The curated canonical/legacy pairs resolve regardless of which spelling the
 * runtime's ICU lists; unknown names pass through unchanged.
 */
export const canonicalZoneName = (zone: string): string => {
  return getTimeZone(zone, false)?.name ?? zone;
};
