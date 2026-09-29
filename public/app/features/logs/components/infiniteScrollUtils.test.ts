import { dateTime, rangeUtil, type DataQuery } from '@grafana/data';
import { LogsSortOrder } from '@grafana/schema';

import { canScrollBottom, canScrollTop, getVisibleRange, withLokiNsBound } from './infiniteScrollUtils';
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
      startNs: '40000000001',
    });
  });
});

describe('canScrollTop', () => {
  it('sets startNs when descending logs scroll toward newer lines', () => {
    expect(canScrollTop(getVisibleRange(rows), currentRange, timeZone, LogsSortOrder.Descending)).toEqual({
      from: 40_000,
      to: 100_000,
      startNs: '40000000001',
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

describe('scrolling within one millisecond', () => {
  const range = rangeUtil.convertRawToRange({ from: dateTime(20_000), to: dateTime(20_001) });
  const visible = { from: 20_000, to: 20_000, oldestNs: '20000000010', newestNs: '20000000050' };

  it.each([LogsSortOrder.Ascending, LogsSortOrder.Descending])('loads remaining logs in %s order', (order) => {
    const older = { from: 20_000, to: 20_000, endNs: '20000000010' };
    const newer = { from: 20_000, to: 20_001, startNs: '20000000051' };
    expect(canScrollTop(visible, range, timeZone, order)).toEqual(order === LogsSortOrder.Ascending ? older : newer);
    expect(canScrollBottom(visible, range, timeZone, order)).toEqual(order === LogsSortOrder.Ascending ? newer : older);
  });

  it.each([LogsSortOrder.Ascending, LogsSortOrder.Descending])('stops at the exact bounds in %s order', (order) => {
    const complete = { ...visible, oldestNs: '20000000000', newestNs: '20000999999' };
    expect(canScrollTop(complete, range, timeZone, order)).toBeUndefined();
    expect(canScrollBottom(complete, range, timeZone, order)).toBeUndefined();
  });
});

describe('withLokiNsBound', () => {
  it.each([
    [{ startNs: '1500000125' }, { startNs: '1500000125' }],
    [{ endNs: '1500000100' }, { endNs: '1500000100' }],
  ])('replaces shared bounds when paginating in either direction: %j', (bound, expected) => {
    expect(
      withLokiNsBound(
        { refId: 'A', startNs: '1000000000', endNs: '1500000124' },
        { from: 1000, to: 2000, ...bound },
        'loki'
      )
    ).toEqual({ refId: 'A', ...expected });
  });
  const lokiQuery: DataQuery = { refId: 'A', datasource: { type: 'loki', uid: 'loki' } };

  it('copies endNs onto a Loki query and omits startNs', () => {
    expect(withLokiNsBound(lokiQuery, { from: 1, to: 2, endNs: '20000000010' })).toEqual({
      refId: 'A',
      datasource: { type: 'loki', uid: 'loki' },
      endNs: '20000000010',
    });
  });

  it('copies startNs onto a Loki query and omits endNs', () => {
    expect(withLokiNsBound({ refId: 'A' }, { from: 1, to: 2, startNs: '40000000000' }, 'loki')).toEqual({
      refId: 'A',
      startNs: '40000000000',
    });
  });

  it('leaves a non-Loki query unchanged', () => {
    const query: DataQuery = { refId: 'B', datasource: { type: 'loki-not', uid: 'other' } };
    expect(withLokiNsBound(query, { from: 1, to: 2, endNs: '20000000010' })).toBe(query);
  });
});
