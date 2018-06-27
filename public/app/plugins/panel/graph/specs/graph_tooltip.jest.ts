jest.mock('app/core/core', () => ({}));

import $ from 'jquery';
import GraphTooltip from '../graph_tooltip';

var scope = {
  appEvent: jest.fn(),
  onAppEvent: jest.fn(),
  ctrl: {},
};

var elem = $('<div></div>');
var dashboard = {};
var getSeriesFn;

function describeSharedTooltip(desc, fn) {
  var ctx: any = {};
  ctx.ctrl = scope.ctrl;
  ctx.ctrl.panel = {
    tooltip: {
      shared: true,
    },
    legend: {},
    stack: false,
  };

  ctx.setup = function(setupFn) {
    ctx.setupFn = setupFn;
  };

  describe(desc, function() {
    beforeEach(function() {
      ctx.setupFn();
      var tooltip = new GraphTooltip(elem, dashboard, scope, getSeriesFn);
      ctx.results = tooltip.getMultiSeriesPlotHoverInfo(ctx.data, ctx.pos);
    });

    fn(ctx);
  });
}

describe('findHoverIndexFromData', function() {
  var tooltip = new GraphTooltip(elem, dashboard, scope, getSeriesFn);
  var series = {
    data: [[100, 0], [101, 0], [102, 0], [103, 0], [104, 0], [105, 0], [106, 0], [107, 0]],
  };

  it('should return 0 if posX out of lower bounds', function() {
    var posX = 99;
    expect(tooltip.findHoverIndexFromData(posX, series)).toBe(0);
  });

  it('should return n - 1 if posX out of upper bounds', function() {
    var posX = 108;
    expect(tooltip.findHoverIndexFromData(posX, series)).toBe(series.data.length - 1);
  });

  it('should return i if posX in series', function() {
    var posX = 104;
    expect(tooltip.findHoverIndexFromData(posX, series)).toBe(4);
  });

  it('should return i if posX not in series and i + 1 > posX', function() {
    var posX = 104.9;
    expect(tooltip.findHoverIndexFromData(posX, series)).toBe(4);
  });
});

describeSharedTooltip('steppedLine false, stack false', function(ctx) {
  ctx.setup(function() {
    ctx.data = [{ data: [[10, 15], [12, 20]], lines: {} }, { data: [[10, 2], [12, 3]], lines: {} }];
    ctx.pos = { x: 11 };
  });

  it('should return 2 series', function() {
    expect(ctx.results.length).toBe(2);
  });

  it('should add time to results array', function() {
    expect(ctx.results.time).toBe(10);
  });

  it('should set value and hoverIndex', function() {
    expect(ctx.results[0].value).toBe(15);
    expect(ctx.results[1].value).toBe(2);
    expect(ctx.results[0].hoverIndex).toBe(0);
  });
});

describeSharedTooltip('one series is hidden', function(ctx) {
  ctx.setup(function() {
    ctx.data = [{ data: [[10, 15], [12, 20]] }, { data: [] }];
    ctx.pos = { x: 11 };
  });
});

describeSharedTooltip('steppedLine false, stack true, individual false', function(ctx) {
  ctx.setup(function() {
    ctx.data = [
      {
        data: [[10, 15], [12, 20]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 15], [12, 20]],
        },
        stack: true,
      },
      {
        data: [[10, 2], [12, 3]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 2], [12, 3]],
        },
        stack: true,
      },
    ];
    ctx.ctrl.panel.stack = true;
    ctx.pos = { x: 11 };
  });

  it('should show stacked value', function() {
    expect(ctx.results[1].value).toBe(17);
  });
});

describeSharedTooltip('steppedLine false, stack true, individual false, series stack false', function(ctx) {
  ctx.setup(function() {
    ctx.data = [
      {
        data: [[10, 15], [12, 20]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 15], [12, 20]],
        },
        stack: true,
      },
      {
        data: [[10, 2], [12, 3]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 2], [12, 3]],
        },
        stack: false,
      },
    ];
    ctx.ctrl.panel.stack = true;
    ctx.pos = { x: 11 };
  });

  it('should not show stacked value', function() {
    expect(ctx.results[1].value).toBe(2);
  });
});

describeSharedTooltip('steppedLine false, stack true, individual true', function(ctx) {
  ctx.setup(function() {
    ctx.data = [
      {
        data: [[10, 15], [12, 20]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 15], [12, 20]],
        },
        stack: true,
      },
      {
        data: [[10, 2], [12, 3]],
        lines: {},
        datapoints: {
          pointsize: 2,
          points: [[10, 2], [12, 3]],
        },
        stack: false,
      },
    ];
    ctx.ctrl.panel.stack = true;
    ctx.ctrl.panel.tooltip.value_type = 'individual';
    ctx.pos = { x: 11 };
  });

  it('should not show stacked value', function() {
    expect(ctx.results[1].value).toBe(2);
  });
});
