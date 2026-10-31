import { formatOffset, getTimeZone, getTimeZoneAt, getTimeZonesAt as getEasyTzTimeZonesAt } from './easytz';

export interface EasyTzInfo {
  readonly name: string;
  readonly abbr: string;
  readonly offset: number;
  readonly offsetDisplay: string;
  readonly aliasOf?: string;
}

const displayListCache = new WeakMap<ReturnType<typeof getEasyTzTimeZonesAt>, EasyTzInfo[]>();
const displayInfoCache = new WeakMap<NonNullable<ReturnType<typeof getTimeZoneAt>>, EasyTzInfo>();

// British Columbia stays at UTC−7 after its last clock change. tzdb 2026b models
// that change at 2026-11-01 02:00 Pacific (09:00 UTC): March through October was
// already UTC−7 as PDT, and the old November fall-back must not happen. The
// vendored easy-tz rules still share Vancouver's schedule with Los Angeles, so
// they switch to PST (UTC−8) at that instant. tzdb's abbreviation for the new
// permanent offset is MST.
const VANCOUVER_PERMANENT_UTC7_FROM_MS = Date.UTC(2026, 10, 1, 9, 0, 0);
const VANCOUVER_PERMANENT_UTC7: EasyTzInfo = Object.freeze({
  name: 'America/Vancouver',
  abbr: 'MST',
  offset: -420,
  offsetDisplay: formatOffset(-420),
});

const withVancouverPermanentOffset = (info: EasyTzInfo, timestamp: number): EasyTzInfo => {
  if (info.name !== VANCOUVER_PERMANENT_UTC7.name || timestamp < VANCOUVER_PERMANENT_UTC7_FROM_MS) {
    return info;
  }
  return VANCOUVER_PERMANENT_UTC7;
};

const withOffsetDisplay = (tz: NonNullable<ReturnType<typeof getTimeZoneAt>>): EasyTzInfo => {
  let info = displayInfoCache.get(tz);

  if (!info) {
    info = Object.freeze({
      ...tz,
      offsetDisplay: formatOffset(tz.offset),
    });
    displayInfoCache.set(tz, info);
  }

  return info;
};

export const getTimeZonesAt = (timestamp: number, withAliases?: boolean): EasyTzInfo[] => {
  const source = getEasyTzTimeZonesAt(timestamp, withAliases);
  let list = displayListCache.get(source);

  if (!list) {
    list = source.map((tz) => withVancouverPermanentOffset(withOffsetDisplay(tz), timestamp));
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
  return tz ? withVancouverPermanentOffset(withOffsetDisplay(tz), timestamp) : undefined;
};

/**
 * Returns the canonical IANA id for a zone (e.g. Asia/Calcutta -> Asia/Kolkata).
 * The curated canonical/legacy pairs resolve regardless of which spelling the
 * runtime's ICU lists; unknown names pass through unchanged.
 */
export const canonicalZoneName = (zone: string): string => {
  return getTimeZone(zone, false)?.name ?? zone;
};
