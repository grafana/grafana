import {
  type DataFrame,
  type DataSourceApi,
  type QueryHint,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
} from '@grafana/data';

import { type EnrichmentContext } from './types';
import { hasRangeVariable, hintRows, maxSeverity, responseMetaRows } from './util';

function makeCtx(overrides: Partial<EnrichmentContext> = {}): EnrichmentContext {
  return {
    datasource: { type: 'prometheus' } as unknown as DataSourceApi,
    timeRange: getDefaultTimeRange(),
    expr: 'up',
    refId: 'A',
    isRoot: true,
    queryResponse: undefined,
    ...overrides,
  };
}

function doneResponse(series: DataFrame[], extra: Partial<PanelData> = {}): PanelData {
  return { state: LoadingState.Done, series, ...extra } as unknown as PanelData;
}

describe('maxSeverity', () => {
  it('keeps the more urgent of two severities', () => {
    expect(maxSeverity(undefined, undefined)).toBeUndefined();
    expect(maxSeverity('info', undefined)).toBe('info');
    expect(maxSeverity(undefined, 'warning')).toBe('warning');
    expect(maxSeverity('info', 'warning')).toBe('warning');
    expect(maxSeverity('error', 'warning')).toBe('error');
    expect(maxSeverity('warning', 'error')).toBe('error');
  });
});

describe('hasRangeVariable', () => {
  it.each(['[$__rate_interval]', '[$__auto]', '${__interval}', '[$__interval_ms]'])(
    'detects the placeholder in %p',
    (text) => {
      expect(hasRangeVariable(text)).toBe(true);
    }
  );

  it('returns false for a literal duration', () => {
    expect(hasRangeVariable('[5m]')).toBe(false);
  });
});

describe('hintRows', () => {
  it('maps each hint to a row, capped at 5', () => {
    const hints: QueryHint[] = Array.from({ length: 7 }, (_, i) => ({ type: `HINT_${i}`, label: `Hint ${i}` }));
    const rows = hintRows(hints);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ label: 'Hint', value: 'Hint 0' });
  });
});

describe('responseMetaRows', () => {
  it('reports request and processing time from the response', () => {
    const ctx = makeCtx({
      queryResponse: doneResponse([], {
        request: { startTime: 1000, endTime: 1450 } as PanelData['request'],
        timings: { dataProcessingTime: 12 },
      }),
    });

    const overlay = responseMetaRows(ctx);

    expect(overlay.rows).toContainEqual({ label: 'Request time', value: '450 ms' });
    expect(overlay.rows).toContainEqual({ label: 'Processing time', value: '12 ms' });
  });

  it('surfaces the executed query string when it differs from the source expression', () => {
    const frame = { refId: 'A', length: 0, meta: { executedQueryString: 'up{job="x"}' } } as unknown as DataFrame;
    const ctx = makeCtx({ expr: 'up', queryResponse: doneResponse([frame]) });

    const overlay = responseMetaRows(ctx);

    expect(overlay.rows).toContainEqual({ label: 'Executed query', value: 'up{job="x"}' });
  });

  it('does not duplicate the executed query when it matches the source expression', () => {
    const frame = { refId: 'A', length: 0, meta: { executedQueryString: 'up' } } as unknown as DataFrame;
    const ctx = makeCtx({ expr: 'up', queryResponse: doneResponse([frame]) });

    expect(responseMetaRows(ctx).rows).not.toContainEqual(expect.objectContaining({ label: 'Executed query' }));
  });

  it('flags a limit-reached frame with a warning', () => {
    const frame = { refId: 'A', length: 1000, meta: { limit: 1000 } } as unknown as DataFrame;
    const ctx = makeCtx({ queryResponse: doneResponse([frame]) });

    const overlay = responseMetaRows(ctx);

    expect(overlay.severity).toBe('warning');
    expect(overlay.rows).toContainEqual({ label: 'Limit', value: 'Reached (1 K)' });
  });

  it('does not flag a frame under its limit', () => {
    const frame = { refId: 'A', length: 5, meta: { limit: 1000 } } as unknown as DataFrame;
    const ctx = makeCtx({ queryResponse: doneResponse([frame]) });

    expect(responseMetaRows(ctx).rows).not.toContainEqual(expect.objectContaining({ label: 'Limit' }));
  });

  it('surfaces backend notices and raises severity to match', () => {
    const frame = {
      refId: 'A',
      length: 0,
      meta: { notices: [{ severity: 'warning', text: 'Results are sampled.' }] },
    } as unknown as DataFrame;
    const ctx = makeCtx({ queryResponse: doneResponse([frame]) });

    const overlay = responseMetaRows(ctx);

    expect(overlay.severity).toBe('warning');
    expect(overlay.rows).toContainEqual({ label: 'Warning', value: 'Results are sampled.' });
  });

  it('surfaces an error for this refId with its trace id, forcing error severity', () => {
    const ctx = makeCtx({
      queryResponse: doneResponse([], {
        errors: [{ refId: 'A', message: 'upstream timeout', traceId: 'trace-123' }],
      }),
    });

    const overlay = responseMetaRows(ctx);

    expect(overlay.severity).toBe('error');
    expect(overlay.rows).toContainEqual({ label: 'Error', value: 'upstream timeout' });
    expect(overlay.rows).toContainEqual({ label: 'Trace ID', value: 'trace-123' });
  });

  it('ignores an error that belongs to a different refId', () => {
    const ctx = makeCtx({
      queryResponse: doneResponse([], { errors: [{ refId: 'B', message: 'other query failed' }] }),
    });

    const overlay = responseMetaRows(ctx);

    expect(overlay.severity).toBeUndefined();
    expect(overlay.rows).toEqual([]);
  });

  it('falls back to a response-level trace id when there is no error', () => {
    const ctx = makeCtx({ queryResponse: doneResponse([], { traceIds: ['trace-456'] }) });

    expect(responseMetaRows(ctx).rows).toContainEqual({ label: 'Trace ID', value: 'trace-456' });
  });

  it('returns nothing for a plain, successful response', () => {
    const ctx = makeCtx({ queryResponse: doneResponse([{ refId: 'A', length: 3 } as DataFrame]) });

    expect(responseMetaRows(ctx)).toEqual({ rows: [], severity: undefined });
  });
});
