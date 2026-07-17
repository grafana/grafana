import { InternalTimeZones, type TimeZone, getTimeZone } from '@grafana/data';

import { getTimeZonesAt, type TimeZoneInfo as EasyTzInfo } from './easytz';

export { getTimeZonesAt };

// getTimeZonesAt memoizes per hour bucket and returns the same array by
// reference, so a WeakMap keyed on that array caches the name lookup.
const indexCache = new WeakMap<EasyTzInfo[], Map<string, EasyTzInfo>>();

/** Looks up a zone by either its canonical id or its legacy spelling. */
export const findTimeZoneAt = (zone: string, timestamp: number): EasyTzInfo | undefined => {
  const list = getTimeZonesAt(timestamp);
  let byName = indexCache.get(list);

  if (!byName) {
    // The list contains both canonical ids and legacy spellings as entries,
    // so indexing by name alone covers lookups under either.
    byName = new Map(list.map((tz) => [tz.name, tz]));
    indexCache.set(list, byName);
  }

  return byName.get(zone);
};

/**
 * Returns the canonical IANA id for a zone (e.g. Asia/Calcutta -> Asia/Kolkata).
 * Names the runtime doesn't know pass through unchanged; in particular, a
 * legacy spelling only maps to its canonical id when the runtime lists the
 * legacy spelling (as Chrome's ICU does).
 */
export const canonicalZoneName = (zone: string, timestamp: number): string => {
  const tz = findTimeZoneAt(zone, timestamp);
  return tz ? (tz.aliasOf ?? tz.name) : zone;
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
