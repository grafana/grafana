define([
  'jquery',
  'app/panels/graph/graph.tooltip'
], function($, GraphTooltip) {
  'use strict';

  var scope =  {
    appEvent: sinon.spy(),
    onAppEvent: sinon.spy(),
  };

  var elem = $('<div></div>');
  var dashboard = { };

  function describeSharedTooltip(desc, fn) {
    var ctx = {};
    ctx.scope = scope;
    ctx.scope.panel =  {
      tooltip:  {
        shared: true
      },
      legend: { },
      stack: false
    };

    ctx.setup = function(setupFn) {
      ctx.setupFn = setupFn;
    };

    describe(desc, function() {
      beforeEach(function() {
        ctx.setupFn();
        var tooltip = new GraphTooltip(elem, dashboard, scope);
        ctx.results = tooltip.getMultiSeriesPlotHoverInfo(ctx.data, ctx.pos);
      });

      fn(ctx);
    });
  }

  describeSharedTooltip("steppedLine false, stack false", function(ctx) {
    ctx.setup(function() {
      ctx.data = [
        { data: [[10, 15], [12, 20]], lines: {} },
        { data: [[10, 2], [12, 3]], lines: {} }
      ];
      ctx.pos = { x: 11 };
    });

    it('should return 2 series', function() {
      expect(ctx.results.length).to.be(2);
    });
    it('should add time to results array', function() {
      expect(ctx.results.time).to.be(10);
    });
    it('should set value and hoverIndex', function() {
      expect(ctx.results[0].value).to.be(15);
      expect(ctx.results[1].value).to.be(2);
      expect(ctx.results[0].hoverIndex).to.be(0);
    });
  });

  describeSharedTooltip("one series is hidden", function(ctx) {
    ctx.setup(function() {
      ctx.data = [
        { data: [[10, 15], [12, 20]], },
        { data: [] }
      ];
      ctx.pos = { x: 11 };
    });
  });

  describeSharedTooltip("steppedLine false, stack true, individual false", function(ctx) {
    ctx.setup(function() {
      ctx.data = [
        {
          data: [[10, 15], [12, 20]],
          lines: {},
          datapoints: {
            pointsize: 2,
            points: [[10,15], [12,20]],
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
          stack: true
        }
      ];
      ctx.scope.panel.stack = true;
      ctx.pos = { x: 11 };
    });

    it('should show stacked value', function() {
      expect(ctx.results[1].value).to.be(17);
    });
  });

  describeSharedTooltip("steppedLine false, stack true, individual false, series stack false", function(ctx) {
    ctx.setup(function() {
      ctx.data = [
        {
          data: [[10, 15], [12, 20]],
          lines: {},
          datapoints: {
            pointsize: 2,
            points: [[10, 15], [12, 20]],
          },
          stack: true
        },
        {
          data: [[10, 2], [12, 3]],
          lines: {},
          datapoints: {
            pointsize: 2,
            points: [[10, 2], [12, 3]],
          },
          stack: false
        }
      ];
      ctx.scope.panel.stack = true;
      ctx.pos = { x: 11 };
    });

    it('should not show stacked value', function() {
      expect(ctx.results[1].value).to.be(2);
    });

  });

  describeSharedTooltip("steppedLine false, stack true, individual true", function(ctx) {
    ctx.setup(function() {
      ctx.data = [
        {
          data: [[10, 15], [12, 20]],
          lines: {},
          datapoints: {
            pointsize: 2,
            points: [[10, 15], [12, 20]],
          },
          stack: true
        },
        {
          data: [[10, 2], [12, 3]],
          lines: {},
          datapoints: {
            pointsize: 2,
            points: [[10, 2], [12, 3]],
          },
          stack: false
        }
      ];
      ctx.scope.panel.stack = true;
      ctx.scope.panel.tooltip.value_type = 'individual';
      ctx.pos = { x: 11 };
    });

    it('should not show stacked value', function() {
      expect(ctx.results[1].value).to.be(2);
    });

  });

});


