import { deduplicatedRowsSelector } from './selectors';
import { LogLevel, LogsDedupStrategy } from '@grafana/data';
import { ExploreItemState } from 'app/types';

const state: any = {
  logsResult: {
    rows: [
      {
        entry: '2019-03-05T11:00:56Z sntpc sntpc[1]: offset=-0.033938, delay=0.000649',
        logLevel: LogLevel.debug,
      },
      {
        entry: '2019-03-05T11:00:26Z sntpc sntpc[1]: offset=-0.033730, delay=0.000581',
        logLevel: LogLevel.debug,
      },
      {
        entry: '2019-03-05T10:59:56Z sntpc sntpc[1]: offset=-0.034184, delay=0.001089',
        logLevel: LogLevel.debug,
      },
      {
        entry: '2019-03-05T10:59:26Z sntpc sntpc[1]: offset=-0.033972, delay=0.000582',
        logLevel: LogLevel.debug,
      },
      {
        entry: '2019-03-05T10:58:56Z sntpc sntpc[1]: offset=-0.033955, delay=0.000606',
        logLevel: LogLevel.debug,
      },
      {
        entry: '2019-03-05T10:58:26Z sntpc sntpc[1]: offset=-0.034067, delay=0.000616',
        logLevel: LogLevel.debug,
      },
      {
        entry: '2019-03-05T10:57:56Z sntpc sntpc[1]: offset=-0.034155, delay=0.001021',
        logLevel: LogLevel.debug,
      },
      {
        entry: '2019-03-05T10:57:26Z sntpc sntpc[1]: offset=-0.035797, delay=0.000883',
        logLevel: LogLevel.debug,
      },
      {
        entry: '2019-03-05T10:56:56Z sntpc sntpc[1]: offset=-0.046818, delay=0.000605',
        logLevel: LogLevel.debug,
      },
      {
        entry: '2019-03-05T10:56:26Z sntpc sntpc[1]: offset=-0.049200, delay=0.000584',
        logLevel: LogLevel.error,
      },
      {
        entry:
          '2019-11-01T14:53:02Z lifecycle-server time="2019-11-01T14:53:02.563571300Z" level=debug msg="Calling GET /v1.30/containers/c8defad4025e23f503d91b66610f93b5380622c8e871b31a71e29ff0e67653e7/stats?stream=0"',
        logLevel: LogLevel.trace,
      },
    ],
  },
  hiddenLogLevels: undefined,
  dedupStrategy: LogsDedupStrategy.none,
};

describe('Deduplication selector', () => {
  it('returns the same rows if no deduplication', () => {
    const dedups = deduplicatedRowsSelector(state as ExploreItemState);
    expect(dedups?.length).toBe(11);
    expect(dedups).toBe(state.logsResult.rows);
  });

  it('should correctly extracts rows and deduplicates them', () => {
    const dedups = deduplicatedRowsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.numbers,
    } as ExploreItemState);
    expect(dedups?.length).toBe(2);
    expect(dedups).not.toBe(state.logsResult.rows);
  });

  it('should filter out log levels', () => {
    let dedups = deduplicatedRowsSelector({
      ...state,
      hiddenLogLevels: [LogLevel.debug],
    } as ExploreItemState);
    expect(dedups?.length).toBe(2);
    expect(dedups).not.toBe(state.logsResult.rows);

    dedups = deduplicatedRowsSelector({
      ...state,
      dedupStrategy: LogsDedupStrategy.numbers,
      hiddenLogLevels: [LogLevel.debug],
    } as ExploreItemState);

    expect(dedups?.length).toBe(2);
    expect(dedups).not.toBe(state.logsResult.rows);
  });
});
