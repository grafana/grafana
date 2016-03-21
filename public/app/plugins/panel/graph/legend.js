define([
  'angular',
  'lodash',
  'jquery',
  'jquery.flot',
  'jquery.flot.time',
],
function (angular, _, $) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('graphLegend', function(popoverSrv, $timeout) {

    return {
      link: function(scope, elem) {
        var $container = $('<section class="graph-legend"></section>');
        var firstRender = true;
        var ctrl = scope.ctrl;
        var panel = ctrl.panel;
        var data;
        var seriesList;
        var i;

        scope.$on('render', function() {
          data = ctrl.seriesList;
          if (data) {
            render();
          }
        });

        function getSeriesIndexForElement(el) {
          return el.parents('[data-series-index]').data('series-index');
        }

        function openColorSelector(e) {
          // if we clicked inside poup container ignore click
          if ($(e.target).parents('.popover').length) {
            return;
          }

          var el = $(e.currentTarget).find('.fa-minus');
          var index = getSeriesIndexForElement(el);
          var series = seriesList[index];

          $timeout(function() {
            popoverSrv.show({
              element: el[0],
              position: 'bottom center',
              template: '<gf-color-picker></gf-color-picker>',
              model: {
                autoClose: true,
                series: series,
                toggleAxis: function() {
                  ctrl.toggleAxis(series);
                },
                colorSelected: function(color) {
                  ctrl.changeSeriesColor(series, color);
                }
              },
            });
          });
        }

        function toggleSeries(e) {
          var el = $(e.currentTarget);
          var index = getSeriesIndexForElement(el);
          var seriesInfo = seriesList[index];
          ctrl.toggleSeries(seriesInfo, e);
        }

        function sortLegend(e) {
          var el = $(e.currentTarget);
          var stat = el.data('stat');

          if (stat !== panel.legend.sort) { panel.legend.sortDesc = null; }

          // if already sort ascending, disable sorting
          if (panel.legend.sortDesc === false) {
            panel.legend.sort = null;
            panel.legend.sortDesc = null;
            render();
            return;
          }

          panel.legend.sortDesc = !panel.legend.sortDesc;
          panel.legend.sort = stat;
          render();
        }

        function getTableHeaderHtml(statName) {
          if (!panel.legend[statName]) { return ""; }
          var html = '<th class="pointer" data-stat="' + statName + '">' + statName;

          if (panel.legend.sort === statName) {
            var cssClass = panel.legend.sortDesc ? 'fa fa-caret-down' : 'fa fa-caret-up' ;
            html += ' <span class="' + cssClass + '"></span>';
          }

          return html + '</th>';
        }

        function getStackValue(series, panel, value, stack) {
          var stack_index = (series.stack === 'A')?1:
            (series.stack === 'B')?2:
            (series.stack === 'C')?3:
            (series.stack === 'D')?4:0;
          var result = 0;

          series.stack?
            "individual" === panel.tooltip.value_type?
              result = value:
              series.stack?
                (stack[stack_index] += value, result = stack[stack_index]):
                result = value:
            result = value;
          return result;
        }

        function render() {
          if (firstRender) {
            elem.append($container);
            $container.on('click', '.graph-legend-icon', openColorSelector);
            $container.on('click', '.graph-legend-alias', toggleSeries);
            $container.on('click', 'th', sortLegend);
            firstRender = false;
          }

          seriesList = data;

          $container.empty();

          // Set min-width if side style and there is a value, otherwise remove the CSS propery
          var width = panel.legend.rightSide && panel.legend.sideWidth ? panel.legend.sideWidth + "px" : "";
          $container.css("min-width", width);

          $container.toggleClass('graph-legend-table', panel.legend.alignAsTable === true);

          if (panel.legend.alignAsTable) {
            var header = '<tr>';
            header += '<th colspan="2" style="text-align:left"></th>';
            if (panel.legend.values) {
              header += getTableHeaderHtml('min');
              header += getTableHeaderHtml('max');
              header += getTableHeaderHtml('avg');
              header += getTableHeaderHtml('current');
              header += getTableHeaderHtml('total');
            }
            header += '</tr>';
            $container.append($(header));
          }

          var stack_avg = [0, 0, 0, 0, 0],
            stack_current = [0, 0, 0, 0, 0],
            stack_min = [0, 0, 0, 0, 0],
            stack_max = [0, 0, 0, 0, 0],
            stack_total = [0, 0, 0, 0, 0];

          if (panel.legend.sort) {
            seriesList = _.sortBy(seriesList, function(series) {
              return series.stats[panel.legend.sort];
            });
            if (panel.legend.sortDesc) {
              seriesList = seriesList.reverse();
            }
          }

          var seriesShown = 0;
          for (i = 0; i < seriesList.length; i++) {
            var series = seriesList[i];
            var avg = series.formatValue(getStackValue(series, panel, series.stats.avg, stack_avg));
            var current = series.formatValue(getStackValue(series, panel, series.stats.current, stack_current));
            var min = series.formatValue(getStackValue(series, panel, series.stats.min, stack_min));
            var max = series.formatValue(getStackValue(series, panel, series.stats.max, stack_max));
            var total = series.formatValue(getStackValue(series, panel, series.stats.total, stack_total));

            if (series.hideFromLegend(panel.legend)) {
              continue;
            }

            var html = '<div class="graph-legend-series';
            if (series.yaxis === 2) { html += ' pull-right'; }
            if (ctrl.hiddenSeries[series.alias]) { html += ' graph-legend-series-hidden'; }
            html += '" data-series-index="' + i + '">';
            html += '<div class="graph-legend-icon">';
            html += '<i class="fa fa-minus pointer" style="color:' + series.color + '"></i>';
            html += '</div>';

            html += '<a class="graph-legend-alias pointer">' + _.escape(series.label) + '</a>';

            if (panel.legend.values) {
              if (panel.legend.min) { html += '<div class="graph-legend-value min">' + min + '</div>'; }
              if (panel.legend.max) { html += '<div class="graph-legend-value max">' + max + '</div>'; }
              if (panel.legend.avg) { html += '<div class="graph-legend-value avg">' + avg + '</div>'; }
              if (panel.legend.current) { html += '<div class="graph-legend-value current">' + current + '</div>'; }
              if (panel.legend.total) { html += '<div class="graph-legend-value total">' + total + '</div>'; }
            }

            html += '</div>';
            $container.append($(html));

            seriesShown++;
          }

          if (panel.legend.alignAsTable) {
            var maxHeight = ctrl.height;

            if (!panel.legend.rightSide) {
              maxHeight = maxHeight/2;
            }

            var topPadding = 6;
            $container.css("height", maxHeight - topPadding);
          } else {
            $container.css("height", "");
          }
        }
      }
    };
  });

});
