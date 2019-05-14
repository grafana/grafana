import * as d3 from 'd3';
import $ from 'jquery';
import _ from 'lodash';
import { getValueBucketBound } from './heatmap_data_converter';
import { getValueFormat } from '@grafana/ui';
var TOOLTIP_PADDING_X = 30;
var TOOLTIP_PADDING_Y = 5;
var HISTOGRAM_WIDTH = 160;
var HISTOGRAM_HEIGHT = 40;
var HeatmapTooltip = /** @class */ (function () {
    function HeatmapTooltip(elem, scope) {
        this.scope = scope;
        this.dashboard = scope.ctrl.dashboard;
        this.panelCtrl = scope.ctrl;
        this.panel = scope.ctrl.panel;
        this.heatmapPanel = elem;
        this.mouseOverBucket = false;
        this.originalFillColor = null;
        elem.on('mouseleave', this.onMouseLeave.bind(this));
    }
    HeatmapTooltip.prototype.onMouseLeave = function () {
        this.destroy();
    };
    HeatmapTooltip.prototype.onMouseMove = function (e) {
        if (!this.panel.tooltip.show) {
            return;
        }
        this.move(e);
    };
    HeatmapTooltip.prototype.add = function () {
        this.tooltip = d3
            .select('body')
            .append('div')
            .attr('class', 'heatmap-tooltip graph-tooltip grafana-tooltip');
    };
    HeatmapTooltip.prototype.destroy = function () {
        if (this.tooltip) {
            this.tooltip.remove();
        }
        this.tooltip = null;
    };
    HeatmapTooltip.prototype.show = function (pos, data) {
        if (!this.panel.tooltip.show || !data) {
            return;
        }
        // shared tooltip mode
        if (pos.panelRelY) {
            return;
        }
        var _a = this.getBucketIndexes(pos, data), xBucketIndex = _a.xBucketIndex, yBucketIndex = _a.yBucketIndex;
        if (!data.buckets[xBucketIndex]) {
            this.destroy();
            return;
        }
        if (!this.tooltip) {
            this.add();
        }
        var boundBottom, boundTop, valuesNumber;
        var xData = data.buckets[xBucketIndex];
        // Search in special 'zero' bucket also
        var yData = _.find(xData.buckets, function (bucket, bucketIndex) {
            return bucket.bounds.bottom === yBucketIndex || bucketIndex === yBucketIndex.toString();
        });
        var tooltipTimeFormat = 'YYYY-MM-DD HH:mm:ss';
        var time = this.dashboard.formatDate(xData.x, tooltipTimeFormat);
        // Decimals override. Code from panel/graph/graph.ts
        var countValueFormatter, bucketBoundFormatter;
        if (_.isNumber(this.panel.tooltipDecimals)) {
            countValueFormatter = this.countValueFormatter(this.panel.tooltipDecimals, null);
            bucketBoundFormatter = this.panelCtrl.tickValueFormatter(this.panelCtrl.decimals, null);
        }
        else {
            // auto decimals
            // legend and tooltip gets one more decimal precision
            // than graph legend ticks
            var decimals = (this.panelCtrl.decimals || -1) + 1;
            countValueFormatter = this.countValueFormatter(decimals, this.panelCtrl.scaledDecimals + 2);
            bucketBoundFormatter = this.panelCtrl.tickValueFormatter(decimals, this.panelCtrl.scaledDecimals + 2);
        }
        var tooltipHtml = "<div class=\"graph-tooltip-time\">" + time + "</div>\n      <div class=\"heatmap-histogram\"></div>";
        if (yData) {
            if (yData.bounds) {
                if (data.tsBuckets) {
                    // Use Y-axis labels
                    var tickFormatter = function (valIndex) {
                        return data.tsBucketsFormatted ? data.tsBucketsFormatted[valIndex] : data.tsBuckets[valIndex];
                    };
                    boundBottom = tickFormatter(yBucketIndex);
                    if (this.panel.yBucketBound !== 'middle') {
                        boundTop = yBucketIndex < data.tsBuckets.length - 1 ? tickFormatter(yBucketIndex + 1) : '';
                    }
                }
                else {
                    // Display 0 if bucket is a special 'zero' bucket
                    var bottom = yData.y ? yData.bounds.bottom : 0;
                    boundBottom = bucketBoundFormatter(bottom);
                    boundTop = bucketBoundFormatter(yData.bounds.top);
                }
                valuesNumber = countValueFormatter(yData.count);
                var boundStr = boundTop && boundBottom ? boundBottom + " - " + boundTop : boundBottom || boundTop;
                tooltipHtml += "<div>\n          bucket: <b>" + boundStr + "</b> <br>\n          count: <b>" + valuesNumber + "</b> <br>\n        </div>";
            }
            else {
                // currently no bounds for pre bucketed data
                tooltipHtml += "<div>count: <b>" + yData.count + "</b><br></div>";
            }
        }
        else {
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
    };
    HeatmapTooltip.prototype.getBucketIndexes = function (pos, data) {
        var xBucketIndex = this.getXBucketIndex(pos.x, data);
        var yBucketIndex = this.getYBucketIndex(pos.y, data);
        return { xBucketIndex: xBucketIndex, yBucketIndex: yBucketIndex };
    };
    HeatmapTooltip.prototype.getXBucketIndex = function (x, data) {
        // First try to find X bucket by checking x pos is in the
        // [bucket.x, bucket.x + xBucketSize] interval
        var xBucket = _.find(data.buckets, function (bucket) {
            return x > bucket.x && x - bucket.x <= data.xBucketSize;
        });
        return xBucket ? xBucket.x : getValueBucketBound(x, data.xBucketSize, 1);
    };
    HeatmapTooltip.prototype.getYBucketIndex = function (y, data) {
        if (data.tsBuckets) {
            return Math.floor(y);
        }
        var yBucketIndex = getValueBucketBound(y, data.yBucketSize, this.panel.yAxis.logBase);
        return yBucketIndex;
    };
    HeatmapTooltip.prototype.getSharedTooltipPos = function (pos) {
        // get pageX from position on x axis and pageY from relative position in original panel
        pos.pageX = this.heatmapPanel.offset().left + this.scope.xScale(pos.x);
        pos.pageY = this.heatmapPanel.offset().top + this.scope.chartHeight * pos.panelRelY;
        return pos;
    };
    HeatmapTooltip.prototype.addHistogram = function (data) {
        var xBucket = this.scope.ctrl.data.buckets[data.x];
        var yBucketSize = this.scope.ctrl.data.yBucketSize;
        var min, max, ticks;
        if (this.scope.ctrl.data.tsBuckets) {
            min = 0;
            max = this.scope.ctrl.data.tsBuckets.length - 1;
            ticks = this.scope.ctrl.data.tsBuckets.length;
        }
        else {
            min = this.scope.ctrl.data.yAxis.min;
            max = this.scope.ctrl.data.yAxis.max;
            ticks = this.scope.ctrl.data.yAxis.ticks;
        }
        var histogramData = _.map(xBucket.buckets, function (bucket) {
            var count = bucket.count !== undefined ? bucket.count : bucket.values.length;
            return [bucket.bounds.bottom, count];
        });
        histogramData = _.filter(histogramData, function (d) {
            return d[0] >= min && d[0] <= max;
        });
        var scale = this.scope.yScale.copy();
        var histXScale = scale.domain([min, max]).range([0, HISTOGRAM_WIDTH]);
        var barWidth;
        if (this.panel.yAxis.logBase === 1) {
            barWidth = Math.floor((HISTOGRAM_WIDTH / (max - min)) * yBucketSize * 0.9);
        }
        else {
            var barNumberFactor = yBucketSize ? yBucketSize : 1;
            barWidth = Math.floor((HISTOGRAM_WIDTH / ticks / barNumberFactor) * 0.9);
        }
        barWidth = Math.max(barWidth, 1);
        // Normalize histogram Y axis
        var histogramDomain = _.reduce(_.map(histogramData, function (d) { return d[1]; }), function (sum, val) { return sum + val; }, 0);
        var histYScale = d3
            .scaleLinear()
            .domain([0, histogramDomain])
            .range([0, HISTOGRAM_HEIGHT]);
        var histogram = this.tooltip
            .select('.heatmap-histogram')
            .append('svg')
            .attr('width', HISTOGRAM_WIDTH)
            .attr('height', HISTOGRAM_HEIGHT);
        histogram
            .selectAll('.bar')
            .data(histogramData)
            .enter()
            .append('rect')
            .attr('x', function (d) {
            return histXScale(d[0]);
        })
            .attr('width', barWidth)
            .attr('y', function (d) {
            return HISTOGRAM_HEIGHT - histYScale(d[1]);
        })
            .attr('height', function (d) {
            return histYScale(d[1]);
        });
    };
    HeatmapTooltip.prototype.move = function (pos) {
        if (!this.tooltip) {
            return;
        }
        var elem = $(this.tooltip.node())[0];
        var tooltipWidth = elem.clientWidth;
        var tooltipHeight = elem.clientHeight;
        var left = pos.pageX + TOOLTIP_PADDING_X;
        var top = pos.pageY + TOOLTIP_PADDING_Y;
        if (pos.pageX + tooltipWidth + 40 > window.innerWidth) {
            left = pos.pageX - tooltipWidth - TOOLTIP_PADDING_X;
        }
        if (pos.pageY - window.pageYOffset + tooltipHeight + 20 > window.innerHeight) {
            top = pos.pageY - tooltipHeight - TOOLTIP_PADDING_Y;
        }
        return this.tooltip.style('left', left + 'px').style('top', top + 'px');
    };
    HeatmapTooltip.prototype.countValueFormatter = function (decimals, scaledDecimals) {
        if (scaledDecimals === void 0) { scaledDecimals = null; }
        var format = 'short';
        return function (value) {
            return getValueFormat(format)(value, decimals, scaledDecimals);
        };
    };
    return HeatmapTooltip;
}());
export { HeatmapTooltip };
//# sourceMappingURL=heatmap_tooltip.js.map