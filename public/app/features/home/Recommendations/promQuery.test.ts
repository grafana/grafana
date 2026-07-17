import { NEVER, of } from 'rxjs';

import { createDataFrame, type DataFrame, FieldType, LoadingState, type PanelData } from '@grafana/data';
import { createQueryRunner } from '@grafana/runtime';

import { readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  createQueryRunner: jest.fn(),
}));

const mockCreateQueryRunner = jest.mocked(createQueryRunner);

const run = jest.fn();
const destroy = jest.fn();

function setRunnerResult(series: DataFrame[], state = LoadingState.Done) {
  const data = { state, series, timeRange: {} } as PanelData;
  mockCreateQueryRunner.mockReturnValue({ run, get: () => of(data), cancel: jest.fn(), destroy });
}

function numberFrame(refId: string, values: number[]): DataFrame {
  return createDataFrame({
    refId,
    fields: [{ name: 'Value', type: FieldType.number, values }],
  });
}

function seriesFrame(refId: string, times: number[], values: number[]): DataFrame {
  return createDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: times },
      { name: 'Value', type: FieldType.number, values },
    ],
  });
}

beforeEach(() => {
  run.mockReset();
  destroy.mockReset();
  mockCreateQueryRunner.mockClear();
  setRunnerResult([]);
});

afterEach(() => jest.restoreAllMocks());

describe('readScalar', () => {
  it('returns the last finite value of the matching frame', () => {
    expect(readScalar([numberFrame('A', [1, 2, 3])], 'A')).toBe(3);
  });

  it('returns null when no frame matches the refId', () => {
    expect(readScalar([numberFrame('A', [1, 2, 3])], 'B')).toBeNull();
  });

  it('returns null when the matching frame is empty', () => {
    expect(readScalar([numberFrame('A', [])], 'A')).toBeNull();
  });

  it('returns null when the last value is not finite', () => {
    expect(readScalar([numberFrame('A', [1, Infinity])], 'A')).toBeNull();
  });
});

describe('readSeries', () => {
  it('returns aligned {x, y} for a multi-point series', () => {
    const series = readSeries([seriesFrame('cpu', [0, 1000, 2000], [1, 2, 3])], 'cpu');

    expect(series).not.toBeNull();
    expect(series!.x!.values).toEqual([0, 1000, 2000]);
    expect(series!.y!.values).toEqual([1, 2, 3]);
  });

  it('returns null for a single-point frame (not a real series)', () => {
    expect(readSeries([seriesFrame('cpu', [0], [5])], 'cpu')).toBeNull();
  });

  it('returns null when the time and value fields have different lengths', () => {
    expect(readSeries([seriesFrame('cpu', [0, 1000, 2000], [1, 2])], 'cpu')).toBeNull();
  });

  it('returns null when no frame matches the refId', () => {
    expect(readSeries([seriesFrame('other', [0, 1000], [1, 2])], 'cpu')).toBeNull();
  });
});

describe('runInstantQueries', () => {
  it('runs one instant target per refId against the given datasource and returns the frames', async () => {
    setRunnerResult([numberFrame('A', [42]), numberFrame('B', [7])]);

    const frames = await runInstantQueries({ A: 'up', B: 'count(up)' }, { uid: 'prom-default', type: 'prometheus' });

    const options = run.mock.calls[0][0];
    expect(options.datasource).toEqual({ uid: 'prom-default', type: 'prometheus' });
    expect(options.queries).toEqual([
      { refId: 'A', expr: 'up', instant: true, range: false },
      { refId: 'B', expr: 'count(up)', instant: true, range: false },
    ]);
    expect(readScalar(frames, 'A')).toBe(42);
    expect(readScalar(frames, 'B')).toBe(7);
    expect(destroy).toHaveBeenCalled();
  });

  it('throws (and still destroys the runner) when the query errors', async () => {
    setRunnerResult([], LoadingState.Error);

    await expect(runInstantQueries({ A: 'up' }, { uid: 'prom', type: 'prometheus' })).rejects.toThrow(
      'Prometheus query failed'
    );
    expect(destroy).toHaveBeenCalled();
  });

  it('rejects (and still destroys the runner) when the runner never reaches a terminal state', async () => {
    jest.useFakeTimers();

    try {
      mockCreateQueryRunner.mockReturnValue({ run, get: () => NEVER, cancel: jest.fn(), destroy });

      // Attach the rejection matcher before advancing so the TimeoutError is never unhandled.
      const assertion = expect(runInstantQueries({ A: 'up' }, { uid: 'prom', type: 'prometheus' })).rejects.toThrow();

      jest.advanceTimersByTime(30_000);

      await assertion;
      expect(destroy).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('runRangeQuery', () => {
  it('runs a single range target over the last N hours with a stable step and parses the series', async () => {
    setRunnerResult([seriesFrame('cpu', [0, 1000, 2000], [1, 2, 3])]);

    const frames = await runRangeQuery('cpu', 'sum(rate(container_cpu_usage_seconds_total[5m]))', 24, {
      uid: 'prom',
      type: 'prometheus',
    });

    const options = run.mock.calls[0][0];
    expect(options.queries).toEqual([
      { refId: 'cpu', expr: 'sum(rate(container_cpu_usage_seconds_total[5m]))', instant: false, range: true },
    ]);
    expect(options.timeRange.raw).toEqual({ from: 'now-24h', to: 'now' });
    expect(options.maxDataPoints).toBe(60);

    const series = readSeries(frames, 'cpu');
    expect(series).not.toBeNull();
    expect(series!.y!.values).toEqual([1, 2, 3]);
  });
});
