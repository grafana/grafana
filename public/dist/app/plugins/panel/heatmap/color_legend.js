import _ from 'lodash';
import $ from 'jquery';
import * as d3 from 'd3';
import { contextSrv } from 'app/core/core';
import { tickStep } from 'app/core/utils/ticks';
import { getColorScale, getOpacityScale } from './color_scale';
import coreModule from 'app/core/core_module';
import { GrafanaThemeType, getColorFromHexRgbOrName } from '@grafana/ui';
var LEGEND_HEIGHT_PX = 6;
var LEGEND_WIDTH_PX = 100;
var LEGEND_TICK_SIZE = 0;
var LEGEND_VALUE_MARGIN = 0;
var LEGEND_PADDING_LEFT = 10;
var LEGEND_SEGMENT_WIDTH = 10;
/**
 * Color legend for heatmap editor.
 */
coreModule.directive('colorLegend', function () {
    return {
        restrict: 'E',
        template: '<div class="heatmap-color-legend"><svg width="16.5rem" height="24px"></svg></div>',
        link: function (scope, elem, attrs) {
            var ctrl = scope.ctrl;
            var panel = scope.ctrl.panel;
            render();
            ctrl.events.on('render', function () {
                render();
            });
            function render() {
                var legendElem = $(elem).find('svg');
                var legendWidth = Math.floor(legendElem.outerWidth());
                if (panel.color.mode === 'spectrum') {
                    var colorScheme = _.find(ctrl.colorSchemes, {
                        value: panel.color.colorScheme,
                    });
                    var colorScale = getColorScale(colorScheme, contextSrv.user.lightTheme, legendWidth);
                    drawSimpleColorLegend(elem, colorScale);
                }
                else if (panel.color.mode === 'opacity') {
                    var colorOptions = panel.color;
                    drawSimpleOpacityLegend(elem, colorOptions);
                }
            }
        },
    };
});
/**
 * Heatmap legend with scale values.
 */
