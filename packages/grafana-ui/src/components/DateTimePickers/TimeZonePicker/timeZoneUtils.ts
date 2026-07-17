import { InternalTimeZones, type TimeZone, getTimeZone } from '@grafana/data';

import { getTimeZonesAt, type TimeZoneInfo as EasyTzInfo } from './easytz';

export interface CanonicalTimeZoneInfo {
  /** canonical IANA zone id, e.g. "Asia/Kolkata" */
  name: string;
  /** DST-aware abbreviation, e.g. "EST" / "EDT" */
  abbr: string;
  /** UTC offset at the requested instant, e.g. "-05:00" */
  offset: string;
  /** the runtime's legacy spelling when it differs, e.g. "Asia/Calcutta" */
  legacyName?: string;
}

interface CanonicalCatalog {
  list: CanonicalTimeZoneInfo[];
  byName: Map<string, CanonicalTimeZoneInfo>;
}

// getTimeZonesAt memoizes per hour bucket and returns the same array by
// reference, so a WeakMap keyed on that array caches the derived catalog.
const catalogCache = new WeakMap<EasyTzInfo[], CanonicalCatalog>();

/**
 * Folds the runtime's zone list into canonical-only entries (e.g. Chrome's
 * ICU lists the legacy Asia/Calcutta; it becomes Asia/Kolkata carrying
 * legacyName), indexed under both spellings.
 */
const getCanonicalCatalog = (timestamp: number): CanonicalCatalog => {
  const source = getTimeZonesAt(timestamp);
  let catalog = catalogCache.get(source);

  if (!catalog) {
    const list: CanonicalTimeZoneInfo[] = [];
    const byName = new Map<string, CanonicalTimeZoneInfo>();

    for (const tz of source) {
      const name = tz.aliasOf ?? tz.name;

      // Guard against runtimes that list both spellings of the same zone.
      if (byName.has(name)) {
        continue;
      }

      const info: CanonicalTimeZoneInfo =
        tz.aliasOf === undefined
          ? { name, abbr: tz.abbr, offset: tz.offset }
          : { name, abbr: tz.abbr, offset: tz.offset, legacyName: tz.name };

      list.push(info);
      byName.set(name, info);

      if (info.legacyName !== undefined) {
        byName.set(info.legacyName, info);
      }
    }

    catalog = { list, byName };
    catalogCache.set(source, catalog);
  }

  return catalog;
};

/**
 * All zones known to the runtime at `timestamp` (epoch ms), deduplicated to
 * canonical IANA ids. Results are memoized per UTC hour bucket and returned
 * by reference — treat them as immutable.
 */
export const getCanonicalTimeZonesAt = (timestamp: number): CanonicalTimeZoneInfo[] =>
  getCanonicalCatalog(timestamp).list;

/** Looks up a zone by either its canonical id or its legacy spelling. */
export const findTimeZoneAt = (zone: string, timestamp: number): CanonicalTimeZoneInfo | undefined =>
  getCanonicalCatalog(timestamp).byName.get(zone);

/**
 * Returns the canonical IANA id for a zone (e.g. Asia/Calcutta -> Asia/Kolkata).
 * Names the runtime doesn't know pass through unchanged; in particular, a
 * legacy spelling only maps to its canonical id when the runtime lists the
 * legacy spelling (as Chrome's ICU does).
 */
export const canonicalZoneName = (zone: string, timestamp: number): string =>
  findTimeZoneAt(zone, timestamp)?.name ?? zone;

/** Parses an easy-tz offset string like "-05:00" into minutes east of UTC. */
export const offsetToMinutes = (offset: string): number => {
  const sign = offset.startsWith('-') ? -1 : 1;
  const [hours, minutes] = offset.slice(1).split(':').map(Number);
  return sign * (hours * 60 + minutes);
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
