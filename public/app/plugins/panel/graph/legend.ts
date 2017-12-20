import angular from "angular";
import _ from "lodash";
import $ from "jquery";
import PerfectScrollbar from "perfect-scrollbar";
import { updateLegendValues } from "app/core/core";

var module = angular.module("grafana.directives");

module.directive("graphLegend", function(popoverSrv, $timeout) {
  return {
    link: function(scope, elem) {
      var firstRender = true;
      var ctrl = scope.ctrl;
      var panel = ctrl.panel;
      var data;
      var seriesList;
      var i;
      var legendScrollbar;

      scope.$on("$destroy", function() {
        if (legendScrollbar) {
          legendScrollbar.destroy();
        }
      });

      ctrl.events.on("render-legend", () => {
        data = ctrl.seriesList;
        if (data) {
          render();
        }
        ctrl.events.emit("legend-rendering-complete");
      });

      function updateLegendDecimals() {
        updateLegendValues(data, panel);
      }

      function getSeriesIndexForElement(el) {
        return el.parents("[data-series-index]").data("series-index");
      }

      function openColorSelector(e) {
        // if we clicked inside poup container ignore click
        if ($(e.target).parents(".popover").length) {
          return;
        }

        var el = $(e.currentTarget).find(".fa-minus");
        var index = getSeriesIndexForElement(el);
        var series = seriesList[index];

        $timeout(function() {
          popoverSrv.show({
            element: el[0],
            position: "bottom left",
            targetAttachment: "top left",
            template:
              '<series-color-picker series="series" onToggleAxis="toggleAxis" onColorChange="colorSelected">' +
              "</series-color-picker>",
            openOn: "hover",
            model: {
              series: series,
              toggleAxis: function() {
                ctrl.toggleAxis(series);
              },
              colorSelected: function(color) {
                ctrl.changeSeriesColor(series, color);
              }
            }
          });
        });
      }

      function toggleSeries(e) {
        var el = $(e.currentTarget);
        var index = getSeriesIndexForElement(el);
        var seriesInfo = seriesList[index];
        var scrollPosition = $(elem.children("tbody")).scrollTop();
        ctrl.toggleSeries(seriesInfo, e);
        $(elem.children("tbody")).scrollTop(scrollPosition);
      }

      function sortLegend(e) {
        var el = $(e.currentTarget);
        var stat = el.data("stat");

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
          return "";
        }
        var html =
          '<th class="pointer" data-stat="' + statName + '">' + statName;

        if (panel.legend.sort === statName) {
          var cssClass = panel.legend.sortDesc
            ? "fa fa-caret-down"
            : "fa fa-caret-up";
          html += ' <span class="' + cssClass + '"></span>';
        }

        return html + "</th>";
      }

      function render() {
        if (!ctrl.panel.legend.show) {
          elem.empty();
          firstRender = true;
          return;
        }

        if (firstRender) {
          elem.on("click", ".graph-legend-icon", openColorSelector);
          elem.on("click", ".graph-legend-alias", toggleSeries);
          elem.on("click", "th", sortLegend);
          firstRender = false;
        }

        seriesList = data;

        elem.empty();

        // Set min-width if side style and there is a value, otherwise remove the CSS propery
        var width =
          panel.legend.rightSide && panel.legend.sideWidth
            ? panel.legend.sideWidth + "px"
            : "";
        elem.css("min-width", width);

        elem.toggleClass(
          "graph-legend-table",
          panel.legend.alignAsTable === true
        );

        var tableHeaderElem;
        if (panel.legend.alignAsTable) {
          var header = "<tr>";
          header += '<th colspan="2" style="text-align:left"></th>';
          if (panel.legend.values) {
            header += getTableHeaderHtml("min");
            header += getTableHeaderHtml("max");
            header += getTableHeaderHtml("avg");
            header += getTableHeaderHtml("current");
            header += getTableHeaderHtml("total");
          }
          header += "</tr>";
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

        // render first time for getting proper legend height
        if (!panel.legend.rightSide) {
          renderLegendElement(tableHeaderElem);
          updateLegendDecimals();
          elem.empty();
        } else {
          updateLegendDecimals();
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
            html += " graph-legend-series--right-y";
          }
          if (ctrl.hiddenSeries[series.alias]) {
            html += " graph-legend-series-hidden";
          }
          html += '" data-series-index="' + i + '">';
          html += '<div class="graph-legend-icon">';
          html +=
            '<i class="fa fa-minus pointer" style="color:' +
            series.color +
            '"></i>';
          html += "</div>";

          html +=
            '<a class="graph-legend-alias pointer" title="' +
            series.aliasEscaped +
            '">' +
            series.aliasEscaped +
            "</a>";

          if (panel.legend.values) {
            var avg = series.formatValue(series.stats.avg);
            var current = series.formatValue(series.stats.current);
            var min = series.formatValue(series.stats.min);
            var max = series.formatValue(series.stats.max);
            var total = series.formatValue(series.stats.total);

            if (panel.legend.min) {
              html += '<div class="graph-legend-value min">' + min + "</div>";
            }
            if (panel.legend.max) {
              html += '<div class="graph-legend-value max">' + max + "</div>";
            }
            if (panel.legend.avg) {
              html += '<div class="graph-legend-value avg">' + avg + "</div>";
            }
            if (panel.legend.current) {
              html +=
                '<div class="graph-legend-value current">' + current + "</div>";
            }
            if (panel.legend.total) {
              html +=
                '<div class="graph-legend-value total">' + total + "</div>";
            }
          }

          html += "</div>";
          seriesElements.push($(html));
        }
        return seriesElements;
      }

      function renderLegendElement(tableHeaderElem) {
        var seriesElements = renderSeriesLegendElements();

        if (panel.legend.alignAsTable) {
          var tbodyElem = $("<tbody></tbody>");
          tbodyElem.append(tableHeaderElem);
          tbodyElem.append(seriesElements);
          elem.append(tbodyElem);
        } else {
          elem.append(seriesElements);
        }

        if (!panel.legend.rightSide) {
          addScrollbar();
        } else {
          destroyScrollbar();
        }
      }

      function addScrollbar() {
        const scrollbarOptions = {
          // Number of pixels the content height can surpass the container height without enabling the scroll bar.
          scrollYMarginOffset: 2,
          suppressScrollX: true
        };

        if (!legendScrollbar) {
          legendScrollbar = new PerfectScrollbar(elem[0], scrollbarOptions);
        } else {
          legendScrollbar.update();
        }
      }

      function destroyScrollbar() {
        if (legendScrollbar) {
          legendScrollbar.destroy();
        }
      }
    }
  };
});
