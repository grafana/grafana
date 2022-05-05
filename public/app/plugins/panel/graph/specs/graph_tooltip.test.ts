jest.mock('app/core/core', () => ({}));

import $ from 'jquery';

import GraphTooltip from '../graph_tooltip';

const scope: any = {
  appEvent: jest.fn(),
  onAppEvent: jest.fn(),
  ctrl: {
    panel: {
      tooltip: {},
    },
  },
};

const elem = $('<div></div>');
const dashboard = {};
const getSeriesFn = () => {};

describe('findHoverIndexFromData', () => {
  // @ts-ignore
  const tooltip = new GraphTooltip(elem, dashboard, scope, getSeriesFn);
  const series = {
    data: [
      [100, 0],
      [101, 0],
      [102, 0],
      [103, 0],
      [104, 0],
      [105, 0],
      [106, 0],
      [107, 0],
    ],
  };

  it('should return 0 if posX out of lower bounds', () => {
    const posX = 99;
    expect(tooltip.findHoverIndexFromData(posX, series)).toBe(0);
  });

  it('should return n - 1 if posX out of upper bounds', () => {
    const posX = 108;
    expect(tooltip.findHoverIndexFromData(posX, series)).toBe(series.data.length - 1);
  });

  it('should return i if posX in series', () => {
    const posX = 104;
    expect(tooltip.findHoverIndexFromData(posX, series)).toBe(4);
  });

  it('should return i if posX not in series and i + 1 > posX', () => {
    const posX = 104.9;
    expect(tooltip.findHoverIndexFromData(posX, series)).toBe(4);
  });
});

describe('with a shared tooltip', () => {
  beforeEach(() => {
    scope.ctrl.panel = {
      tooltip: {
        shared: true,
      },
      legend: {},
      stack: false,
    };
  });

  describe('steppedLine false, stack false', () => {
    const data = [
      {
        data: [
          [10, 15],
          [12, 20],
        ],
        lines: {},
        hideTooltip: false,
      },
      {
        data: [
          [10, 2],
          [12, 3],
        ],
        lines: {},
        hideTooltip: false,
      },
    ];
    const pos = { x: 11 };

    it('should return 2 series', () => {
      // @ts-ignore
      const tooltip = new GraphTooltip(elem, dashboard, scope, getSeriesFn);
      const results = tooltip.getMultiSeriesPlotHoverInfo(data, pos);
      expect(results.length).toBe(2);
    });

    it('should add time to results array', () => {
      // @ts-ignore
      const tooltip = new GraphTooltip(elem, dashboard, scope, getSeriesFn);
      const results = tooltip.getMultiSeriesPlotHoverInfo(data, pos);
      expect(results.time).toBe(10);
    });

    it('should set value and hoverIndex', () => {
      // @ts-ignore
      const tooltip = new GraphTooltip(elem, dashboard, scope, getSeriesFn);
      const results = tooltip.getMultiSeriesPlotHoverInfo(data, pos);
      expect(results[0].value).toBe(15);
      expect(results[1].value).toBe(2);
      expect(results[0].hoverIndex).toBe(0);
    });
  });

  describe('steppedLine false, stack true, individual false', () => {
    const data = [
      {
        data: [
          [10, 15],
          [12, 20],
        ],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [
            [10, 15],
            [12, 20],
          ],
        },
        stack: true,
        hideTooltip: false,
      },
      {
        data: [
          [10, 2],
          [12, 3],
        ],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [
            [10, 2],
            [12, 3],
          ],
        },
        stack: true,
        hideTooltip: false,
      },
    ];
    scope.ctrl.panel.stack = true;
    const pos = { x: 11 };

    it('should show stacked value', () => {
      // @ts-ignore
      const tooltip = new GraphTooltip(elem, dashboard, scope, getSeriesFn);
      const results = tooltip.getMultiSeriesPlotHoverInfo(data, pos);
      expect(results[1].value).toBe(17);
    });
  });

  describe('steppedLine false, stack true, individual false, series stack false', () => {
    const data = [
      {
        data: [
          [10, 15],
          [12, 20],
        ],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [
            [10, 15],
            [12, 20],
          ],
        },
        stack: true,
        hideTooltip: false,
      },
      {
        data: [
          [10, 2],
          [12, 3],
        ],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [
            [10, 2],
            [12, 3],
          ],
        },
        stack: false,
        hideTooltip: false,
      },
    ];
    scope.ctrl.panel.stack = true;
    const pos = { x: 11 };

    it('should not show stacked value', () => {
      // @ts-ignore
      const tooltip = new GraphTooltip(elem, dashboard, scope, getSeriesFn);
      const results = tooltip.getMultiSeriesPlotHoverInfo(data, pos);
      expect(results[1].value).toBe(2);
    });
  });

  describe('steppedLine false, stack true, individual true', () => {
    const data = [
      {
        data: [
          [10, 15],
          [12, 20],
        ],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [
            [10, 15],
            [12, 20],
          ],
        },
        stack: true,
        hideTooltip: false,
      },
      {
        data: [
          [10, 2],
          [12, 3],
        ],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [
            [10, 2],
            [12, 3],
          ],
        },
        stack: false,
        hideTooltip: false,
      },
    ];
    scope.ctrl.panel.stack = true;
    scope.ctrl.panel.tooltip.value_type = 'individual';
    const pos = { x: 11 };

    it('should not show stacked value', () => {
      // @ts-ignore
      const tooltip = new GraphTooltip(elem, dashboard, scope, getSeriesFn);
      const results = tooltip.getMultiSeriesPlotHoverInfo(data, pos);
      expect(results[1].value).toBe(2);
    });
  });
});
