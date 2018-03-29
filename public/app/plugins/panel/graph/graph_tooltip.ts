import $ from 'jquery';
import { appEvents } from 'app/core/core';

export default function GraphTooltip(elem, dashboard, scope, getSeriesFn) {
  let self = this;
  let ctrl = scope.ctrl;
  let panel = ctrl.panel;

  let $tooltip = $('<div class="graph-tooltip">');

  this.destroy = function() {
    $tooltip.remove();
  };

  this.findHoverIndexFromDataPoints = function(posX, series, last) {
    let ps = series.datapoints.pointsize;
    let initial = last * ps;
    let len = series.datapoints.points.length;
    let j;
    for (j = initial; j < len; j += ps) {
      // Special case of a non stepped line, highlight the very last point just before a null point
      if (
        (!series.lines.steps && series.datapoints.points[initial] != null && series.datapoints.points[j] == null) ||
        //normal case
        series.datapoints.points[j] > posX
      ) {
        return Math.max(j - ps, 0) / ps;
      }
    }
    return j / ps - 1;
  };

  this.findHoverIndexFromData = function(posX, series) {
    let lower = 0;
    let upper = series.data.length - 1;
    let middle;
    while (true) {
      if (lower > upper) {
        return Math.max(upper, 0);
      }
      middle = Math.floor((lower + upper) / 2);
      if (series.data[middle][0] === posX) {
        return middle;
      } else if (series.data[middle][0] < posX) {
        lower = middle + 1;
      } else {
        upper = middle - 1;
      }
    }
  };

  this.renderAndShow = function(absoluteTime, innerHtml, pos, xMode) {
    if (xMode === 'time') {
      innerHtml = '<div class="graph-tooltip-time">' + absoluteTime + '</div>' + innerHtml;
    }
    $tooltip.html(innerHtml).place_tt(pos.pageX + 20, pos.pageY);
  };

  this.getMultiSeriesPlotHoverInfo = function(seriesList, pos) {
    let value, i, series, hoverIndex, hoverDistance, pointTime, yaxis;
    // 3 sub-arrays, 1st for hidden series, 2nd for left yaxis, 3rd for right yaxis.
    let results: any = [[], [], []];

    //now we know the current X (j) position for X and Y values
    let last_value = 0; //needed for stacked values

    let minDistance, minTime;

    for (i = 0; i < seriesList.length; i++) {
      series = seriesList[i];

      if (!series.data.length || (panel.legend.hideEmpty && series.allIsNull)) {
        // Init value so that it does not brake series sorting
        results[0].push({ hidden: true, value: 0 });
        continue;
      }

      if (!series.data.length || (panel.legend.hideZero && series.allIsZero)) {
        // Init value so that it does not brake series sorting
        results[0].push({ hidden: true, value: 0 });
        continue;
      }

      hoverIndex = this.findHoverIndexFromData(pos.x, series);
      hoverDistance = pos.x - series.data[hoverIndex][0];
      pointTime = series.data[hoverIndex][0];

      // Take the closest point before the cursor, or if it does not exist, the closest after
      if (
        !minDistance ||
        (hoverDistance >= 0 && (hoverDistance < minDistance || minDistance < 0)) ||
        (hoverDistance < 0 && hoverDistance > minDistance)
      ) {
        minDistance = hoverDistance;
        minTime = pointTime;
      }

      if (series.stack) {
        if (panel.tooltip.value_type === 'individual') {
          value = series.data[hoverIndex][1];
        } else if (!series.stack) {
          value = series.data[hoverIndex][1];
        } else {
          last_value += series.data[hoverIndex][1];
          value = last_value;
        }
      } else {
        value = series.data[hoverIndex][1];
      }

      // Highlighting multiple Points depending on the plot type
      if (series.lines.steps || series.stack) {
        // stacked and steppedLine plots can have series with different length.
        // Stacked series can increase its length on each new stacked serie if null points found,
        // to speed the index search we begin always on the last found hoverIndex.
        hoverIndex = this.findHoverIndexFromDataPoints(pos.x, series, hoverIndex);
      }

      // Be sure we have a yaxis so that it does not brake series sorting
      yaxis = 0;
      if (series.yaxis) {
        yaxis = series.yaxis.n;
      }

      results[yaxis].push({
        value: value,
        hoverIndex: hoverIndex,
        color: series.color,
        label: series.aliasEscaped,
        time: pointTime,
        distance: hoverDistance,
        index: i,
      });
    }

    // Contat the 3 sub-arrays
    results = results[0].concat(results[1], results[2]);

    // Time of the point closer to pointer
    results.time = minTime;

    return results;
  };

  elem.mouseleave(function() {
    if (panel.tooltip.shared) {
      let plot = elem.data().plot;
      if (plot) {
        $tooltip.detach();
        plot.unhighlight();
      }
    }
    appEvents.emit('graph-hover-clear');
  });

  elem.bind('plothover', function(event, pos, item) {
    self.show(pos, item);

    // broadcast to other graph panels that we are hovering!
    pos.panelRelY = (pos.pageY - elem.offset().top) / elem.height();
    appEvents.emit('graph-hover', { pos: pos, panel: panel });
  });

  elem.bind('plotclick', function(event, pos, item) {
    appEvents.emit('graph-click', { pos: pos, panel: panel, item: item });
  });

  this.clear = function(plot) {
    $tooltip.detach();
    plot.clearCrosshair();
    plot.unhighlight();
  };

  this.show = function(pos, item) {
    let plot = elem.data().plot;
    let plotData = plot.getData();
    let xAxes = plot.getXAxes();
    let xMode = xAxes[0].options.mode;
    let seriesList = getSeriesFn();
    let allSeriesMode = panel.tooltip.shared;
    let group, value, absoluteTime, hoverInfo, i, series, seriesHtml, tooltipFormat;

    // if panelRelY is defined another panel wants us to show a tooltip
    // get pageX from position on x axis and pageY from relative position in original panel
    if (pos.panelRelY) {
      let pointOffset = plot.pointOffset({ x: pos.x });
      if (Number.isNaN(pointOffset.left) || pointOffset.left < 0 || pointOffset.left > elem.width()) {
        self.clear(plot);
        return;
      }
      pos.pageX = elem.offset().left + pointOffset.left;
      pos.pageY = elem.offset().top + elem.height() * pos.panelRelY;
      let isVisible =
        pos.pageY >= $(window).scrollTop() && pos.pageY <= $(window).innerHeight() + $(window).scrollTop();
      if (!isVisible) {
        self.clear(plot);
        return;
      }
      plot.setCrosshair(pos);
      allSeriesMode = true;

      if (dashboard.sharedCrosshairModeOnly()) {
        // if only crosshair mode we are done
        return;
      }
    }

    if (seriesList.length === 0) {
      return;
    }

    if (seriesList[0].hasMsResolution) {
      tooltipFormat = 'YYYY-MM-DD HH:mm:ss.SSS';
    } else {
      tooltipFormat = 'YYYY-MM-DD HH:mm:ss';
    }

    if (allSeriesMode) {
      plot.unhighlight();

      let seriesHoverInfo = self.getMultiSeriesPlotHoverInfo(plotData, pos);

      seriesHtml = '';

      absoluteTime = dashboard.formatDate(seriesHoverInfo.time, tooltipFormat);

      // Dynamically reorder the hovercard for the current time point if the
      // option is enabled.
      if (panel.tooltip.sort === 2) {
        seriesHoverInfo.sort(function(a, b) {
          return b.value - a.value;
        });
      } else if (panel.tooltip.sort === 1) {
        seriesHoverInfo.sort(function(a, b) {
          return a.value - b.value;
        });
      }

      for (i = 0; i < seriesHoverInfo.length; i++) {
        hoverInfo = seriesHoverInfo[i];

        if (hoverInfo.hidden) {
          continue;
        }

        let highlightClass = '';
        if (item && hoverInfo.index === item.seriesIndex) {
          highlightClass = 'graph-tooltip-list-item--highlight';
        }

        series = seriesList[hoverInfo.index];

        value = series.formatValue(hoverInfo.value);

        seriesHtml +=
          '<div class="graph-tooltip-list-item ' + highlightClass + '"><div class="graph-tooltip-series-name">';
        seriesHtml +=
          '<i class="fa fa-minus" style="color:' + hoverInfo.color + ';"></i> ' + hoverInfo.label + ':</div>';
        seriesHtml += '<div class="graph-tooltip-value">' + value + '</div></div>';
        plot.highlight(hoverInfo.index, hoverInfo.hoverIndex);
      }

      self.renderAndShow(absoluteTime, seriesHtml, pos, xMode);
    } else if (item) {
      // single series tooltip
      series = seriesList[item.seriesIndex];
      group = '<div class="graph-tooltip-list-item"><div class="graph-tooltip-series-name">';
      group +=
        '<i class="fa fa-minus" style="color:' + item.series.color + ';"></i> ' + series.aliasEscaped + ':</div>';

      if (panel.stack && panel.tooltip.value_type === 'individual') {
        value = item.datapoint[1] - item.datapoint[2];
      } else {
        value = item.datapoint[1];
      }

      value = series.formatValue(value);

      absoluteTime = dashboard.formatDate(item.datapoint[0], tooltipFormat);

      group += '<div class="graph-tooltip-value">' + value + '</div>';

      self.renderAndShow(absoluteTime, group, pos, xMode);
    } else {
      // no hit
      $tooltip.detach();
    }
  };
}
