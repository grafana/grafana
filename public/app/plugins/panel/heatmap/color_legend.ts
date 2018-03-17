import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import * as d3 from 'd3';
import { contextSrv } from 'app/core/core';
import { tickStep } from 'app/core/utils/ticks';
import { getColorScale, getOpacityScale } from './color_scale';

let module = angular.module('grafana.directives');

const LEGEND_HEIGHT_PX = 6;
const LEGEND_WIDTH_PX = 100;
const LEGEND_TICK_SIZE = 0;
const LEGEND_VALUE_MARGIN = 0;

/**
 * Color legend for heatmap editor.
 */
module.directive('colorLegend', function() {
  return {
    restrict: 'E',
    template: '<div class="heatmap-color-legend"><svg width="16.5rem" height="24px"></svg></div>',
    link: function(scope, elem, attrs) {
      let ctrl = scope.ctrl;
      let panel = scope.ctrl.panel;

      render();

      ctrl.events.on('render', function() {
        render();
      });

      function render() {
        let legendElem = $(elem).find('svg');
        let legendWidth = Math.floor(legendElem.outerWidth());

        if (panel.color.mode === 'spectrum') {
          let colorScheme = _.find(ctrl.colorSchemes, {
            value: panel.color.colorScheme,
          });
          let colorScale = getColorScale(colorScheme, contextSrv.user.lightTheme, legendWidth);
          drawSimpleColorLegend(elem, colorScale);
        } else if (panel.color.mode === 'opacity') {
          let colorOptions = panel.color;
          drawSimpleOpacityLegend(elem, colorOptions);
        }
      }
    },
  };
});

/**
 * Heatmap legend with scale values.
 */
module.directive('heatmapLegend', function() {
  return {
    restrict: 'E',
    template: `<div class="heatmap-color-legend"><svg width="${LEGEND_WIDTH_PX}px" height="${LEGEND_HEIGHT_PX}px"></svg></div>`,
    link: function(scope, elem, attrs) {
      let ctrl = scope.ctrl;
      let panel = scope.ctrl.panel;

      render();
      ctrl.events.on('render', function() {
        render();
      });

      function render() {
        clearLegend(elem);
        if (!_.isEmpty(ctrl.data) && !_.isEmpty(ctrl.data.cards)) {
          let rangeFrom = 0;
          let rangeTo = ctrl.data.cardStats.max;
          let maxValue = panel.color.max || rangeTo;
          let minValue = panel.color.min || 0;

          if (panel.color.mode === 'spectrum') {
            let colorScheme = _.find(ctrl.colorSchemes, {
              value: panel.color.colorScheme,
            });
            drawColorLegend(elem, colorScheme, rangeFrom, rangeTo, maxValue, minValue);
          } else if (panel.color.mode === 'opacity') {
            let colorOptions = panel.color;
            drawOpacityLegend(elem, colorOptions, rangeFrom, rangeTo, maxValue, minValue);
          }
        }
      }
    },
  };
});

function drawColorLegend(elem, colorScheme, rangeFrom, rangeTo, maxValue, minValue) {
  let legendElem = $(elem).find('svg');
  let legend = d3.select(legendElem.get(0));
  clearLegend(elem);

  let legendWidth = Math.floor(legendElem.outerWidth()) - 30;
  let legendHeight = legendElem.attr('height');

  let rangeStep = 1;
  if (rangeTo - rangeFrom > legendWidth) {
    rangeStep = Math.floor((rangeTo - rangeFrom) / legendWidth);
  }
  let widthFactor = legendWidth / (rangeTo - rangeFrom);
  let valuesRange = d3.range(rangeFrom, rangeTo, rangeStep);

  let colorScale = getColorScale(colorScheme, contextSrv.user.lightTheme, maxValue, minValue);
  legend
    .selectAll('.heatmap-color-legend-rect')
    .data(valuesRange)
    .enter()
    .append('rect')
    .attr('x', d => d * widthFactor)
    .attr('y', 0)
    .attr('width', rangeStep * widthFactor + 1) // Overlap rectangles to prevent gaps
    .attr('height', legendHeight)
    .attr('stroke-width', 0)
    .attr('fill', d => colorScale(d));

  drawLegendValues(elem, colorScale, rangeFrom, rangeTo, maxValue, minValue, legendWidth);
}

function drawOpacityLegend(elem, options, rangeFrom, rangeTo, maxValue, minValue) {
  let legendElem = $(elem).find('svg');
  let legend = d3.select(legendElem.get(0));
  clearLegend(elem);

  let legendWidth = Math.floor(legendElem.outerWidth()) - 30;
  let legendHeight = legendElem.attr('height');

  let rangeStep = 1;
  if (rangeTo - rangeFrom > legendWidth) {
    rangeStep = Math.floor((rangeTo - rangeFrom) / legendWidth);
  }
  let widthFactor = legendWidth / (rangeTo - rangeFrom);
  let valuesRange = d3.range(rangeFrom, rangeTo, rangeStep);

  let opacityScale = getOpacityScale(options, maxValue, minValue);
  legend
    .selectAll('.heatmap-opacity-legend-rect')
    .data(valuesRange)
    .enter()
    .append('rect')
    .attr('x', d => d * widthFactor)
    .attr('y', 0)
    .attr('width', rangeStep * widthFactor)
    .attr('height', legendHeight)
    .attr('stroke-width', 0)
    .attr('fill', options.cardColor)
    .style('opacity', d => opacityScale(d));

  drawLegendValues(elem, opacityScale, rangeFrom, rangeTo, maxValue, minValue, legendWidth);
}

