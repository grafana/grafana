import { InternalTimeZones, type TimeZone, getTimeZone, guessBrowserTimeZone } from '@grafana/data';
import { findTimeZoneAt } from '@grafana/data/unstable';

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
