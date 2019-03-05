import { deduplicatedLogsSelector } from './selectors';
import { LogsDedupStrategy } from 'app/core/logs_model';
import { ExploreItemState } from 'app/types';

const state = {
  logsResult: {
    rows: [
      {
        entry: '2019-03-05T11:00:56Z sntpc sntpc[1]: offset=-0.033938, delay=0.000649',
      },
      {
        entry: '2019-03-05T11:00:26Z sntpc sntpc[1]: offset=-0.033730, delay=0.000581',
      },
      {
        entry: '2019-03-05T10:59:56Z sntpc sntpc[1]: offset=-0.034184, delay=0.001089',
      },
      {
        entry: '2019-03-05T10:59:26Z sntpc sntpc[1]: offset=-0.033972, delay=0.000582',
      },
      {
        entry: '2019-03-05T10:58:56Z sntpc sntpc[1]: offset=-0.033955, delay=0.000606',
      },
      {
        entry: '2019-03-05T10:58:26Z sntpc sntpc[1]: offset=-0.034067, delay=0.000616',
      },
      {
        entry: '2019-03-05T10:57:56Z sntpc sntpc[1]: offset=-0.034155, delay=0.001021',
      },
      {
        entry: '2019-03-05T10:57:26Z sntpc sntpc[1]: offset=-0.035797, delay=0.000883',
      },
      {
        entry: '2019-03-05T10:56:56Z sntpc sntpc[1]: offset=-0.046818, delay=0.000605',
      },
      {
        entry: '2019-03-05T10:56:26Z sntpc sntpc[1]: offset=-0.049200, delay=0.000584',
      },
    ],
  },
  hiddenLogLevels: undefined,
  dedupStrategy: LogsDedupStrategy.none,
};

describe('Deduplication selector', () => {
  it('should correctly deduplicate log rows when changing strategy multiple times', () => {
    // Simulating sequence of UI actions that was causing a problem with deduplication counter being visible when unnecessary.
    // The sequence was changing dedup strategy: (none -> exact -> numbers -> signature -> none) *2 -> exact. After that the first
    // row contained information that was deduped, while it shouldn't be.
    // Problem was caused by mutating the log results entries in redux state. The memoisation hash for deduplicatedLogsSelector
    // was changing depending on duplicates information from log row state, while should be dependand on log row only.

    let dedups = deduplicatedLogsSelector(state as ExploreItemState);
    expect(dedups.rows.length).toBe(10);

    deduplicatedLogsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.none,
    } as ExploreItemState);

    deduplicatedLogsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.exact,
    } as ExploreItemState);

    deduplicatedLogsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.numbers,
    } as ExploreItemState);

    deduplicatedLogsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.signature,
    } as ExploreItemState);

    deduplicatedLogsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.none,
    } as ExploreItemState);

    deduplicatedLogsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.exact,
    } as ExploreItemState);

    deduplicatedLogsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.numbers,
    } as ExploreItemState);

    deduplicatedLogsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.signature,
    } as ExploreItemState);

    deduplicatedLogsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.none,
    } as ExploreItemState);

    dedups = deduplicatedLogsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.exact,
    } as ExploreItemState);

    // Expecting that no row has duplicates now
    expect(dedups.rows.reduce((acc, row) => acc + row.duplicates, 0)).toBe(0);
  });
});
