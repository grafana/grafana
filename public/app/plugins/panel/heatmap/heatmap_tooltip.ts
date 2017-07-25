///<reference path="../../../headers/common.d.ts" />

import d3 from 'd3';
import $ from 'jquery';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {getValueBucketBound} from './heatmap_data_converter';

let TOOLTIP_PADDING_X = 30;
let TOOLTIP_PADDING_Y = 5;
let HISTOGRAM_WIDTH = 160;
let HISTOGRAM_HEIGHT = 40;

export class HeatmapTooltip {
  tooltip: any;
  scope: any;
  dashboard: any;
  panelCtrl: any;
  panel: any;
  heatmapPanel: any;
  mouseOverBucket: boolean;
  originalFillColor: any;

  constructor(elem, scope) {
    this.scope = scope;
    this.dashboard = scope.ctrl.dashboard;
    this.panelCtrl = scope.ctrl;
    this.panel = scope.ctrl.panel;
    this.heatmapPanel = elem;
    this.mouseOverBucket = false;
    this.originalFillColor = null;

    elem.on("mouseover", this.onMouseOver.bind(this));
    elem.on("mouseleave", this.onMouseLeave.bind(this));
  }

  onMouseOver(e) {
    if (!this.panel.tooltip.show || !this.scope.ctrl.data || _.isEmpty(this.scope.ctrl.data.buckets)) { return; }

    if (!this.tooltip) {
      this.add();
      this.move(e);
    }
  }

  onMouseLeave() {
    this.destroy();
  }

  onMouseMove(e) {
    if (!this.panel.tooltip.show) { return; }

    this.move(e);
  }

  add() {
    this.tooltip = d3.select("body")
      .append("div")
      .attr("class", "heatmap-tooltip graph-tooltip grafana-tooltip");
  }

  destroy() {
    if (this.tooltip) {
      this.tooltip.remove();
    }

    this.tooltip = null;
  }

  show(pos, data) {
    if (!this.panel.tooltip.show || !data) { return; }
    // shared tooltip mode
    if (pos.panelRelY) {
      return;
    }

    let {xBucketIndex, yBucketIndex} = this.getBucketIndexes(pos, data);

    if (!data.buckets[xBucketIndex] || !this.tooltip) {
      this.destroy();
      return;
    }

    let boundBottom, boundTop, valuesNumber;
    let xData = data.buckets[xBucketIndex];
    // Search in special 'zero' bucket also
    let yData = _.find(xData.buckets, (bucket, bucketIndex) => {
      return bucket.bounds.bottom === yBucketIndex || bucketIndex === yBucketIndex;
    });

    let tooltipTimeFormat = 'YYYY-MM-DD HH:mm:ss';
    let time = this.dashboard.formatDate(xData.x, tooltipTimeFormat);

    // Decimals override. Code from panel/graph/graph.ts
    let valueFormatter;
    if (_.isNumber(this.panel.tooltipDecimals)) {
      valueFormatter = this.valueFormatter(this.panel.tooltipDecimals, null);
    } else {
      // auto decimals
      // legend and tooltip gets one more decimal precision
      // than graph legend ticks
      let decimals = (this.panelCtrl.decimals || -1) + 1;
      valueFormatter = this.valueFormatter(decimals, this.panelCtrl.scaledDecimals + 2);
    }

    let tooltipHtml = `<div class="graph-tooltip-time">${time}</div>
      <div class="heatmap-histogram"></div>`;

    if (yData) {
      if (yData.bounds) {
        // Display 0 if bucket is a special 'zero' bucket
        let bottom = yData.y ? yData.bounds.bottom : 0;
        boundBottom = valueFormatter(bottom);
        boundTop = valueFormatter(yData.bounds.top);
        valuesNumber = yData.count;
        tooltipHtml += `<div>
          bucket: <b>${boundBottom} - ${boundTop}</b> <br>
          count: <b>${valuesNumber}</b> <br>
        </div>`;
      } else {
        // currently no bounds for pre bucketed data
        tooltipHtml += `<div>count: <b>${yData.count}</b><br></div>`;
      }
    } else {
      if (!this.panel.tooltip.showHistogram) {
        this.destroy();
        return;
      }
      boundBottom = yBucketIndex;
      boundTop = '';
      valuesNumber = 0;
    }

    this.tooltip.html(tooltipHtml);

    if (this.panel.tooltip.showHistogram) {
      this.addHistogram(xData);
    }

    this.move(pos);
  }

