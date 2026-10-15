import { type Field, FieldType } from '../types/dataFrame';

import { getSeriesTimeStep, hasMsResolution } from './series';

const timeField = <T>(values: T[]): Field<T> => ({
  name: 'time',
  type: FieldType.time,
  values,
  config: {},
});

describe('getSeriesTimeStep', () => {
  // The doc comment calls this the "minimal" time step, but `minTimeStep` is never assigned, so
  // the last step always wins. These rows pin what callers get today, not what the doc promises.
  it.each<{ desc: string; values: number[]; expected: number }>([
    { desc: 'every step is the same', values: [0, 100, 200, 300], expected: 100 },
    { desc: 'the smallest step happens to be the last one', values: [0, 100, 300, 350], expected: 50 },
    { desc: 'an earlier step is smaller than the last one', values: [0, 50, 200], expected: 150 },
    { desc: 'the timestamps descend, making the step negative', values: [300, 200, 0], expected: -200 },
  ])('returns the step between the final two timestamps when $desc', ({ values, expected }) => {
    expect(getSeriesTimeStep(timeField(values))).toBe(expected);
  });

  it.each<{ desc: string; values: number[] }>([
    { desc: 'the field is empty', values: [] },
    { desc: 'the field holds a single timestamp', values: [5] },
  ])('returns Number.MAX_VALUE when there is no step to measure because $desc', ({ values }) => {
    expect(getSeriesTimeStep(timeField(values))).toBe(Number.MAX_VALUE);
  });
});

describe('hasMsResolution', () => {
  it.each<{ desc: string; values: number[]; expected: boolean }>([
    { desc: 'a 13-digit timestamp that is not a whole number of seconds', values: [1572951685007], expected: true },
    { desc: 'a 13-digit timestamp landing exactly on a second', values: [1572951685000], expected: false },
    { desc: 'a 12-digit timestamp', values: [157295168500], expected: false },
    { desc: 'a 14-digit timestamp', values: [15729516850071], expected: false },
    { desc: 'only second-resolution timestamps', values: [0, 100, 200, 300], expected: false },
    {
      desc: 'one sub-second timestamp among second-resolution ones',
      values: [0, 1572951685007, 300, 350],
      expected: true,
    },
    { desc: 'a sub-second timestamp as the final value', values: [0, 100, 1572951685007], expected: true },
  ])('returns $expected for a field holding $desc', ({ values, expected }) => {
    expect(hasMsResolution(timeField(values))).toBe(expected);
  });

  it('skips gaps and keeps scanning for a sub-second timestamp behind them', () => {
    expect(hasMsResolution(timeField([null, undefined, 1572951685007]))).toBe(true);
  });

  it('returns false for a field of nothing but gaps', () => {
    expect(hasMsResolution(timeField([null, undefined]))).toBe(false);
  });
});
