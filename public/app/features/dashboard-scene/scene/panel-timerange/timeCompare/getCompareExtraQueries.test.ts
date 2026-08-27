import { dateTime, type DataQueryRequest, type TimeRange } from '@grafana/data';
import { type SceneDataQuery } from '@grafana/scenes';

import { getCompareExtraQueries, shouldRerunCompare } from './getCompareExtraQueries';

interface RequestOverrides {
  targets?: SceneDataQuery[];
  rangeRaw?: DataQueryRequest['rangeRaw'];
}

function makeRequest({ targets = [{ refId: 'A' }], rangeRaw }: RequestOverrides): DataQueryRequest {
  const range: TimeRange = {
    from: dateTime('2019-02-11T13:00:00.000Z'),
    to: dateTime('2019-02-11T19:00:00.000Z'),
    raw: { from: 'now-6h', to: 'now' },
  };

  return { targets, range, rangeRaw } as DataQueryRequest;
}

describe('getCompareExtraQueries', () => {
  it('should return no extra queries when compareWith is undefined', () => {
    expect(getCompareExtraQueries(makeRequest({}), undefined)).toEqual([]);
  });

  it('should return no extra queries when compareWith is an empty string', () => {
    expect(getCompareExtraQueries(makeRequest({}), '')).toEqual([]);
  });

  it('should shift the compare request range back by the compare offset', () => {
    const extraQueries = getCompareExtraQueries(makeRequest({}), '1d');

    expect(extraQueries).toHaveLength(1);
    expect(extraQueries[0].req.range.from.toISOString()).toBe('2019-02-10T13:00:00.000Z');
    expect(extraQueries[0].req.range.to.toISOString()).toBe('2019-02-10T19:00:00.000Z');
  });

  it('should give compare targets refIds distinct from the primary request', () => {
    const extraQueries = getCompareExtraQueries(makeRequest({ targets: [{ refId: 'A' }, { refId: 'C' }] }), '1d');

    expect(extraQueries[0].req.targets).toEqual([{ refId: 'A-compare' }, { refId: 'C-compare' }]);
  });

  it('should exclude targets that opted out via timeRangeCompare: false', () => {
    const extraQueries = getCompareExtraQueries(
      makeRequest({ targets: [{ refId: 'A' }, { refId: 'B', timeRangeCompare: false }, { refId: 'C' }] }),
      '1d'
    );

    expect(extraQueries[0].req.targets).toEqual([{ refId: 'A-compare' }, { refId: 'C-compare' }]);
  });

  it('should return no extra queries when every target opted out', () => {
    const extraQueries = getCompareExtraQueries(
      makeRequest({ targets: [{ refId: 'A', timeRangeCompare: false }] }),
      '1d'
    );

    expect(extraQueries).toEqual([]);
  });

  it('should set rangeRaw from the shifted compare range rather than inheriting the primary', () => {
    // Without this, spreading the primary request leaves rangeRaw.to as 'now', which makes
    // Prometheus incremental caching treat the compare query as cache-eligible.
    const extraQueries = getCompareExtraQueries(makeRequest({ rangeRaw: { from: 'now-6h', to: 'now' } }), '1d');

    expect(extraQueries[0].req.rangeRaw).toEqual({ from: 'now-6h-1d', to: 'now-1d' });
    expect(extraQueries[0].req.range.raw).toEqual({ from: 'now-6h-1d', to: 'now-1d' });
  });
});

describe('shouldRerunCompare', () => {
  it('should rerun when the compare offset changed and a query participates', () => {
    expect(shouldRerunCompare(undefined, '1d', [{ refId: 'A' }])).toBe(true);
  });

  it('should rerun when time comparison is turned off', () => {
    expect(shouldRerunCompare('1d', undefined, [{ refId: 'A' }])).toBe(true);
  });

  it('should not rerun when the compare offset is unchanged', () => {
    expect(shouldRerunCompare('1d', '1d', [{ refId: 'A' }])).toBe(false);
  });

  it('should not rerun when every query opted out of time comparison', () => {
    // No compare request would be produced, so rerunning would be wasted work.
    expect(shouldRerunCompare(undefined, '1d', [{ refId: 'A', timeRangeCompare: false }])).toBe(false);
  });
});