  getBucketIndexes(pos, data) {
    const xBucketIndex = this.getXBucketIndex(pos.offsetX, data);
    const yBucketIndex = this.getYBucketIndex(pos.offsetY, data);
    return {xBucketIndex, yBucketIndex};
  }

  getXBucketIndex(offsetX, data) {
    let x = this.scope.xScale.invert(offsetX - this.scope.yAxisWidth).valueOf();
    let xBucketIndex = getValueBucketBound(x, data.xBucketSize, 1);
    return xBucketIndex;
  }

  getYBucketIndex(offsetY, data) {
    let y = this.scope.yScale.invert(offsetY - this.scope.chartTop);
    let yBucketIndex = getValueBucketBound(y, data.yBucketSize, this.panel.yAxis.logBase);
    return yBucketIndex;
  }

  getSharedTooltipPos(pos) {
    // get pageX from position on x axis and pageY from relative position in original panel
    pos.pageX = this.heatmapPanel.offset().left + this.scope.xScale(pos.x);
    pos.pageY = this.heatmapPanel.offset().top + this.scope.chartHeight * pos.panelRelY;
    return pos;
  }

  addHistogram(data) {
    let xBucket = this.scope.ctrl.data.buckets[data.x];
    let yBucketSize = this.scope.ctrl.data.yBucketSize;
    let {min, max, ticks} = this.scope.ctrl.data.yAxis;
    let histogramData = _.map(xBucket.buckets, bucket => {
      return [bucket.bounds.bottom, bucket.values.length];
    });
    histogramData = _.filter(histogramData, d => {
      return d[0] >= min && d[0] <= max;
    });

    let scale = this.scope.yScale.copy();
    let histXScale = scale
    .domain([min, max])
    .range([0, HISTOGRAM_WIDTH]);

    let barWidth;
    if (this.panel.yAxis.logBase === 1) {
      barWidth = Math.floor(HISTOGRAM_WIDTH / (max - min) * yBucketSize * 0.9);
    } else {
      let barNumberFactor = yBucketSize ? yBucketSize : 1;
      barWidth = Math.floor(HISTOGRAM_WIDTH / ticks / barNumberFactor * 0.9);
    }
    barWidth = Math.max(barWidth, 1);

    // Normalize histogram Y axis
    let histogramDomain = _.reduce(_.map(histogramData, d => d[1]), (sum, val) => sum + val, 0);
    let histYScale = d3.scaleLinear()
      .domain([0, histogramDomain])
      .range([0, HISTOGRAM_HEIGHT]);

    let histogram = this.tooltip.select(".heatmap-histogram")
    .append("svg")
    .attr("width", HISTOGRAM_WIDTH)
    .attr("height", HISTOGRAM_HEIGHT);

    histogram.selectAll(".bar").data(histogramData)
    .enter().append("rect")
    .attr("x", d => {
      return histXScale(d[0]);
    })
    .attr("width", barWidth)
    .attr("y", d => {
        return HISTOGRAM_HEIGHT - histYScale(d[1]);
      })
      .attr("height", d => {
        return histYScale(d[1]);
      });
  }

  move(pos) {
    if (!this.tooltip) { return; }

    let elem = $(this.tooltip.node())[0];
    let tooltipWidth = elem.clientWidth;
    let tooltipHeight = elem.clientHeight;

    let left = pos.pageX + TOOLTIP_PADDING_X;
    let top = pos.pageY + TOOLTIP_PADDING_Y;

    if (pos.pageX + tooltipWidth + 40 > window.innerWidth) {
      left = pos.pageX - tooltipWidth - TOOLTIP_PADDING_X;
    }

    if (pos.pageY - window.pageYOffset + tooltipHeight + 20 > window.innerHeight) {
      top = pos.pageY - tooltipHeight - TOOLTIP_PADDING_Y;
    }

    return this.tooltip
      .style("left", left + "px")
      .style("top", top + "px");
  }

  valueFormatter(decimals, scaledDecimals = null) {
    let format = this.panel.yAxis.format;
    return function(value) {
      return kbn.valueFormats[format](value, decimals, scaledDecimals);
    };
  }
}
