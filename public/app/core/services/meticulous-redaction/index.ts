import { createQueryRedactionMiddleware } from './redactionMiddleware';

/**
 * Registers the query-redaction middleware with the Meticulous recorder. The
 * recorder reads window.METICULOUS_RECORDER_MIDDLEWARE_V1 lazily each time it
 * prepares a payload for upload, so registering during app boot covers all
 * datasource query traffic (queries can only fire after boot).
 *
 * The recorder-presence gate lives at the call site (app.ts) so this module —
 * and its @alwaysmeticulous/redaction dependency — stays in a lazy-loaded
 * chunk that is never fetched when the recorder is off.
 */
export function initMeticulousRedaction(): void {
  window.METICULOUS_RECORDER_MIDDLEWARE_V1 = window.METICULOUS_RECORDER_MIDDLEWARE_V1 ?? [];
  window.METICULOUS_RECORDER_MIDDLEWARE_V1.push(createQueryRedactionMiddleware());
}