coreModule.directive('heatmapLegend', function () {
    return {
        restrict: 'E',
        template: "<div class=\"heatmap-color-legend\"><svg width=\"" + LEGEND_WIDTH_PX + "px\" height=\"" + LEGEND_HEIGHT_PX + "px\"></svg></div>",
        link: function (scope, elem, attrs) {
            var ctrl = scope.ctrl;
            var panel = scope.ctrl.panel;
            render();
            ctrl.events.on('render', function () {
                render();
            });
            function render() {
                clearLegend(elem);
                if (!_.isEmpty(ctrl.data) && !_.isEmpty(ctrl.data.cards)) {
                    var cardStats = ctrl.data.cardStats;
                    var rangeFrom = _.isNil(panel.color.min) ? Math.min(cardStats.min, 0) : panel.color.min;
                    var rangeTo = _.isNil(panel.color.max) ? cardStats.max : panel.color.max;
                    var maxValue = cardStats.max;
                    var minValue = cardStats.min;
                    if (panel.color.mode === 'spectrum') {
                        var colorScheme = _.find(ctrl.colorSchemes, {
                            value: panel.color.colorScheme,
                        });
                        drawColorLegend(elem, colorScheme, rangeFrom, rangeTo, maxValue, minValue);
                    }
                    else if (panel.color.mode === 'opacity') {
                        var colorOptions = panel.color;
                        drawOpacityLegend(elem, colorOptions, rangeFrom, rangeTo, maxValue, minValue);
                    }
                }
            }
        },
    };
});
function drawColorLegend(elem, colorScheme, rangeFrom, rangeTo, maxValue, minValue) {
    var legendElem = $(elem).find('svg');
    var legend = d3.select(legendElem.get(0));
    clearLegend(elem);
    var legendWidth = Math.floor(legendElem.outerWidth()) - 30;
    var legendHeight = legendElem.attr('height');
    var rangeStep = ((rangeTo - rangeFrom) / legendWidth) * LEGEND_SEGMENT_WIDTH;
    var widthFactor = legendWidth / (rangeTo - rangeFrom);
    var valuesRange = d3.range(rangeFrom, rangeTo, rangeStep);
    var colorScale = getColorScale(colorScheme, contextSrv.user.lightTheme, maxValue, minValue);
    legend
        .append('g')
        .attr('class', 'legend-color-bar')
        .attr('transform', 'translate(' + LEGEND_PADDING_LEFT + ',0)')
        .selectAll('.heatmap-color-legend-rect')
        .data(valuesRange)
        .enter()
        .append('rect')
        .attr('x', function (d) { return Math.round((d - rangeFrom) * widthFactor); })
        .attr('y', 0)
        .attr('width', Math.round(rangeStep * widthFactor + 1)) // Overlap rectangles to prevent gaps
        .attr('height', legendHeight)
        .attr('stroke-width', 0)
        .attr('fill', function (d) { return colorScale(d); });
    drawLegendValues(elem, rangeFrom, rangeTo, maxValue, minValue, legendWidth, valuesRange);
}
function drawOpacityLegend(elem, options, rangeFrom, rangeTo, maxValue, minValue) {
    var legendElem = $(elem).find('svg');
    var legend = d3.select(legendElem.get(0));
    clearLegend(elem);
    var legendWidth = Math.floor(legendElem.outerWidth()) - 30;
    var legendHeight = legendElem.attr('height');
    var rangeStep = ((rangeTo - rangeFrom) / legendWidth) * LEGEND_SEGMENT_WIDTH;
    var widthFactor = legendWidth / (rangeTo - rangeFrom);
    var valuesRange = d3.range(rangeFrom, rangeTo, rangeStep);
    var opacityScale = getOpacityScale(options, maxValue, minValue);
    legend
        .append('g')
        .attr('class', 'legend-color-bar')
        .attr('transform', 'translate(' + LEGEND_PADDING_LEFT + ',0)')
        .selectAll('.heatmap-opacity-legend-rect')
        .data(valuesRange)
        .enter()
        .append('rect')
        .attr('x', function (d) { return Math.round((d - rangeFrom) * widthFactor); })
        .attr('y', 0)
        .attr('width', Math.round(rangeStep * widthFactor))
        .attr('height', legendHeight)
        .attr('stroke-width', 0)
        .attr('fill', options.cardColor)
        .style('opacity', function (d) { return opacityScale(d); });
    drawLegendValues(elem, rangeFrom, rangeTo, maxValue, minValue, legendWidth, valuesRange);
}
function drawLegendValues(elem, rangeFrom, rangeTo, maxValue, minValue, legendWidth, valuesRange) {
    var legendElem = $(elem).find('svg');
    var legend = d3.select(legendElem.get(0));
    if (legendWidth <= 0 || legendElem.get(0).childNodes.length === 0) {
        return;
    }
    var legendValueScale = d3
        .scaleLinear()
        .domain([rangeFrom, rangeTo])
        .range([0, legendWidth]);
    var ticks = buildLegendTicks(rangeFrom, rangeTo, maxValue, minValue);
    var xAxis = d3
        .axisBottom(legendValueScale)
        .tickValues(ticks)
        .tickSize(LEGEND_TICK_SIZE);
    var colorRect = legendElem.find(':first-child');
    var posY = getSvgElemHeight(legendElem) + LEGEND_VALUE_MARGIN;
    var posX = getSvgElemX(colorRect) + LEGEND_PADDING_LEFT;
    d3.select(legendElem.get(0))
        .append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(' + posX + ',' + posY + ')')
        .call(xAxis);
    legend
        .select('.axis')
        .select('.domain')
        .remove();
}
function drawSimpleColorLegend(elem, colorScale) {
    var legendElem = $(elem).find('svg');
    clearLegend(elem);
    var legendWidth = Math.floor(legendElem.outerWidth());
    var legendHeight = legendElem.attr('height');
    if (legendWidth) {
        var valuesNumber = Math.floor(legendWidth / 2);
        var rangeStep = Math.floor(legendWidth / valuesNumber);
        var valuesRange = d3.range(0, legendWidth, rangeStep);
        var legend = d3.select(legendElem.get(0));
        var legendRects = legend.selectAll('.heatmap-color-legend-rect').data(valuesRange);
        legendRects
            .enter()
            .append('rect')
            .attr('x', function (d) { return d; })
            .attr('y', 0)
            .attr('width', rangeStep + 1) // Overlap rectangles to prevent gaps
            .attr('height', legendHeight)
            .attr('stroke-width', 0)
            .attr('fill', function (d) { return colorScale(d); });
    }
}
function drawSimpleOpacityLegend(elem, options) {
    var legendElem = $(elem).find('svg');
    clearLegend(elem);
    var legend = d3.select(legendElem.get(0));
    var legendWidth = Math.floor(legendElem.outerWidth());
    var legendHeight = legendElem.attr('height');
    if (legendWidth) {
        var legendOpacityScale_1;
        if (options.colorScale === 'linear') {
            legendOpacityScale_1 = d3
                .scaleLinear()
                .domain([0, legendWidth])
                .range([0, 1]);
        }
        else if (options.colorScale === 'sqrt') {
            legendOpacityScale_1 = d3
                .scalePow()
                .exponent(options.exponent)
                .domain([0, legendWidth])
                .range([0, 1]);
        }
        var rangeStep = 10;
        var valuesRange = d3.range(0, legendWidth, rangeStep);
        var legendRects = legend.selectAll('.heatmap-opacity-legend-rect').data(valuesRange);
        legendRects
            .enter()
            .append('rect')
            .attr('x', function (d) { return d; })
            .attr('y', 0)
            .attr('width', rangeStep)
            .attr('height', legendHeight)
            .attr('stroke-width', 0)
            .attr('fill', getColorFromHexRgbOrName(options.cardColor, contextSrv.user.lightTheme ? GrafanaThemeType.Light : GrafanaThemeType.Dark))
            .style('opacity', function (d) { return legendOpacityScale_1(d); });
    }
}
function clearLegend(elem) {
    var legendElem = $(elem).find('svg');
    legendElem.empty();
}
function getSvgElemX(elem) {
    var svgElem = elem.get(0);
    if (svgElem && svgElem.x && svgElem.x.baseVal) {
        return svgElem.x.baseVal.value;
    }
    else {
        return 0;
    }
}
function getSvgElemHeight(elem) {
    var svgElem = elem.get(0);
    if (svgElem && svgElem.height && svgElem.height.baseVal) {
        return svgElem.height.baseVal.value;
    }
    else {
        return 0;
    }
}
function buildLegendTicks(rangeFrom, rangeTo, maxValue, minValue) {
    var range = rangeTo - rangeFrom;
    var tickStepSize = tickStep(rangeFrom, rangeTo, 3);
    var ticksNum = Math.ceil(range / tickStepSize);
    var firstTick = getFirstCloseTick(rangeFrom, tickStepSize);
    var ticks = [];
    for (var i = 0; i < ticksNum; i++) {
        var current = firstTick + tickStepSize * i;
        // Add user-defined min and max if it had been set
        if (isValueCloseTo(minValue, current, tickStepSize)) {
            ticks.push(minValue);
            continue;
        }
        else if (minValue < current) {
            ticks.push(minValue);
        }
        if (isValueCloseTo(maxValue, current, tickStepSize)) {
            ticks.push(maxValue);
            continue;
        }
        else if (maxValue < current) {
            ticks.push(maxValue);
        }
        ticks.push(current);
    }
    if (!isValueCloseTo(maxValue, rangeTo, tickStepSize)) {
        ticks.push(maxValue);
    }
    ticks.push(rangeTo);
    ticks = _.sortBy(_.uniq(ticks));
    return ticks;
}
function isValueCloseTo(val, valueTo, step) {
    var diff = Math.abs(val - valueTo);
    return diff < step * 0.3;
}
function getFirstCloseTick(minValue, step) {
    if (minValue < 0) {
        return Math.floor(minValue / step) * step;
    }
    return 0;
}
//# sourceMappingURL=color_legend.js.map