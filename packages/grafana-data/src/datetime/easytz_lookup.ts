import { formatOffset as easyTzFormatOffset, getTimeZonesAt as getEasyTzTimeZonesAt } from './easytz';

export interface EasyTzInfo {
  name: string;
  abbr: string;
  offset: number;
  offsetDisplay: string;
  aliasOf?: string;
}

const displayListCache = new WeakMap<ReturnType<typeof getEasyTzTimeZonesAt>, EasyTzInfo[]>();

export const getTimeZonesAt = (timestamp: number, withAliases?: boolean): EasyTzInfo[] => {
  const source = getEasyTzTimeZonesAt(timestamp, withAliases);
  let list = displayListCache.get(source);

  if (!list) {
    list = source.map((tz) => ({
      ...tz,
      offsetDisplay: easyTzFormatOffset(tz.offset),
    }));
    displayListCache.set(source, list);
  }

  return list;
};

// getTimeZonesAt memoizes per hour bucket and returns the same array by
// reference, so a WeakMap keyed on that array caches the name lookup.
const indexCache = new WeakMap<EasyTzInfo[], Map<string, EasyTzInfo>>();

/**
 * Looks up a zone by either its canonical id or its legacy spelling; either
 * way the canonical entry is returned (e.g. Asia/Calcutta finds the
 * Asia/Kolkata entry), mirroring how the picker's search resolves legacy
 * names to the canonical option.
 */
export const findTimeZoneAt = (zone: string, timestamp: number): EasyTzInfo | undefined => {
  const list = getTimeZonesAt(timestamp);
  let byName = indexCache.get(list);

  if (!byName) {
    byName = new Map(list.map((tz) => [tz.name, tz]));

    // Re-point legacy spellings at their canonical entry.
    for (const tz of list) {
      const canonical = tz.aliasOf !== undefined ? byName.get(tz.aliasOf) : undefined;

      if (canonical) {
        byName.set(tz.name, canonical);
      }
    }

    indexCache.set(list, byName);
  }

  return byName.get(zone);
};

/**
 * Returns the canonical IANA id for a zone (e.g. Asia/Calcutta -> Asia/Kolkata).
 * The curated canonical/legacy pairs resolve regardless of which spelling the
 * runtime's ICU lists; unknown names pass through unchanged.
 */
export const canonicalZoneName = (zone: string, timestamp: number): string => {
  return findTimeZoneAt(zone, timestamp)?.name ?? zone;
};
