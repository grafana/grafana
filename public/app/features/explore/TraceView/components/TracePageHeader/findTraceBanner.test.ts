import { type TraceSpan } from '../types/trace';

import { findTraceBanner, getSpanTracePercent, getTraceBannerOperationLabel } from './findTraceBanner';

function createSpan(overrides: Partial<TraceSpan> = {}): TraceSpan {
  return {
    traceID: 'trace-1',
    spanID: 'span-1',
    operationName: 'GET /health',
    startTime: 1_000,
    duration: 100,
    logs: [],
    processID: 'proc-1',
    flags: 0,
    depth: 0,
    hasChildren: false,
    childSpanCount: 0,
    process: { serviceName: 'api', tags: [] },
    relativeStartTime: 0,
    tags: [],
    references: [],
    warnings: [],
    childSpanIds: [],
    subsidiarilyReferencedBy: [],
    ...overrides,
  };
}

describe('findTraceBanner', () => {
  it('returns undefined when no span has an error or client-error status', () => {
    expect(findTraceBanner([createSpan()])).toBeUndefined();
  });

  it('selects a span tagged error=true even without an HTTP status', () => {
    const highlight = findTraceBanner([createSpan({ tags: [{ key: 'error', value: true }] })]);

    expect(highlight?.severity).toBe('error');
    expect(highlight?.span.spanID).toBe('span-1');
  });

  it('prefers the OTEL status attribute over the legacy key', () => {
    const highlight = findTraceBanner([
      createSpan({
        tags: [
          { key: 'http.response.status_code', value: 500 },
          { key: 'http.status_code', value: 200 },
        ],
      }),
    ]);

    expect(highlight?.severity).toBe('error');
  });

  it('treats a 4xx status as a warning when there are no errors', () => {
    const highlight = findTraceBanner([createSpan({ tags: [{ key: 'http.status_code', value: 404 }] })]);

    expect(highlight?.severity).toBe('warning');
  });

  it('selects the deepest error span over a shallower 5xx parent', () => {
    const parent = createSpan({
      spanID: 'parent',
      depth: 0,
      duration: 2000,
      tags: [{ key: 'http.status_code', value: 500 }],
    });
    const child = createSpan({
      spanID: 'child',
      depth: 2,
      duration: 1400,
      tags: [{ key: 'error', value: true }],
    });

    const highlight = findTraceBanner([parent, child]);

    expect(highlight?.span.spanID).toBe('child');
    expect(highlight?.severity).toBe('error');
  });

  it('prefers an error span when the trace also has a 4xx warning', () => {
    const warning = createSpan({
      spanID: 'warning',
      depth: 3,
      duration: 9000,
      tags: [{ key: 'http.status_code', value: 404 }],
    });
    const error = createSpan({
      spanID: 'error',
      depth: 1,
      duration: 100,
      tags: [{ key: 'error', value: true }],
    });

    const highlight = findTraceBanner([warning, error]);

    expect(highlight?.span.spanID).toBe('error');
    expect(highlight?.severity).toBe('error');
  });

  it('selects the longest warning span when there are no errors', () => {
    const shortWarning = createSpan({
      spanID: 'short',
      depth: 1,
      duration: 100,
      tags: [{ key: 'http.status_code', value: 400 }],
    });
    const longWarning = createSpan({
      spanID: 'long',
      depth: 1,
      duration: 800,
      tags: [{ key: 'http.status_code', value: 404 }],
    });

    expect(findTraceBanner([shortWarning, longWarning])?.span.spanID).toBe('long');
  });

  describe('getTraceBannerOperationLabel', () => {
    it('joins the HTTP method with the route', () => {
      const span = createSpan({
        operationName: 'HTTP POST',
        tags: [
          { key: 'http.request.method', value: 'POST' },
          { key: 'http.route', value: '/payments/authorize' },
        ],
      });

      expect(getTraceBannerOperationLabel(span)).toBe('POST /payments/authorize');
    });

    it('uses the URL pathname when only a full URL is present', () => {
      const span = createSpan({
        tags: [
          { key: 'http.method', value: 'POST' },
          { key: 'http.url', value: 'https://payments.internal/payments/authorize' },
        ],
      });

      expect(getTraceBannerOperationLabel(span)).toBe('POST /payments/authorize');
    });

    it('falls back to the operation name when HTTP tags are absent', () => {
      expect(getTraceBannerOperationLabel(createSpan({ operationName: 'db.query' }))).toBe('db.query');
    });
  });

  describe('getSpanTracePercent', () => {
    it('rounds the span share of the trace duration to one decimal place', () => {
      expect(getSpanTracePercent(1_420_000, 2_410_000)).toBe(58.9);
    });

    it('does not round a near-full child span up to 100', () => {
      expect(getSpanTracePercent(14_740_000, 14_760_000)).toBe(99.9);
    });

    it('returns 0 when the trace duration is not positive', () => {
      expect(getSpanTracePercent(100, 0)).toBe(0);
    });

    it('clamps values above 100 when a span is longer than the trace', () => {
      expect(getSpanTracePercent(300, 100)).toBe(100);
    });
  });
});
