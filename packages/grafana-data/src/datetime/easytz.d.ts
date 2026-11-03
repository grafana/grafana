export interface TimeZoneInfo {
  /** IANA zone id, e.g. "America/New_York" */
  name: string;
  /** DST-aware abbreviation, e.g. "EST" / "EDT" (not "GMT-5" where avoidable) */
  abbr: string;
  /** UTC offset at the requested instant, in signed minutes (east positive,
   * west negative): -300 for New York EST, 330 for Kolkata, 0 for UTC.
   * Use formatOffset(offset) for a "-05:00" style string. */
  offset: number;
  /** canonical id when `name` is a legacy spelling ("Asia/Kolkata") */
  aliasOf?: string;
}

/**
 * All IANA zones known to the runtime (sorted by name) with their
 * DST-correct abbreviation and UTC offset at `timestamp` (epoch ms).
 * Results are memoized per UTC hour bucket and returned by reference —
 * treat them as immutable.
 *
 * `withAliases: false` omits the legacy-spelled entries (those with an
 * `aliasOf`); their canonical counterparts are always in the list, so the
 * result is the deduped canonical set. Filtered lists are memoized and
 * returned by reference too, and share the same TimeZoneInfo instances.
 */
export declare function getTimeZonesAt(timestamp: number, withAliases?: boolean): TimeZoneInfo[];

/**
 * A single zone's DST-correct abbreviation and UTC offset at `timestamp`
 * (epoch ms) — the single-zone / many-timestamps counterpart to
 * getTimeZonesAt(). Not memoized (each call is allocation-light), so it suits
 * sweeping one zone across many instants.
 *
 * Accepts any name the list contains, plus the fixed-offset ids ICU accepts
 * but doesn't enumerate: `UTC`, `Etc/UTC`, and `Etc/GMT+1`..`+12` /
 * `Etc/GMT-1`..`-14` (POSIX sign inversion — `Etc/GMT+5` is UTC-05:00).
 * Any other unknown name returns `undefined`.
 *
 * `withAliases: false` resolves a legacy `name` as its canonical zone, so
 * the result never carries an `aliasOf` — note that its `name` is then the
 * canonical spelling, not the one passed in. Canonical, fixed-offset and
 * unknown names are unaffected.
 */
export declare function getTimeZoneAt(name: string, timestamp: number, withAliases?: boolean): TimeZoneInfo | undefined;

/**
 * All zones at the current instant (Date.now()) — a no-timestamp convenience
 * over getTimeZonesAt(). On the baked impls (07/10) this is the schedule-only
 * route: it never touches the baked historical eras, so importing ONLY
 * getTimeZones() lets a bundler tree-shake the history tables out entirely
 * (the current instant is always the bake year or later). Same hour-bucket
 * memoization and `withAliases` behavior as getTimeZonesAt().
 */
export declare function getTimeZones(withAliases?: boolean): TimeZoneInfo[];

/**
 * One zone at the current instant (Date.now()) — the single-zone counterpart
 * to getTimeZones(), and the no-timestamp counterpart to getTimeZoneAt().
 * On the baked impls (07/10) it takes the same schedule-only route, so
 * importing only getTimeZone()/getTimeZones() lets a bundler tree-shake the
 * history tables out entirely. Same name and `withAliases` handling as
 * getTimeZoneAt(), including the fixed-offset Etc ids. Not memoized — the
 * result is an interned instance, so each call allocates nothing.
 */
export declare function getTimeZone(name: string, withAliases?: boolean): TimeZoneInfo | undefined;

/**
 * Drops the hour-bucket memo so the next call recomputes (first-call
 * init/verification work is NOT redone). Only needed when the result
 * arrays were mutated or in test/bench harnesses.
 */
export declare function clearCache(): void;

/**
 * Formats a signed-minutes UTC offset (a TimeZoneInfo.offset) as an
 * ISO-style string: 0 -> "+00:00", -300 -> "-05:00", 330 -> "+05:30".
 */
export declare function formatOffset(minutes: number): string;
