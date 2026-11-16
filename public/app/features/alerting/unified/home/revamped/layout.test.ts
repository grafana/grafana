import { CHART_HEIGHT, withChartHeight } from './layout';

describe('withChartHeight', () => {
  it('replaces both the fixed and the minimum height of a chart, whatever it asked for', () => {
    const state: { height: number | string; minHeight: number } = { height: '400px', minHeight: 300 };
    const chart = {
      setState: (next: { height: number; minHeight: number }) => {
        Object.assign(state, next);
      },
    };

    expect(withChartHeight(chart)).toBe(chart);
    expect(state).toEqual({ height: 300, minHeight: 300 });
    expect(CHART_HEIGHT).toBe(300);
  });
});