function drawLegendValues(elem, colorScale, rangeFrom, rangeTo, maxValue, minValue, legendWidth) {
  let legendElem = $(elem).find('svg');
  let legend = d3.select(legendElem.get(0));

  if (legendWidth <= 0 || legendElem.get(0).childNodes.length === 0) {
    return;
  }

  let legendValueScale = d3
    .scaleLinear()
    .domain([0, rangeTo])
    .range([0, legendWidth]);

  let ticks = buildLegendTicks(0, rangeTo, maxValue, minValue);
  let xAxis = d3
    .axisBottom(legendValueScale)
    .tickValues(ticks)
    .tickSize(LEGEND_TICK_SIZE);

  let colorRect = legendElem.find(':first-child');
  let posY = getSvgElemHeight(legendElem) + LEGEND_VALUE_MARGIN;
  let posX = getSvgElemX(colorRect);

  d3
    .select(legendElem.get(0))
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
  let legendElem = $(elem).find('svg');
  clearLegend(elem);

  let legendWidth = Math.floor(legendElem.outerWidth());
  let legendHeight = legendElem.attr('height');

  if (legendWidth) {
    let valuesNumber = Math.floor(legendWidth / 2);
    let rangeStep = Math.floor(legendWidth / valuesNumber);
    let valuesRange = d3.range(0, legendWidth, rangeStep);

    let legend = d3.select(legendElem.get(0));
    var legendRects = legend.selectAll('.heatmap-color-legend-rect').data(valuesRange);

    legendRects
      .enter()
      .append('rect')
      .attr('x', d => d)
      .attr('y', 0)
      .attr('width', rangeStep + 1) // Overlap rectangles to prevent gaps
      .attr('height', legendHeight)
      .attr('stroke-width', 0)
      .attr('fill', d => colorScale(d));
  }
}

function drawSimpleOpacityLegend(elem, options) {
  let legendElem = $(elem).find('svg');
  clearLegend(elem);

  let legend = d3.select(legendElem.get(0));
  let legendWidth = Math.floor(legendElem.outerWidth());
  let legendHeight = legendElem.attr('height');

  if (legendWidth) {
    let legendOpacityScale;
    if (options.colorScale === 'linear') {
      legendOpacityScale = d3
        .scaleLinear()
        .domain([0, legendWidth])
        .range([0, 1]);
    } else if (options.colorScale === 'sqrt') {
      legendOpacityScale = d3
        .scalePow()
        .exponent(options.exponent)
        .domain([0, legendWidth])
        .range([0, 1]);
    }

    let rangeStep = 10;
    let valuesRange = d3.range(0, legendWidth, rangeStep);
    var legendRects = legend.selectAll('.heatmap-opacity-legend-rect').data(valuesRange);

    legendRects
      .enter()
      .append('rect')
      .attr('x', d => d)
      .attr('y', 0)
      .attr('width', rangeStep)
      .attr('height', legendHeight)
      .attr('stroke-width', 0)
      .attr('fill', options.cardColor)
      .style('opacity', d => legendOpacityScale(d));
  }
}

function clearLegend(elem) {
  let legendElem = $(elem).find('svg');
  legendElem.empty();
}

function getSvgElemX(elem) {
  let svgElem = elem.get(0);
  if (svgElem && svgElem.x && svgElem.x.baseVal) {
    return svgElem.x.baseVal.value;
  } else {
    return 0;
  }
}

function getSvgElemHeight(elem) {
  let svgElem = elem.get(0);
  if (svgElem && svgElem.height && svgElem.height.baseVal) {
    return svgElem.height.baseVal.value;
  } else {
    return 0;
  }
}

function buildLegendTicks(rangeFrom, rangeTo, maxValue, minValue) {
  let range = rangeTo - rangeFrom;
  let tickStepSize = tickStep(rangeFrom, rangeTo, 3);
  let ticksNum = Math.round(range / tickStepSize);
  let ticks = [];

  for (let i = 0; i < ticksNum; i++) {
    let current = tickStepSize * i;
    // Add user-defined min and max if it had been set
    if (isValueCloseTo(minValue, current, tickStepSize)) {
      ticks.push(minValue);
      continue;
    } else if (minValue < current) {
      ticks.push(minValue);
    }
    if (isValueCloseTo(maxValue, current, tickStepSize)) {
      ticks.push(maxValue);
      continue;
    } else if (maxValue < current) {
      ticks.push(maxValue);
    }
    ticks.push(tickStepSize * i);
  }
  if (!isValueCloseTo(maxValue, rangeTo, tickStepSize)) {
    ticks.push(maxValue);
  }
  ticks.push(rangeTo);
  ticks = _.sortBy(_.uniq(ticks));
  return ticks;
}

function isValueCloseTo(val, valueTo, step) {
  let diff = Math.abs(val - valueTo);
  return diff < step * 0.3;
}
