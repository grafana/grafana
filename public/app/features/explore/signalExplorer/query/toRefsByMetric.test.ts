import { toRefsByMetric } from './toRefsByMetric';

describe('toRefsByMetric', () => {
  it('inverts metrics-by-refId into refIds-by-metric', () => {
    expect(toRefsByMetric({ A: ['up', 'node_load1'], B: ['up'] })).toEqual({
      up: ['A', 'B'],
      node_load1: ['A'],
    });
  });

  it('returns an empty map for an empty input', () => {
    expect(toRefsByMetric({})).toEqual({});
  });

  it('keeps refIds in the order the queries were detected in', () => {
    expect(toRefsByMetric({ C: ['up'], A: ['up'], B: ['up'] }).up).toEqual(['C', 'A', 'B']);
  });

  it('ignores refIds that reference no known metric', () => {
    expect(toRefsByMetric({ A: [], B: ['up'] })).toEqual({ up: ['B'] });
  });
});
