import { InternalTimeZones, type TimeZone, getTimeZone } from '@grafana/data';

import { getTimeZonesAt, type TimeZoneInfo as EasyTzInfo } from './easytz';

// getTimeZonesAt memoizes per hour bucket and returns the same array by
// reference, so a WeakMap keyed on that array gives us a cheap name lookup.
const lookupCache = new WeakMap<EasyTzInfo[], Map<string, EasyTzInfo>>();

export const findTimeZoneAt = (zone: string, timestamp: number): EasyTzInfo | undefined => {
  const list = getTimeZonesAt(timestamp);
  let byName = lookupCache.get(list);

  if (!byName) {
    byName = new Map(list.map((info) => [info.name, info]));

    // Also index legacy spellings under their canonical id, so e.g. a lookup
    // of Asia/Kolkata resolves when the runtime lists Asia/Calcutta.
    for (const info of list) {
      if (info.aliasOf !== undefined && !byName.has(info.aliasOf)) {
        byName.set(info.aliasOf, info);
      }
    }

    lookupCache.set(list, byName);
  }

  return byName.get(zone);
};

/** Parses an easy-tz offset string like "-05:00" into minutes east of UTC. */
export const offsetToMinutes = (offset: string): number => {
  const sign = offset.startsWith('-') ? -1 : 1;
  const [hours, minutes] = offset.slice(1).split(':').map(Number);
  return sign * (hours * 60 + minutes);
};

/** Returns the runtime's current IANA timezone (replaces moment.tz.guess()). */
export const guessBrowserTimeZone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
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
