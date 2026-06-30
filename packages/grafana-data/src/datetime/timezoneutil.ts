// Native-Intl timezone helpers. Standalone, no moment-timezone dependency.
//
// NOTE: ZONE_ABBREVIATIONS is hand-curated for the common, well-known named
// abbreviations that Intl('en-US') does not emit. Zones whose modern IANA tzdb
// abbreviation is numeric (e.g. "+04", "-03") are intentionally omitted, since
// those render as empty today anyway. This map should eventually be generated
// from the tz database to be exhaustive and stay in sync across tzdb updates.

/** Standard abbreviation, and optional daylight-saving abbreviation. */
type AbbrEntry = [standard: string] | [standard: string, daylight: string];

export const ZONE_ABBREVIATIONS: Record<string, AbbrEntry> = {
  // --- North America ---
  'America/New_York': ['EST', 'EDT'],
  'America/Detroit': ['EST', 'EDT'],
  'America/Toronto': ['EST', 'EDT'],
  'America/Indiana/Indianapolis': ['EST', 'EDT'],
  'America/Chicago': ['CST', 'CDT'],
  'America/Winnipeg': ['CST', 'CDT'],
  'America/Mexico_City': ['CST'],
  'America/Denver': ['MST', 'MDT'],
  'America/Edmonton': ['MST', 'MDT'],
  'America/Phoenix': ['MST'],
  'America/Los_Angeles': ['PST', 'PDT'],
  'America/Vancouver': ['PST', 'PDT'],
  'America/Tijuana': ['PST', 'PDT'],
  'America/Anchorage': ['AKST', 'AKDT'],
  'America/Adak': ['HST', 'HDT'],
  'America/Halifax': ['AST', 'ADT'],
  'America/Puerto_Rico': ['AST'],
  'America/St_Johns': ['NST', 'NDT'],
  'Atlantic/Bermuda': ['AST', 'ADT'],
  'Pacific/Honolulu': ['HST'],

  // --- Europe (CET/CEST +1/+2) ---
  'Europe/Paris': ['CET', 'CEST'],
  'Europe/Berlin': ['CET', 'CEST'],
  'Europe/Madrid': ['CET', 'CEST'],
  'Europe/Rome': ['CET', 'CEST'],
  'Europe/Amsterdam': ['CET', 'CEST'],
  'Europe/Brussels': ['CET', 'CEST'],
  'Europe/Vienna': ['CET', 'CEST'],
  'Europe/Zurich': ['CET', 'CEST'],
  'Europe/Prague': ['CET', 'CEST'],
  'Europe/Warsaw': ['CET', 'CEST'],
  'Europe/Budapest': ['CET', 'CEST'],
  'Europe/Belgrade': ['CET', 'CEST'],
  'Europe/Stockholm': ['CET', 'CEST'],
  'Europe/Oslo': ['CET', 'CEST'],
  'Europe/Copenhagen': ['CET', 'CEST'],
  'Europe/Ceuta': ['CET', 'CEST'],
  'Africa/Algiers': ['CET'],
  'Africa/Tunis': ['CET'],
  // --- Europe (EET/EEST +2/+3) ---
  'Europe/Athens': ['EET', 'EEST'],
  'Europe/Helsinki': ['EET', 'EEST'],
  'Europe/Bucharest': ['EET', 'EEST'],
  'Europe/Sofia': ['EET', 'EEST'],
  'Europe/Kyiv': ['EET', 'EEST'],
  'Europe/Riga': ['EET', 'EEST'],
  'Europe/Tallinn': ['EET', 'EEST'],
  'Europe/Vilnius': ['EET', 'EEST'],
  'Europe/Chisinau': ['EET', 'EEST'],
  'Asia/Nicosia': ['EET', 'EEST'],
  'Asia/Beirut': ['EET', 'EEST'],
  'Asia/Gaza': ['EET', 'EEST'],
  'Asia/Hebron': ['EET', 'EEST'],
  'Africa/Cairo': ['EET', 'EEST'],
  'Africa/Tripoli': ['EET'],
  // --- Europe (WET/WEST 0/+1) ---
  'Europe/Lisbon': ['WET', 'WEST'],
  'Atlantic/Canary': ['WET', 'WEST'],
  'Atlantic/Madeira': ['WET', 'WEST'],
  'Atlantic/Faroe': ['WET', 'WEST'],
  // --- Europe (other) ---
  'Europe/London': ['GMT', 'BST'],
  'Europe/Dublin': ['GMT', 'IST'],
  'Atlantic/Reykjavik': ['GMT'],
  'Europe/Moscow': ['MSK'],
  'Europe/Kaliningrad': ['EET'],

  // --- Asia (named) ---
  'Asia/Kolkata': ['IST'],
  'Asia/Tokyo': ['JST'],
  'Asia/Seoul': ['KST'],
  'Asia/Shanghai': ['CST'],
  'Asia/Taipei': ['CST'],
  'Asia/Hong_Kong': ['HKT'],
  'Asia/Bangkok': ['ICT'],
  'Asia/Ho_Chi_Minh': ['ICT'],
  'Asia/Phnom_Penh': ['ICT'],
  'Asia/Vientiane': ['ICT'],
  'Asia/Jakarta': ['WIB'],
  'Asia/Makassar': ['WITA'],
  'Asia/Jayapura': ['WIT'],
  'Asia/Karachi': ['PKT'],
  'Asia/Manila': ['PST'],
  'Asia/Jerusalem': ['IST', 'IDT'],

  // --- Africa (named) ---
  'Africa/Nairobi': ['EAT'],
  'Africa/Dar_es_Salaam': ['EAT'],
  'Africa/Kampala': ['EAT'],
  'Africa/Addis_Ababa': ['EAT'],
  'Africa/Mogadishu': ['EAT'],
  'Africa/Lagos': ['WAT'],
  'Africa/Kinshasa': ['WAT'],
  'Africa/Douala': ['WAT'],
  'Africa/Luanda': ['WAT'],
  'Africa/Maputo': ['CAT'],
  'Africa/Harare': ['CAT'],
  'Africa/Lusaka': ['CAT'],
  'Africa/Khartoum': ['CAT'],
  'Africa/Windhoek': ['CAT'],
  'Africa/Johannesburg': ['SAST'],
  'Africa/Maseru': ['SAST'],
  'Africa/Mbabane': ['SAST'],

  // --- Australia / NZ ---
  'Australia/Perth': ['AWST'],
  'Australia/Adelaide': ['ACST', 'ACDT'],
  'Australia/Darwin': ['ACST'],
  'Australia/Sydney': ['AEST', 'AEDT'],
  'Australia/Melbourne': ['AEST', 'AEDT'],
  'Australia/Hobart': ['AEST', 'AEDT'],
  'Australia/Brisbane': ['AEST'],
  'Pacific/Auckland': ['NZST', 'NZDT'],

  // --- Pacific (named) ---
  'Pacific/Guam': ['ChST'],
  'Pacific/Saipan': ['ChST'],
  'Pacific/Pago_Pago': ['SST'],
  'Pacific/Midway': ['SST'],

  // --- UTC ---
  UTC: ['UTC'],
  'Etc/UTC': ['UTC'],
  'Etc/GMT': ['GMT'],
};

