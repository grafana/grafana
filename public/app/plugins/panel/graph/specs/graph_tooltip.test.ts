jest.mock('app/core/core', () => ({}));

import $ from 'jquery';
import GraphTooltip from '../graph_tooltip';

const scope = {
  appEvent: jest.fn(),
  onAppEvent: jest.fn(),
  ctrl: {},
};

const elem = $('<div></div>');
const dashboard = {};
const getSeriesFn = () => {};

function describeSharedTooltip(desc, fn) {
  const ctx: any = {};
  ctx.ctrl = scope.ctrl;
  ctx.ctrl.panel = {
    tooltip: {
      shared: true,
    },
    legend: {},
    stack: false,
  };

  ctx.setup = setupFn => {
    ctx.setupFn = setupFn;
  };

  describe(desc, () => {
    beforeEach(() => {
      ctx.setupFn();
      const tooltip = new GraphTooltip(elem, dashboard, scope, getSeriesFn);
      ctx.results = tooltip.getMultiSeriesPlotHoverInfo(ctx.data, ctx.pos);
    });

    fn(ctx);
  });
}

describe('findHoverIndexFromData', () => {
  const tooltip = new GraphTooltip(elem, dashboard, scope, getSeriesFn);
  const series = {
    data: [[100, 0], [101, 0], [102, 0], [103, 0], [104, 0], [105, 0], [106, 0], [107, 0]],
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

describeSharedTooltip('steppedLine false, stack false', ctx => {
  ctx.setup(() => {
    ctx.data = [
      { data: [[10, 15], [12, 20]], lines: {}, hideTooltip: false },
      { data: [[10, 2], [12, 3]], lines: {}, hideTooltip: false },
    ];
    ctx.pos = { x: 11 };
  });

  it('should return 2 series', () => {
    expect(ctx.results.length).toBe(2);
  });

  it('should add time to results array', () => {
    expect(ctx.results.time).toBe(10);
  });

  it('should set value and hoverIndex', () => {
    expect(ctx.results[0].value).toBe(15);
    expect(ctx.results[1].value).toBe(2);
    expect(ctx.results[0].hoverIndex).toBe(0);
  });
});

describeSharedTooltip('one series is hidden', ctx => {
  ctx.setup(() => {
    ctx.data = [{ data: [[10, 15], [12, 20]] }, { data: [] }];
    ctx.pos = { x: 11 };
  });
});

describeSharedTooltip('steppedLine false, stack true, individual false', ctx => {
  ctx.setup(() => {
    ctx.data = [
      {
        data: [[10, 15], [12, 20]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 15], [12, 20]],
        },
        stack: true,
        hideTooltip: false,
      },
      {
        data: [[10, 2], [12, 3]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 2], [12, 3]],
        },
        stack: true,
        hideTooltip: false,
      },
    ];
    ctx.ctrl.panel.stack = true;
    ctx.pos = { x: 11 };
  });

  it('should show stacked value', () => {
    expect(ctx.results[1].value).toBe(17);
  });
});

describeSharedTooltip('steppedLine false, stack true, individual false, series stack false', ctx => {
  ctx.setup(() => {
    ctx.data = [
      {
        data: [[10, 15], [12, 20]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 15], [12, 20]],
        },
        stack: true,
        hideTooltip: false,
      },
      {
        data: [[10, 2], [12, 3]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 2], [12, 3]],
        },
        stack: false,
        hideTooltip: false,
      },
    ];
    ctx.ctrl.panel.stack = true;
    ctx.pos = { x: 11 };
  });

  it('should not show stacked value', () => {
    expect(ctx.results[1].value).toBe(2);
  });
});

describeSharedTooltip('steppedLine false, stack true, individual true', ctx => {
  ctx.setup(() => {
    ctx.data = [
      {
        data: [[10, 15], [12, 20]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 15], [12, 20]],
        },
        stack: true,
        hideTooltip: false,
      },
      {
        data: [[10, 2], [12, 3]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 2], [12, 3]],
        },
        stack: false,
        hideTooltip: false,
      },
    ];
    ctx.ctrl.panel.stack = true;
    ctx.ctrl.panel.tooltip.value_type = 'individual';
    ctx.pos = { x: 11 };
  });

  it('should not show stacked value', () => {
    expect(ctx.results[1].value).toBe(2);
  });
});
