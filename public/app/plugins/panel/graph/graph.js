define([
  'angular',
  'jquery',
  'moment',
  'lodash',
  'app/core/utils/kbn',
  './graph_tooltip',
  'jquery.flot',
  'jquery.flot.selection',
  'jquery.flot.time',
  'jquery.flot.stack',
  'jquery.flot.stackpercent',
  'jquery.flot.fillbelow',
  'jquery.flot.crosshair',
  './jquery.flot.events',
],
function (angular, $, moment, _, kbn, GraphTooltip) {
  'use strict';

  var module = angular.module('grafana.directives');
  var labelWidthCache = {};

  module.directive('grafanaGraph', function($rootScope, timeSrv) {
    return {
      restrict: 'A',
      template: '<div> </div>',
      link: function(scope, elem) {
        var ctrl = scope.ctrl;
        var dashboard = ctrl.dashboard;
        var panel = ctrl.panel;
        var data, annotations;
        var sortedSeries;
        var legendSideLastValue = null;
        var rootScope = scope.$root;
        var panelWidth = 0;

        rootScope.onAppEvent('setCrosshair', function(event, info) {
          // do not need to to this if event is from this panel
          if (info.scope === scope) {
            return;
          }

          if(dashboard.sharedCrosshair) {
            var plot = elem.data().plot;
            if (plot) {
              plot.setCrosshair({ x: info.pos.x, y: info.pos.y });
            }
          }
        }, scope);

        rootScope.onAppEvent('clearCrosshair', function() {
          var plot = elem.data().plot;
          if (plot) {
            plot.clearCrosshair();
          }
        }, scope);

        // Receive render events
        ctrl.events.on('render', function(renderData) {
          data = renderData || data;
          if (!data) {
            ctrl.refresh();
            return;
          }
          annotations = data.annotations || annotations;
          render_panel();
        });

        function getLegendHeight(panelHeight) {
          if (!panel.legend.show || panel.legend.rightSide) {
            return 0;
          }

          if (panel.legend.alignAsTable) {
            var legendSeries = _.filter(data, function(series) {
              return series.hideFromLegend(panel.legend) === false;
            });
            var total = 23 + (21 * legendSeries.length);
            return Math.min(total, Math.floor(panelHeight/2));
          } else {
            return 26;
          }
        }

        function setElementHeight() {
          try {
            var height = ctrl.height - getLegendHeight(ctrl.height);
            elem.css('height', height + 'px');

            return true;
          } catch(e) { // IE throws errors sometimes
            console.log(e);
            return false;
          }
        }

        function shouldAbortRender() {
          if (!data) {
            return true;
          }

          if (!setElementHeight()) { return true; }

          if (panelWidth === 0) {
            return true;
          }
        }

        function getLabelWidth(text, elem) {
          var labelWidth = labelWidthCache[text];

          if (!labelWidth) {
            labelWidth = labelWidthCache[text] = elem.width();
          }

          return labelWidth;
        }

        function drawHook(plot) {
          // Update legend values
          var yaxis = plot.getYAxes();
          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            var axis = yaxis[series.yaxis - 1];
            var formater = kbn.valueFormats[panel.yaxes[series.yaxis - 1].format];

            // decimal override
            if (_.isNumber(panel.decimals)) {
              series.updateLegendValues(formater, panel.decimals, null);
            } else {
              // auto decimals
              // legend and tooltip gets one more decimal precision
              // than graph legend ticks
              var tickDecimals = (axis.tickDecimals || -1) + 1;
              series.updateLegendValues(formater, tickDecimals, axis.scaledDecimals + 2);
            }

            if(!rootScope.$$phase) { scope.$digest(); }
          }

          // add left axis labels
          if (panel.yaxes[0].label) {
            var yaxisLabel = $("<div class='axisLabel left-yaxis-label'></div>")
              .text(panel.yaxes[0].label)
              .appendTo(elem);

            yaxisLabel[0].style.marginTop = (getLabelWidth(panel.yaxes[0].label, yaxisLabel) / 2) + 'px';
          }

          // add right axis labels
          if (panel.yaxes[1].label) {
            var rightLabel = $("<div class='axisLabel right-yaxis-label'></div>")
              .text(panel.yaxes[1].label)
              .appendTo(elem);

            rightLabel[0].style.marginTop = (getLabelWidth(panel.yaxes[1].label, rightLabel) / 2) + 'px';
          }
        }

        function processOffsetHook(plot, gridMargin) {
          var left = panel.yaxes[0];
          var right = panel.yaxes[1];
          if (left.show && left.label) { gridMargin.left = 20; }
          if (right.show && right.label) { gridMargin.right = 20; }
        }

        // Function for rendering panel
        function render_panel() {
          panelWidth =  elem.width();

          if (shouldAbortRender()) {
            return;
          }

          var stack = panel.stack ? true : null;

          // Populate element
          var options = {
            hooks: {
              draw: [drawHook],
              processOffset: [processOffsetHook],
            },
            legend: { show: false },
            series: {
              stackpercent: panel.stack ? panel.percentage : false,
              stack: panel.percentage ? null : stack,
              lines:  {
                show: panel.lines,
                zero: false,
                fill: translateFillOption(panel.fill),
                lineWidth: panel.linewidth,
                steps: panel.steppedLine
              },
              bars:   {
                show: panel.bars,
                fill: 1,
                barWidth: 1,
                zero: false,
                lineWidth: 0
              },
              points: {
                show: panel.points,
                fill: 1,
                fillColor: false,
                radius: panel.points ? panel.pointradius : 2
              },
              shadowSize: 0
            },
            yaxes: [],
            xaxis: {},
            grid: {
              minBorderMargin: 0,
              markings: [],
              backgroundColor: null,
              borderWidth: 0,
              hoverable: true,
              color: '#c8c8c8',
              margin: { left: 0, right: 0 },
            },
            selection: {
              mode: "x",
              color: '#666'
            },
            crosshair: {
              mode: panel.tooltip.shared || dashboard.sharedCrosshair ? "x" : null
            }
          };

          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            series.data = series.getFlotPairs(series.nullPointMode || panel.nullPointMode);

            // if hidden remove points and disable stack
            if (ctrl.hiddenSeries[series.alias]) {
              series.data = [];
              series.stack = false;
            }
          }

          if (data.length && data[0].stats.timeStep) {
            options.series.bars.barWidth = data[0].stats.timeStep / 1.5;
          }

          addTimeAxis(options);
          addGridThresholds(options, panel);
          addAnnotations(options);
          configureAxisOptions(data, options);

          sortedSeries = _.sortBy(data, function(series) { return series.zindex; });

          function callPlot(incrementRenderCounter) {
            try {
              $.plot(elem, sortedSeries, options);
              if (ctrl.renderError) {
                delete ctrl.error;
                delete ctrl.inspector;
              }
            } catch (e) {
              console.log('flotcharts error', e);
              ctrl.error = e.message || "Render Error";
              ctrl.renderError = true;
              ctrl.inspector = {error: ctrl.error};
            }

            if (incrementRenderCounter) {
              ctrl.renderingCompleted();
            }
          }

          if (shouldDelayDraw(panel)) {
            // temp fix for legends on the side, need to render twice to get dimensions right
            callPlot(false);
            setTimeout(function() { callPlot(true); }, 50);
            legendSideLastValue = panel.legend.rightSide;
          }
          else {
            callPlot(true);
          }
        }

        function translateFillOption(fill) {
          return fill === 0 ? 0.001 : fill/10;
        }

        function shouldDelayDraw(panel) {
          if (panel.legend.rightSide) {
            return true;
          }
          if (legendSideLastValue !== null && panel.legend.rightSide !== legendSideLastValue) {
            return true;
          }
        }

        function addTimeAxis(options) {
          var ticks = panelWidth / 100;
          var min = _.isUndefined(ctrl.range.from) ? null : ctrl.range.from.valueOf();
          var max = _.isUndefined(ctrl.range.to) ? null : ctrl.range.to.valueOf();

          options.xaxis = {
            timezone: dashboard.getTimezone(),
            show: panel.xaxis.show,
            mode: "time",
            min: min,
            max: max,
            label: "Datetime",
            ticks: ticks,
            timeformat: time_format(ticks, min, max),
          };
        }

        function addGridThresholds(options, panel) {
          if (_.isNumber(panel.grid.threshold1)) {
            var limit1 = panel.grid.thresholdLine ? panel.grid.threshold1 : (panel.grid.threshold2 || null);
            options.grid.markings.push({
              yaxis: { from: panel.grid.threshold1, to: limit1 },
              color: panel.grid.threshold1Color
            });

            if (_.isNumber(panel.grid.threshold2)) {
              var limit2;
              if (panel.grid.thresholdLine) {
                limit2 = panel.grid.threshold2;
              } else {
                limit2 = panel.grid.threshold1 > panel.grid.threshold2 ?  -Infinity : +Infinity;
              }
              options.grid.markings.push({
                yaxis: { from: panel.grid.threshold2, to: limit2 },
                color: panel.grid.threshold2Color
              });
            }
          }
        }

        function addAnnotations(options) {
          if(!annotations || annotations.length === 0) {
            return;
          }

          var types = {};

          _.each(annotations, function(event) {
            if (!types[event.annotation.name]) {
              types[event.annotation.name] = {
                color: event.annotation.iconColor,
                position: 'BOTTOM',
                markerSize: 5,
              };
            }
          });

          options.events = {
            levels: _.keys(types).length + 1,
            data: annotations,
            types: types,
          };
        }

        function configureAxisOptions(data, options) {
          var defaults = {
            position: 'left',
            show: panel.yaxes[0].show,
            min: panel.yaxes[0].min,
            index: 1,
            logBase: panel.yaxes[0].logBase || 1,
            max: panel.percentage && panel.stack ? 100 : panel.yaxes[0].max,
          };

          options.yaxes.push(defaults);

          if (_.findWhere(data, {yaxis: 2})) {
            var secondY = _.clone(defaults);
            secondY.index = 2,
            secondY.show = panel.yaxes[1].show;
            secondY.logBase = panel.yaxes[1].logBase || 1,
            secondY.position = 'right';
            secondY.min = panel.yaxes[1].min;
            secondY.max = panel.percentage && panel.stack ? 100 : panel.yaxes[1].max;
            options.yaxes.push(secondY);

            applyLogScale(options.yaxes[1], data);
            configureAxisMode(options.yaxes[1], panel.percentage && panel.stack ? "percent" : panel.yaxes[1].format);
          }

          applyLogScale(options.yaxes[0], data);
          configureAxisMode(options.yaxes[0], panel.percentage && panel.stack ? "percent" : panel.yaxes[0].format);
        }

        function applyLogScale(axis, data) {
          if (axis.logBase === 1) {
            return;
          }

          var series, i;
          var max = axis.max;

          if (max === null) {
            for (i = 0; i < data.length; i++) {
              series = data[i];
              if (series.yaxis === axis.index) {
                if (max < series.stats.max) {
                  max = series.stats.max;
                }
              }
            }
            if (max === void 0) {
              max = Number.MAX_VALUE;
            }
          }

          axis.min = axis.min !== null ? axis.min : 0;
          axis.ticks = [0, 1];
          var nextTick = 1;

          while (true) {
            nextTick = nextTick * axis.logBase;
            axis.ticks.push(nextTick);
            if (nextTick > max) {
              break;
            }
          }

          if (axis.logBase === 10) {
            axis.transform = function(v) { return Math.log(v+0.1); };
            axis.inverseTransform  = function (v) { return Math.pow(10,v); };
          } else {
            axis.transform = function(v) { return Math.log(v+0.1) / Math.log(axis.logBase); };
            axis.inverseTransform  = function (v) { return Math.pow(axis.logBase,v); };
          }
        }

        function configureAxisMode(axis, format) {
          axis.tickFormatter = function(val, axis) {
            return kbn.valueFormats[format](val, axis.tickDecimals, axis.scaledDecimals);
          };
        }

        function time_format(ticks, min, max) {
          if (min && max && ticks) {
            var range = max - min;
            var secPerTick = (range/ticks) / 1000;
            var oneDay = 86400000;
            var oneYear = 31536000000;

            if (secPerTick <= 45) {
              return "%H:%M:%S";
            }
            if (secPerTick <= 7200 || range <= oneDay) {
              return "%H:%M";
            }
            if (secPerTick <= 80000) {
              return "%m/%d %H:%M";
            }
            if (secPerTick <= 2419200 || range <= oneYear) {
              return "%m/%d";
            }
            return "%Y-%m";
          }

          return "%H:%M";
        }

        new GraphTooltip(elem, dashboard, scope, function() {
          return sortedSeries;
        });

        elem.bind("plotselected", function (event, ranges) {
          scope.$apply(function() {
            timeSrv.setTime({
              from  : moment.utc(ranges.xaxis.from),
              to    : moment.utc(ranges.xaxis.to),
            });
          });
        });
      }
    };
  });
});