/** Lists canonical IANA timezone names supported by the runtime. */
export function listTimeZones(): string[] {
  return Intl.supportedValuesOf('timeZone');
}

/** Returns the runtime's current IANA timezone (replaces moment.tz.guess()). */
export function guessBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** True if the string is a timezone the runtime understands. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Offset of `timeZone` from UTC at `timestamp`, in minutes EAST of UTC
 * (e.g. America/New_York in winter => -300). Note: this is the opposite sign
 * from moment's Zone#utcOffset.
 */
export function getTimeZoneOffsetMinutes(timeZone: string, timestamp: number = Date.now()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(timestamp);
  const value = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(value);
  if (!match) {
    return 0; // "GMT" / "UTC"
  }
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  return sign * (hours * 60 + minutes);
}

function intlShortAbbreviation(timeZone: string, timestamp: number): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(timestamp);
    const value = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    // Strip numeric forms like "GMT+5" / "+05" to match existing behavior.
    return /^(?:GMT|UTC)?[+-]/.test(value) ? '' : value;
  } catch {
    return '';
  }
}

/**
 * Named timezone abbreviation at `timestamp` (e.g. "CET"/"CEST"), or '' when
 * only a numeric form is available. Aims for parity with moment Zone#abbr.
 */
export function getTimeZoneAbbreviation(timeZone: string, timestamp: number = Date.now()): string {
  const entry = ZONE_ABBREVIATIONS[timeZone];
  if (!entry) {
    return intlShortAbbreviation(timeZone, timestamp);
  }
  const [standard, daylight] = entry;
  if (!daylight) {
    return standard;
  }
  const year = new Date(timestamp).getUTCFullYear();
  const janOffset = getTimeZoneOffsetMinutes(timeZone, Date.UTC(year, 0, 1));
  const julOffset = getTimeZoneOffsetMinutes(timeZone, Date.UTC(year, 6, 1));
  if (janOffset === julOffset) {
    return standard; // no DST this year
  }
  const standardOffset = Math.min(janOffset, julOffset);
  const currentOffset = getTimeZoneOffsetMinutes(timeZone, timestamp);
  return currentOffset === standardOffset ? standard : daylight;
}
