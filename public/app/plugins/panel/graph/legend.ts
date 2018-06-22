import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import baron from 'baron';

var module = angular.module('grafana.directives');

module.directive('graphLegend', function(popoverSrv, $timeout) {
  return {
    link: function(scope, elem) {
      var firstRender = true;
      var ctrl = scope.ctrl;
      var panel = ctrl.panel;
      var data;
      var seriesList;
      var i;
      var legendScrollbar;
      const legendRightDefaultWidth = 10;
      let legendElem = elem.parent();

      scope.$on('$destroy', function() {
        destroyScrollbar();
      });

      ctrl.events.on('render-legend', () => {
        data = ctrl.seriesList;
        if (data) {
          render();
        }
        ctrl.events.emit('legend-rendering-complete');
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
            position: 'bottom left',
            targetAttachment: 'top left',
            template:
              '<series-color-picker series="series" onToggleAxis="toggleAxis" onColorChange="colorSelected">' +
              '</series-color-picker>',
            openOn: 'hover',
            model: {
              series: series,
              toggleAxis: function() {
                ctrl.toggleAxis(series);
              },
              colorSelected: function(color) {
                ctrl.changeSeriesColor(series, color);
              },
            },
          });
        });
      }

      function toggleSeries(e) {
        var el = $(e.currentTarget);
        var index = getSeriesIndexForElement(el);
        var seriesInfo = seriesList[index];
        var scrollPosition = $(elem.children('tbody')).scrollTop();
        ctrl.toggleSeries(seriesInfo, e);
        $(elem.children('tbody')).scrollTop(scrollPosition);
      }

      function sortLegend(e) {
        var el = $(e.currentTarget);
        var stat = el.data('stat');

        if (stat !== panel.legend.sort) {
          panel.legend.sortDesc = null;
        }

        // if already sort ascending, disable sorting
        if (panel.legend.sortDesc === false) {
          panel.legend.sort = null;
          panel.legend.sortDesc = null;
          ctrl.render();
          return;
        }

        panel.legend.sortDesc = !panel.legend.sortDesc;
        panel.legend.sort = stat;
        ctrl.render();
      }

      function getTableHeaderHtml(statName) {
        if (!panel.legend[statName]) {
          return '';
        }
        var html = '<th class="pointer" data-stat="' + statName + '">' + statName;

        if (panel.legend.sort === statName) {
          var cssClass = panel.legend.sortDesc ? 'fa fa-caret-down' : 'fa fa-caret-up';
          html += ' <span class="' + cssClass + '"></span>';
        }

        return html + '</th>';
      }

      function render() {
        let legendWidth = legendElem.width();
        if (!ctrl.panel.legend.show) {
          elem.empty();
          firstRender = true;
          return;
        }

        if (firstRender) {
          elem.on('click', '.graph-legend-icon', openColorSelector);
          elem.on('click', '.graph-legend-alias', toggleSeries);
          elem.on('click', 'th', sortLegend);
          firstRender = false;
        }

        seriesList = data;

        elem.empty();

        // Set min-width if side style and there is a value, otherwise remove the CSS property
        // Set width so it works with IE11
        var width: any = panel.legend.rightSide && panel.legend.sideWidth ? panel.legend.sideWidth + 'px' : '';
        var ieWidth: any = panel.legend.rightSide && panel.legend.sideWidth ? panel.legend.sideWidth - 1 + 'px' : '';
        legendElem.css('min-width', width);
        legendElem.css('width', ieWidth);

        elem.toggleClass('graph-legend-table', panel.legend.alignAsTable === true);

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
            let sort = series.stats[panel.legend.sort];
            if (sort === null) {
              sort = -Infinity;
            }
            return sort;
          });
          if (panel.legend.sortDesc) {
            seriesList = seriesList.reverse();
          }
        }

        // render first time for getting proper legend height
        if (!panel.legend.rightSide || (panel.legend.rightSide && legendWidth !== legendRightDefaultWidth)) {
          renderLegendElement(tableHeaderElem);
          elem.empty();
        }

        renderLegendElement(tableHeaderElem);
      }

      function renderSeriesLegendElements() {
        let seriesElements = [];
        for (i = 0; i < seriesList.length; i++) {
          var series = seriesList[i];

          if (series.hideFromLegend(panel.legend)) {
            continue;
          }

          var html = '<div class="graph-legend-series';

          if (series.yaxis === 2) {
            html += ' graph-legend-series--right-y';
          }
          if (ctrl.hiddenSeries[series.alias]) {
            html += ' graph-legend-series-hidden';
          }
          html += '" data-series-index="' + i + '">';
          html += '<div class="graph-legend-icon">';
          html += '<i class="fa fa-minus pointer" style="color:' + series.color + '"></i>';
          html += '</div>';

          html +=
            '<a class="graph-legend-alias pointer" title="' + series.aliasEscaped + '">' + series.aliasEscaped + '</a>';

          if (panel.legend.values) {
            var avg = series.formatValue(series.stats.avg);
            var current = series.formatValue(series.stats.current);
            var min = series.formatValue(series.stats.min);
            var max = series.formatValue(series.stats.max);
            var total = series.formatValue(series.stats.total);

            if (panel.legend.min) {
              html += '<div class="graph-legend-value min">' + min + '</div>';
            }
            if (panel.legend.max) {
              html += '<div class="graph-legend-value max">' + max + '</div>';
            }
            if (panel.legend.avg) {
              html += '<div class="graph-legend-value avg">' + avg + '</div>';
            }
            if (panel.legend.current) {
              html += '<div class="graph-legend-value current">' + current + '</div>';
            }
            if (panel.legend.total) {
              html += '<div class="graph-legend-value total">' + total + '</div>';
            }
          }

          html += '</div>';
          seriesElements.push($(html));
        }
        return seriesElements;
      }

      function renderLegendElement(tableHeaderElem) {
        let legendWidth = elem.width();

        var seriesElements = renderSeriesLegendElements();

        if (panel.legend.alignAsTable) {
          var tbodyElem = $('<tbody></tbody>');
          tbodyElem.append(tableHeaderElem);
          tbodyElem.append(seriesElements);
          elem.append(tbodyElem);
          tbodyElem.wrap('<div class="graph-legend-scroll"></div>');
        } else {
          elem.append('<div class="graph-legend-scroll"></div>');
          elem.find('.graph-legend-scroll').append(seriesElements);
        }

        if (!panel.legend.rightSide || (panel.legend.rightSide && legendWidth !== legendRightDefaultWidth)) {
          addScrollbar();
        } else {
          destroyScrollbar();
        }
      }

      function addScrollbar() {
        const scrollRootClass = 'baron baron__root';
        const scrollerClass = 'baron__scroller';
        const scrollBarHTML = `
          <div class="baron__track">
            <div class="baron__bar"></div>
          </div>
        `;

        let scrollRoot = elem;
        let scroller = elem.find('.graph-legend-scroll');

        // clear existing scroll bar track to prevent duplication
        scrollRoot.find('.baron__track').remove();

        scrollRoot.addClass(scrollRootClass);
        $(scrollBarHTML).appendTo(scrollRoot);
        scroller.addClass(scrollerClass);

        let scrollbarParams = {
          root: scrollRoot[0],
          scroller: scroller[0],
          bar: '.baron__bar',
          track: '.baron__track',
          barOnCls: '_scrollbar',
          scrollingCls: '_scrolling',
        };

        if (!legendScrollbar) {
          legendScrollbar = baron(scrollbarParams);
        } else {
          destroyScrollbar();
          legendScrollbar = baron(scrollbarParams);
        }

        // #11830 - compensates for Firefox scrollbar calculation error in the baron framework
        scroller[0].style.marginRight = '-' + (scroller[0].offsetWidth - scroller[0].clientWidth) + 'px';

        legendScrollbar.scroll();
      }

      function destroyScrollbar() {
        if (legendScrollbar) {
          legendScrollbar.dispose();
          legendScrollbar = undefined;
        }
      }
    },
  };
});
