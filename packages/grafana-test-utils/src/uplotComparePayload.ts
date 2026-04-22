import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';

/** JSON written to `scripts/uplot-compare/public/` for the uplot-compare Vite app. */
export const UPLOT_COMPARE_PAYLOAD_VERSION = 1 as const;

/** Stable prefix for payload files: `uplot-compare-payload-<slug>-<id>.json`. */
export const UPLOT_COMPARE_PAYLOAD_FILE_PREFIX = 'uplot-compare-payload' as const;

const SLUG_MAX_LENGTH = 96;

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

export interface UPlotComparePayload {
  version: typeof UPLOT_COMPARE_PAYLOAD_VERSION;
  testName: string;
  expected: unknown;
  actual: unknown;
  uPlotData?: unknown;
  uPlotSeries?: unknown;
  uPlotCanvasEvents: CanvasRenderingContext2DEvent[];
  /** uPlot `width` / `height` (CSS px) for the test canvas; used by uplot-compare to size replay canvases */
  width?: number;
  height?: number;
}

/**
 * Narrow the payload type
 * @param value
 */
export function isUPlotComparePayload(value: unknown): value is UPlotComparePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const o = value as Record<string, unknown>;
  return typeof o.testName === 'string' && 'expected' in o && 'actual' in o;
}
