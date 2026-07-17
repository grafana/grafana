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
