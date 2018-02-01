import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.stack';
import 'vendor/flot/jquery.flot.stackpercent';
import 'vendor/flot/jquery.flot.fillbelow';
import 'vendor/flot/jquery.flot.crosshair';
import 'vendor/flot/jquery.flot.dashes';
import './jquery.flot.events';

import $ from 'jquery';
import _ from 'lodash';
import moment from 'moment';
import kbn from 'app/core/utils/kbn';
import { tickStep } from 'app/core/utils/ticks';
import { appEvents, coreModule, updateLegendValues } from 'app/core/core';
import GraphTooltip from './graph_tooltip';
import { ThresholdManager } from './threshold_manager';
import { EventManager } from 'app/features/annotations/all';
import { convertValuesToHistogram, getSeriesValues } from './histogram';
import config from 'app/core/config';

/** @ngInject **/
function graphDirective(timeSrv, popoverSrv, contextSrv) {
  return {
    restrict: 'A',
    template: '',
    link: function(scope, elem) {
      var ctrl = scope.ctrl;
      var dashboard = ctrl.dashboard;
      var panel = ctrl.panel;
      var annotations = [];
      var data;
      var plot;
      var sortedSeries;
      var panelWidth = 0;
      var eventManager = new EventManager(ctrl);
      var thresholdManager = new ThresholdManager(ctrl);
      var tooltip = new GraphTooltip(elem, dashboard, scope, function() {
        return sortedSeries;
      });

      // panel events
      ctrl.events.on('panel-teardown', () => {
        thresholdManager = null;

        if (plot) {
          plot.destroy();
          plot = null;
        }
      });

      /**
       * Split graph rendering into two parts.
       * First, calculate series stats in buildFlotPairs() function. Then legend rendering started
       * (see ctrl.events.on('render') in legend.ts).
       * When legend is rendered it emits 'legend-rendering-complete' and graph rendered.
       */
      ctrl.events.on('render', renderData => {
        data = renderData || data;
        if (!data) {
          return;
        }
        annotations = ctrl.annotations || [];
        buildFlotPairs(data);
        updateLegendValues(data, panel);

        ctrl.events.emit('render-legend');
      });

      ctrl.events.on('legend-rendering-complete', () => {
        render_panel();
      });

      // global events
      appEvents.on(
        'graph-hover',
        evt => {
          // ignore other graph hover events if shared tooltip is disabled
          if (!dashboard.sharedTooltipModeEnabled()) {
            return;
          }

          // ignore if we are the emitter
          if (!plot || evt.panel.id === panel.id || ctrl.otherPanelInFullscreenMode()) {
            return;
          }

          tooltip.show(evt.pos);
        },
        scope
      );

      appEvents.on(
        'graph-hover-clear',
        (event, info) => {
          if (plot) {
            tooltip.clear(plot);
          }
        },
        scope
      );

      function shouldAbortRender() {
        if (!data) {
          return true;
        }

        if (panelWidth === 0) {
          return true;
        }

        return false;
      }

      function drawHook(plot) {
        // add left axis labels
        if (panel.yaxes[0].label && panel.yaxes[0].show) {
          $("<div class='axisLabel left-yaxis-label flot-temp-elem'></div>")
            .text(panel.yaxes[0].label)
            .appendTo(elem);
        }

        // add right axis labels
        if (panel.yaxes[1].label && panel.yaxes[1].show) {
          $("<div class='axisLabel right-yaxis-label flot-temp-elem'></div>")
            .text(panel.yaxes[1].label)
            .appendTo(elem);
        }

        if (ctrl.dataWarning) {
          $(`<div class="datapoints-warning flot-temp-elem">${ctrl.dataWarning.title}</div>`).appendTo(elem);
        }

        thresholdManager.draw(plot);
      }

      function processOffsetHook(plot, gridMargin) {
        var left = panel.yaxes[0];
        var right = panel.yaxes[1];
        if (left.show && left.label) {
          gridMargin.left = 20;
        }
        if (right.show && right.label) {
          gridMargin.right = 20;
        }

        // apply y-axis min/max options
        var yaxis = plot.getYAxes();
        for (var i = 0; i < yaxis.length; i++) {
          var axis = yaxis[i];
          var panelOptions = panel.yaxes[i];
          axis.options.max = axis.options.max !== null ? axis.options.max : panelOptions.max;
          axis.options.min = axis.options.min !== null ? axis.options.min : panelOptions.min;
        }
      }

      // Series could have different timeSteps,
      // let's find the smallest one so that bars are correctly rendered.
      // In addition, only take series which are rendered as bars for this.
      function getMinTimeStepOfSeries(data) {
        var min = Number.MAX_VALUE;

        for (let i = 0; i < data.length; i++) {
          if (!data[i].stats.timeStep) {
            continue;
          }
          if (panel.bars) {
            if (data[i].bars && data[i].bars.show === false) {
              continue;
            }
          } else {
            if (typeof data[i].bars === 'undefined' || typeof data[i].bars.show === 'undefined' || !data[i].bars.show) {
              continue;
            }
          }

          if (data[i].stats.timeStep < min) {
            min = data[i].stats.timeStep;
          }
        }

        return min;
      }

      // Function for rendering panel
      function render_panel() {
        panelWidth = elem.width();
        if (shouldAbortRender()) {
          return;
        }

        // give space to alert editing
        thresholdManager.prepare(elem, data);

        // un-check dashes if lines are unchecked
        panel.dashes = panel.lines ? panel.dashes : false;

        // Populate element
        let options: any = buildFlotOptions(panel);
        prepareXAxis(options, panel);
        configureYAxisOptions(data, options);
        thresholdManager.addFlotOptions(options, panel);
        eventManager.addFlotEvents(annotations, options);

        sortedSeries = sortSeries(data, panel);
        callPlot(options, true);
      }

      function buildFlotPairs(data) {
        for (let i = 0; i < data.length; i++) {
          let series = data[i];
          series.data = series.getFlotPairs(series.nullPointMode || panel.nullPointMode);

          // if hidden remove points and disable stack
          if (ctrl.hiddenSeries[series.alias]) {
            series.data = [];
            series.stack = false;
          }
        }
      }

      function prepareXAxis(options, panel) {
        switch (panel.xaxis.mode) {
          case 'series': {
            options.series.bars.barWidth = 0.7;
            options.series.bars.align = 'center';

            for (let i = 0; i < data.length; i++) {
              let series = data[i];
              series.data = [[i + 1, series.stats[panel.xaxis.values[0]]]];
            }

            addXSeriesAxis(options);
            break;
          }
          case 'histogram': {
            let bucketSize: number;
            let values = getSeriesValues(data);

            if (data.length && values.length) {
              let histMin = _.min(_.map(data, s => s.stats.min));
              let histMax = _.max(_.map(data, s => s.stats.max));
              let ticks = panel.xaxis.buckets || panelWidth / 50;
              bucketSize = tickStep(histMin, histMax, ticks);
              let histogram = convertValuesToHistogram(values, bucketSize);
              data[0].data = histogram;
              options.series.bars.barWidth = bucketSize * 0.8;
            } else {
              bucketSize = 0;
            }

            addXHistogramAxis(options, bucketSize);
            break;
          }
          case 'table': {
            options.series.bars.barWidth = 0.7;
            options.series.bars.align = 'center';
            addXTableAxis(options);
            break;
          }
          default: {
            options.series.bars.barWidth = getMinTimeStepOfSeries(data) / 1.5;
            addTimeAxis(options);
            break;
          }
        }
      }

      function callPlot(options, incrementRenderCounter) {
        try {
          plot = $.plot(elem, sortedSeries, options);
          if (ctrl.renderError) {
            delete ctrl.error;
            delete ctrl.inspector;
          }
        } catch (e) {
          console.log('flotcharts error', e);
          ctrl.error = e.message || 'Render Error';
          ctrl.renderError = true;
          ctrl.inspector = { error: e };
        }

        if (incrementRenderCounter) {
          ctrl.renderingCompleted();
        }
      }

      function buildFlotOptions(panel) {
        let gridColor = '#c8c8c8';
        if (config.bootData.user.lightTheme === true) {
          gridColor = '#a1a1a1';
        }
        const stack = panel.stack ? true : null;
        let options = {
          hooks: {
            draw: [drawHook],
            processOffset: [processOffsetHook],
          },
          legend: { show: false },
          series: {
            stackpercent: panel.stack ? panel.percentage : false,
            stack: panel.percentage ? null : stack,
            lines: {
              show: panel.lines,
              zero: false,
              fill: translateFillOption(panel.fill),
              lineWidth: panel.dashes ? 0 : panel.linewidth,
              steps: panel.steppedLine,
            },
            dashes: {
              show: panel.dashes,
              lineWidth: panel.linewidth,
              dashLength: [panel.dashLength, panel.spaceLength],
            },
            bars: {
              show: panel.bars,
              fill: 1,
              barWidth: 1,
              zero: false,
              lineWidth: 0,
            },
            points: {
              show: panel.points,
              fill: 1,
              fillColor: false,
              radius: panel.points ? panel.pointradius : 2,
            },
            shadowSize: 0,
          },
          yaxes: [],
          xaxis: {},
          grid: {
            minBorderMargin: 0,
            markings: [],
            backgroundColor: null,
            borderWidth: 0,
            hoverable: true,
            clickable: true,
            color: gridColor,
            margin: { left: 0, right: 0 },
            labelMarginX: 0,
          },
          selection: {
            mode: 'x',
            color: '#666',
          },
          crosshair: {
            mode: 'x',
          },
        };
        return options;
      }

      function sortSeries(series, panel) {
        var sortBy = panel.legend.sort;
        var sortOrder = panel.legend.sortDesc;
        var haveSortBy = sortBy !== null && sortBy !== undefined;
        var haveSortOrder = sortOrder !== null && sortOrder !== undefined;
        var shouldSortBy = panel.stack && haveSortBy && haveSortOrder;
        var sortDesc = panel.legend.sortDesc === true ? -1 : 1;

        if (shouldSortBy) {
          return _.sortBy(series, s => s.stats[sortBy] * sortDesc);
        } else {
          return _.sortBy(series, s => s.zindex);
        }
      }

      function translateFillOption(fill) {
        if (panel.percentage && panel.stack) {
          return fill === 0 ? 0.001 : fill / 10;
        } else {
          return fill / 10;
        }
      }

      function addTimeAxis(options) {
        var ticks = panelWidth / 100;
        var min = _.isUndefined(ctrl.range.from) ? null : ctrl.range.from.valueOf();
        var max = _.isUndefined(ctrl.range.to) ? null : ctrl.range.to.valueOf();

        options.xaxis = {
          timezone: dashboard.getTimezone(),
          show: panel.xaxis.show,
          mode: 'time',
          min: min,
          max: max,
          label: 'Datetime',
          ticks: ticks,
          timeformat: time_format(ticks, min, max),
        };
      }

      function addXSeriesAxis(options) {
        var ticks = _.map(data, function(series, index) {
          return [index + 1, series.alias];
        });

        options.xaxis = {
          timezone: dashboard.getTimezone(),
          show: panel.xaxis.show,
          mode: null,
          min: 0,
          max: ticks.length + 1,
          label: 'Datetime',
          ticks: ticks,
        };
      }

      function addXHistogramAxis(options, bucketSize) {
        let ticks, min, max;
        let defaultTicks = panelWidth / 50;

        if (data.length && bucketSize) {
          ticks = _.map(data[0].data, point => point[0]);
          min = _.min(ticks);
          max = _.max(ticks);

          // Adjust tick step
          let tickStep = bucketSize;
          let ticks_num = Math.floor((max - min) / tickStep);
          while (ticks_num > defaultTicks) {
            tickStep = tickStep * 2;
            ticks_num = Math.ceil((max - min) / tickStep);
          }

          // Expand ticks for pretty view
          min = Math.floor(min / tickStep) * tickStep;
          max = Math.ceil(max / tickStep) * tickStep;

          ticks = [];
          for (let i = min; i <= max; i += tickStep) {
            ticks.push(i);
          }
        } else {
          // Set defaults if no data
          ticks = defaultTicks / 2;
          min = 0;
          max = 1;
        }

        options.xaxis = {
          timezone: dashboard.getTimezone(),
          show: panel.xaxis.show,
          mode: null,
          min: min,
          max: max,
          label: 'Histogram',
          ticks: ticks,
        };

        // Use 'short' format for histogram values
        configureAxisMode(options.xaxis, 'short');
      }

      function addXTableAxis(options) {
        var ticks = _.map(data, function(series, seriesIndex) {
          return _.map(series.datapoints, function(point, pointIndex) {
            var tickIndex = seriesIndex * series.datapoints.length + pointIndex;
            return [tickIndex + 1, point[1]];
          });
        });
        ticks = _.flatten(ticks, true);

        options.xaxis = {
          timezone: dashboard.getTimezone(),
          show: panel.xaxis.show,
          mode: null,
          min: 0,
          max: ticks.length + 1,
          label: 'Datetime',
          ticks: ticks,
        };
      }

      function configureYAxisOptions(data, options) {
        var defaults = {
          position: 'left',
          show: panel.yaxes[0].show,
          index: 1,
          logBase: panel.yaxes[0].logBase || 1,
          min: parseNumber(panel.yaxes[0].min),
          max: parseNumber(panel.yaxes[0].max),
          tickDecimals: panel.yaxes[0].decimals,
        };

        options.yaxes.push(defaults);

        if (_.find(data, { yaxis: 2 })) {
          var secondY = _.clone(defaults);
          secondY.index = 2;
          secondY.show = panel.yaxes[1].show;
          secondY.logBase = panel.yaxes[1].logBase || 1;
          secondY.position = 'right';
          secondY.min = parseNumber(panel.yaxes[1].min);
          secondY.max = parseNumber(panel.yaxes[1].max);
          secondY.tickDecimals = panel.yaxes[1].decimals;
          options.yaxes.push(secondY);

          applyLogScale(options.yaxes[1], data);
          configureAxisMode(options.yaxes[1], panel.percentage && panel.stack ? 'percent' : panel.yaxes[1].format);
        }
        applyLogScale(options.yaxes[0], data);
        configureAxisMode(options.yaxes[0], panel.percentage && panel.stack ? 'percent' : panel.yaxes[0].format);
      }

      function parseNumber(value: any) {
        if (value === null || typeof value === 'undefined') {
          return null;
        }

        return _.toNumber(value);
      }

      function applyLogScale(axis, data) {
        if (axis.logBase === 1) {
          return;
        }

        const minSetToZero = axis.min === 0;

        if (axis.min < Number.MIN_VALUE) {
          axis.min = null;
        }
        if (axis.max < Number.MIN_VALUE) {
          axis.max = null;
        }

        var series, i;
        var max = axis.max,
          min = axis.min;

        for (i = 0; i < data.length; i++) {
          series = data[i];
          if (series.yaxis === axis.index) {
            if (!max || max < series.stats.max) {
              max = series.stats.max;
            }
            if (!min || min > series.stats.logmin) {
              min = series.stats.logmin;
            }
          }
        }

        axis.transform = function(v) {
          return v < Number.MIN_VALUE ? null : Math.log(v) / Math.log(axis.logBase);
        };
        axis.inverseTransform = function(v) {
          return Math.pow(axis.logBase, v);
        };

        if (!max && !min) {
          max = axis.inverseTransform(+2);
          min = axis.inverseTransform(-2);
        } else if (!max) {
          max = min * axis.inverseTransform(+4);
        } else if (!min) {
          min = max * axis.inverseTransform(-4);
        }

        if (axis.min) {
          min = axis.inverseTransform(Math.ceil(axis.transform(axis.min)));
        } else {
          min = axis.min = axis.inverseTransform(Math.floor(axis.transform(min)));
        }
        if (axis.max) {
          max = axis.inverseTransform(Math.floor(axis.transform(axis.max)));
        } else {
          max = axis.max = axis.inverseTransform(Math.ceil(axis.transform(max)));
        }

        if (!min || min < Number.MIN_VALUE || !max || max < Number.MIN_VALUE) {
          return;
        }

        if (Number.isFinite(min) && Number.isFinite(max)) {
          if (minSetToZero) {
            axis.min = 0.1;
            min = 1;
          }

          axis.ticks = generateTicksForLogScaleYAxis(min, max, axis.logBase);
          if (minSetToZero) {
            axis.ticks.unshift(0.1);
          }
          if (axis.ticks[axis.ticks.length - 1] > axis.max) {
            axis.max = axis.ticks[axis.ticks.length - 1];
          }
        } else {
          axis.ticks = [1, 2];
          delete axis.min;
          delete axis.max;
        }
      }

      function generateTicksForLogScaleYAxis(min, max, logBase) {
        let ticks = [];

        var nextTick;
        for (nextTick = min; nextTick <= max; nextTick *= logBase) {
          ticks.push(nextTick);
        }

        const maxNumTicks = Math.ceil(ctrl.height / 25);
        const numTicks = ticks.length;
        if (numTicks > maxNumTicks) {
          const factor = Math.ceil(numTicks / maxNumTicks) * logBase;
          ticks = [];

          for (nextTick = min; nextTick <= max * factor; nextTick *= factor) {
            ticks.push(nextTick);
          }
        }

        return ticks;
      }

      function configureAxisMode(axis, format) {
        axis.tickFormatter = function(val, axis) {
          return kbn.valueFormats[format](val, axis.tickDecimals, axis.scaledDecimals);
        };
      }

      function time_format(ticks, min, max) {
        if (min && max && ticks) {
          var range = max - min;
          var secPerTick = range / ticks / 1000;
          var oneDay = 86400000;
          var oneYear = 31536000000;

          if (secPerTick <= 45) {
            return '%H:%M:%S';
          }
          if (secPerTick <= 7200 || range <= oneDay) {
            return '%H:%M';
          }
          if (secPerTick <= 80000) {
            return '%m/%d %H:%M';
          }
          if (secPerTick <= 2419200 || range <= oneYear) {
            return '%m/%d';
          }
          return '%Y-%m';
        }

        return '%H:%M';
      }

      elem.bind('plotselected', function(event, ranges) {
        if (panel.xaxis.mode !== 'time') {
          // Skip if panel in histogram or series mode
          plot.clearSelection();
          return;
        }

        if ((ranges.ctrlKey || ranges.metaKey) && contextSrv.isEditor) {
          // Add annotation
          setTimeout(() => {
            eventManager.updateTime(ranges.xaxis);
          }, 100);
        } else {
          scope.$apply(function() {
            timeSrv.setTime({
              from: moment.utc(ranges.xaxis.from),
              to: moment.utc(ranges.xaxis.to),
            });
          });
        }
      });

      elem.bind('plotclick', function(event, pos, item) {
        if (panel.xaxis.mode !== 'time') {
          // Skip if panel in histogram or series mode
          return;
        }

        if ((pos.ctrlKey || pos.metaKey) && contextSrv.isEditor) {
          // Skip if range selected (added in "plotselected" event handler)
          let isRangeSelection = pos.x !== pos.x1;
          if (!isRangeSelection) {
            setTimeout(() => {
              eventManager.updateTime({ from: pos.x, to: null });
            }, 100);
          }
        }
      });

      scope.$on('$destroy', function() {
        tooltip.destroy();
        elem.off();
        elem.remove();
      });
    },
  };
}

coreModule.directive('grafanaGraph', graphDirective);
