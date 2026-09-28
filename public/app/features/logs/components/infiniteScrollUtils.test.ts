import { dateTime, rangeUtil, type DataQuery } from '@grafana/data';
import { LogsSortOrder } from '@grafana/schema';

import {
  canScrollBottom,
  canScrollTop,
  getVisibleRange,
  withLokiInfiniteScrollBound,
} from './infiniteScrollUtils';
import { createLogRow } from './mocks/logRow';

const timeZone = 'utc';
const currentRange = rangeUtil.convertRawToRange({
  from: dateTime(1_000),
  to: dateTime(100_000),
});

// Same millisecond on the first two rows. Array order and timeEpochMs both put the later line first.
const rows = [
  createLogRow({ uid: 'later-in-ms', timeEpochMs: 20_000, timeEpochNs: '20000000050' }),
  createLogRow({ uid: 'earlier-in-ms', timeEpochMs: 20_000, timeEpochNs: '20000000010' }),
  createLogRow({ uid: 'newest', timeEpochMs: 40_000, timeEpochNs: '40000000000' }),
];

describe('getVisibleRange', () => {
  it('keeps the millisecond window and picks oldest and newest by nanoseconds', () => {
    expect(getVisibleRange(rows)).toEqual({
      from: 20_000,
      to: 40_000,
      oldestNs: '20000000010',
      newestNs: '40000000000',
    });
  });
});

describe('canScrollBottom', () => {
  it('sets an exclusive endNs when loading older logs and leaves startNs unset', () => {
    expect(canScrollBottom(getVisibleRange(rows), currentRange, timeZone, LogsSortOrder.Descending)).toEqual({
      from: 1_000,
      to: 20_000,
      endNs: '20000000010',
    });
  });

  it('sets startNs to the newest line when loading newer logs', () => {
    expect(canScrollBottom(getVisibleRange(rows), currentRange, timeZone, LogsSortOrder.Ascending)).toEqual({
      from: 40_000,
      to: 100_000,
      startNs: '40000000000',
    });
  });
});

describe('canScrollTop', () => {
  it('sets startNs when descending logs scroll toward newer lines', () => {
    expect(canScrollTop(getVisibleRange(rows), currentRange, timeZone, LogsSortOrder.Descending)).toEqual({
      from: 40_000,
      to: 100_000,
      startNs: '40000000000',
    });
  });

  it('sets endNs when ascending logs scroll toward older lines', () => {
    expect(canScrollTop(getVisibleRange(rows), currentRange, timeZone, LogsSortOrder.Ascending)).toEqual({
      from: 1_000,
      to: 20_000,
      endNs: '20000000010',
    });
  });
});

describe('withLokiInfiniteScrollBound', () => {
  const lokiQuery: DataQuery = { refId: 'A', datasource: { type: 'loki', uid: 'loki' } };

  it('copies endNs onto a Loki query and omits startNs', () => {
    expect(withLokiInfiniteScrollBound(lokiQuery, { from: 1, to: 2, endNs: '20000000010' })).toEqual({
      refId: 'A',
      datasource: { type: 'loki', uid: 'loki' },
      endNs: '20000000010',
    });
  });

  it('copies startNs onto a Loki query and omits endNs', () => {
    expect(
      withLokiInfiniteScrollBound(
        { refId: 'A' },
        { from: 1, to: 2, startNs: '40000000000' },
        'loki'
      )
    ).toEqual({
      refId: 'A',
      startNs: '40000000000',
    });
  });

  it('leaves a non-Loki query unchanged', () => {
    const query: DataQuery = { refId: 'B', datasource: { type: 'loki-not', uid: 'other' } };
    expect(withLokiInfiniteScrollBound(query, { from: 1, to: 2, endNs: '20000000010' })).toBe(query);
  });
});
