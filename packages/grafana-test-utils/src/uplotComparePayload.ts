/** Stable prefix for payload files: `uplot-compare-payload-<slug>.json`. */
export const UPLOT_COMPARE_PAYLOAD_FILE_PREFIX = 'uplot-compare-payload';

export const SLUG_MAX_LENGTH = 96;

/**
 * Turn a Jest `currentTestName` into a short, filesystem-safe slug (ASCII, no path chars).
 * Handles common Jest separators (` › `, ` > `), strips/replaces unsafe characters, caps length.
 */
export function slugifyJestTestNameForFilename(testName: string): string {
  let s = testName.trim();
  if (!s) {
    return 'unknown';
  }

  s = s
    .replace(/\s*›\s*/g, '_')
    .replace(/\s*>\s*/g, '_')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

  s = s
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .replace(/^_|_$/g, '');

  if (!s) {
    return 'unknown';
  }

  if (s.length > SLUG_MAX_LENGTH) {
    s = s.slice(0, SLUG_MAX_LENGTH).replace(/_+$/, '');
  }

  return s;
}

/** Readable slug from the test name */
export function createUPlotComparePayloadBasename(testName: string): string {
  const slug = slugifyJestTestNameForFilename(testName);
  return `${UPLOT_COMPARE_PAYLOAD_FILE_PREFIX}-${slug}.json`;
}
