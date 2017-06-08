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

        ctrl.events.on('render', function() {
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
              openOn: 'hover',
              model: {
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
          var scrollPosition = $($container.children('tbody')).scrollTop();
          ctrl.toggleSeries(seriesInfo, e);
          $($container.children('tbody')).scrollTop(scrollPosition);
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

        function render() {
          if (!ctrl.panel.legend.show) {
            elem.empty();
            firstRender = true;
            return;
          }

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

          var tableHeaderElem;
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
            tableHeaderElem = $(header);
          }

          if (panel.legend.sort) {
            seriesList = _.sortBy(seriesList, function(series) {
              return series.stats[panel.legend.sort];
            });
            if (panel.legend.sortDesc) {
              seriesList = seriesList.reverse();
            }
          }

          var seriesShown = 0;
          var seriesElements = [];

          for (i = 0; i < seriesList.length; i++) {
            var series = seriesList[i];

            if (series.hideFromLegend(panel.legend)) {
              continue;
            }

            var html = '<div class="graph-legend-series';

            if (series.yaxis === 2) { html += ' graph-legend-series--right-y'; }
            if (ctrl.hiddenSeries[series.alias]) { html += ' graph-legend-series-hidden'; }
            html += '" data-series-index="' + i + '">';
            html += '<div class="graph-legend-icon">';
            html += '<i class="fa fa-minus pointer" style="color:' + series.color + '"></i>';
            html += '</div>';

            html += '<a class="graph-legend-alias pointer" title="' + _.escape(series.label) + '">' + _.escape(series.label) + '</a>';

            if (panel.legend.values) {
              var avg = series.formatValue(series.stats.avg);
              var current = series.formatValue(series.stats.current);
              var min = series.formatValue(series.stats.min);
              var max = series.formatValue(series.stats.max);
              var total = series.formatValue(series.stats.total);

              if (panel.legend.min) { html += '<div class="graph-legend-value min">' + min + '</div>'; }
              if (panel.legend.max) { html += '<div class="graph-legend-value max">' + max + '</div>'; }
              if (panel.legend.avg) { html += '<div class="graph-legend-value avg">' + avg + '</div>'; }
              if (panel.legend.current) { html += '<div class="graph-legend-value current">' + current + '</div>'; }
              if (panel.legend.total) { html += '<div class="graph-legend-value total">' + total + '</div>'; }
            }

            html += '</div>';
            seriesElements.push($(html));

            seriesShown++;
          }

          if (panel.legend.alignAsTable) {
            var maxHeight = ctrl.height;

            if (!panel.legend.rightSide) {
              maxHeight = maxHeight/2;
            }

            var topPadding = 6;
            var tbodyElem = $('<tbody></tbody>');
            tbodyElem.css("max-height", maxHeight - topPadding);
            tbodyElem.append(tableHeaderElem);
            tbodyElem.append(seriesElements);
            $container.append(tbodyElem);
          } else {
            $container.append(seriesElements);
          }
        }
      }
    };
  });

});
