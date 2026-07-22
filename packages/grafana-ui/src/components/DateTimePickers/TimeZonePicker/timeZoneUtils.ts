import { InternalTimeZones, type TimeZone, getTimeZone } from '@grafana/data';

import { getTimeZonesAt, type TimeZoneInfo as EasyTzInfo } from './easytz';

export { getTimeZonesAt };

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

let browserTimeZone: string | undefined;

/**
 * Returns the runtime's IANA timezone (replaces moment.tz.guess()). Cached for
 * the lifetime of the page since constructing Intl.DateTimeFormat is costly
 * and this gets called on every render of the Browser Time / Default options.
 */
export const guessBrowserTimeZone = (): string => {
  return (browserTimeZone ??= Intl.DateTimeFormat().resolvedOptions().timeZone);
};

// Resolves Grafana's internal time zones ('', 'browser', 'utc') to a concrete
// IANA name.
export const resolveIanaName = (timeZone: TimeZone): string => {
  switch (timeZone) {
    case InternalTimeZones.utc:
      return 'UTC';
    case InternalTimeZones.localBrowserTime:
      return guessBrowserTimeZone();
    case InternalTimeZones.default: {
      const resolved = getTimeZone();
      // Guard against the resolver handing back the default sentinel again.
      return resolved === InternalTimeZones.default ? guessBrowserTimeZone() : resolveIanaName(resolved);
    }
    default:
      return timeZone;
  }
};

export interface TimeZoneDisplayInfo {
  /** display name; the canonical IANA id, or e.g. 'Default' for internal zones */
  name: string;
  /** DST-aware abbreviation, e.g. 'EST', or 'UTC, GMT' */
  abbreviation: string;
  /** UTC offset at the requested instant, e.g. '+05:30' */
  offset: string;
}

const internalZoneNames: Record<string, string> = {
  [InternalTimeZones.default]: 'Default',
  [InternalTimeZones.localBrowserTime]: 'Browser Time',
  [InternalTimeZones.utc]: 'Coordinated Universal Time',
};

/**
 * Builds display info for any zone value Grafana persists: internal zones
 * (Default, Browser, UTC) inherit the resolved zone's abbreviation and offset,
 * and legacy IANA spellings resolve to their canonical entry. Returns
 * undefined for unknown zone names, like @grafana/data's getTimeZoneInfo.
 */
export const getTimeZoneDisplayInfo = (zone: TimeZone, timestamp: number): TimeZoneDisplayInfo | undefined => {
  const internalName = internalZoneNames[zone];
  const resolved = resolveIanaName(zone);
  const tz = findTimeZoneAt(resolved, timestamp);
  // The runtime's zone list may not contain a plain UTC entry.
  const isUtc = resolved === 'UTC';

  if (tz === undefined && internalName === undefined && !isUtc) {
    return undefined;
  }

  return {
    name: internalName ?? tz?.name ?? resolved,
    abbreviation: isUtc ? 'UTC, GMT' : (tz?.abbr ?? ''),
    offset: tz?.offset ?? '+00:00',
  };
};
