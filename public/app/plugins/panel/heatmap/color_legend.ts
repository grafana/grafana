import _ from 'lodash';
import $ from 'jquery';
import * as d3 from 'd3';
import { contextSrv } from 'app/core/core';
import { tickStep } from 'app/core/utils/ticks';
import { getColorScale, getOpacityScale } from './color_scale';
import coreModule from 'app/core/core_module';
import { GrafanaThemeType, getColorFromHexRgbOrName } from '@grafana/ui';

const LEGEND_HEIGHT_PX = 6;
const LEGEND_WIDTH_PX = 100;
const LEGEND_TICK_SIZE = 0;
const LEGEND_VALUE_MARGIN = 0;

/**
 * Color legend for heatmap editor.
 */
coreModule.directive('colorLegend', () => {
  return {
    restrict: 'E',
    template: '<div class="heatmap-color-legend"><svg width="16.5rem" height="24px"></svg></div>',
    link: (scope, elem, attrs) => {
      const ctrl = scope.ctrl;
      const panel = scope.ctrl.panel;

      render();

      ctrl.events.on('render', () => {
        render();
      });

      function render() {
        const legendElem = $(elem).find('svg');
        const legendWidth = Math.floor(legendElem.outerWidth());

        if (panel.color.mode === 'spectrum') {
          const colorScheme = _.find(ctrl.colorSchemes, {
            value: panel.color.colorScheme,
          });
          const colorScale = getColorScale(colorScheme, contextSrv.user.lightTheme, legendWidth);
          drawSimpleColorLegend(elem, colorScale);
        } else if (panel.color.mode === 'opacity') {
          const colorOptions = panel.color;
          drawSimpleOpacityLegend(elem, colorOptions);
        }
      }
    },
  };
});

/**
 * Heatmap legend with scale values.
 */
coreModule.directive('heatmapLegend', () => {
  return {
    restrict: 'E',
    template: `<div class="heatmap-color-legend"><svg width="${LEGEND_WIDTH_PX}px" height="${LEGEND_HEIGHT_PX}px"></svg></div>`,
    link: (scope, elem, attrs) => {
      const ctrl = scope.ctrl;
      const panel = scope.ctrl.panel;

      render();
      ctrl.events.on('render', () => {
        render();
      });

      function render() {
        clearLegend(elem);
        if (!_.isEmpty(ctrl.data) && !_.isEmpty(ctrl.data.cards)) {
          const rangeFrom = 0;
          const rangeTo = ctrl.data.cardStats.max;
          const maxValue = panel.color.max || rangeTo;
          const minValue = panel.color.min || 0;

          if (panel.color.mode === 'spectrum') {
            const colorScheme = _.find(ctrl.colorSchemes, {
              value: panel.color.colorScheme,
            });
            drawColorLegend(elem, colorScheme, rangeFrom, rangeTo, maxValue, minValue);
          } else if (panel.color.mode === 'opacity') {
            const colorOptions = panel.color;
            drawOpacityLegend(elem, colorOptions, rangeFrom, rangeTo, maxValue, minValue);
          }
        }
      }
    },
  };
});

function drawColorLegend(elem, colorScheme, rangeFrom, rangeTo, maxValue, minValue) {
  const legendElem = $(elem).find('svg');
  const legend = d3.select(legendElem.get(0));
  clearLegend(elem);

  const legendWidth = Math.floor(legendElem.outerWidth()) - 30;
  const legendHeight = legendElem.attr('height');

  let rangeStep = 1;
  if (rangeTo - rangeFrom > legendWidth) {
    rangeStep = Math.floor((rangeTo - rangeFrom) / legendWidth);
  }
  const widthFactor = legendWidth / (rangeTo - rangeFrom);
  const valuesRange = d3.range(rangeFrom, rangeTo, rangeStep);

  const colorScale = getColorScale(colorScheme, contextSrv.user.lightTheme, maxValue, minValue);
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
  const legendElem = $(elem).find('svg');
  const legend = d3.select(legendElem.get(0));
  clearLegend(elem);

  const legendWidth = Math.floor(legendElem.outerWidth()) - 30;
  const legendHeight = legendElem.attr('height');

  let rangeStep = 1;
  if (rangeTo - rangeFrom > legendWidth) {
    rangeStep = Math.floor((rangeTo - rangeFrom) / legendWidth);
  }
  const widthFactor = legendWidth / (rangeTo - rangeFrom);
  const valuesRange = d3.range(rangeFrom, rangeTo, rangeStep);

  const opacityScale = getOpacityScale(options, maxValue, minValue);
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
  const legendElem = $(elem).find('svg');
  const legend = d3.select(legendElem.get(0));

  if (legendWidth <= 0 || legendElem.get(0).childNodes.length === 0) {
    return;
  }

  const legendValueScale = d3
    .scaleLinear()
    .domain([0, rangeTo])
    .range([0, legendWidth]);

  const ticks = buildLegendTicks(0, rangeTo, maxValue, minValue);
  const xAxis = d3
    .axisBottom(legendValueScale)
    .tickValues(ticks)
    .tickSize(LEGEND_TICK_SIZE);

  const colorRect = legendElem.find(':first-child');
  const posY = getSvgElemHeight(legendElem) + LEGEND_VALUE_MARGIN;
  const posX = getSvgElemX(colorRect);

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
  const legendElem = $(elem).find('svg');
  clearLegend(elem);

  const legendWidth = Math.floor(legendElem.outerWidth());
  const legendHeight = legendElem.attr('height');

  if (legendWidth) {
    const valuesNumber = Math.floor(legendWidth / 2);
    const rangeStep = Math.floor(legendWidth / valuesNumber);
    const valuesRange = d3.range(0, legendWidth, rangeStep);

    const legend = d3.select(legendElem.get(0));
    const legendRects = legend.selectAll('.heatmap-color-legend-rect').data(valuesRange);

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
  const legendElem = $(elem).find('svg');
  clearLegend(elem);

  const legend = d3.select(legendElem.get(0));
  const legendWidth = Math.floor(legendElem.outerWidth());
  const legendHeight = legendElem.attr('height');

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

    const rangeStep = 10;
    const valuesRange = d3.range(0, legendWidth, rangeStep);
    const legendRects = legend.selectAll('.heatmap-opacity-legend-rect').data(valuesRange);

    legendRects
      .enter()
      .append('rect')
      .attr('x', d => d)
      .attr('y', 0)
      .attr('width', rangeStep)
      .attr('height', legendHeight)
      .attr('stroke-width', 0)
      .attr(
        'fill',
        getColorFromHexRgbOrName(options.cardColor, contextSrv.user.lightTheme ? GrafanaThemeType.Light : GrafanaThemeType.Dark)
      )
      .style('opacity', d => legendOpacityScale(d));
  }
}

function clearLegend(elem) {
  const legendElem = $(elem).find('svg');
  legendElem.empty();
}

function getSvgElemX(elem) {
  const svgElem = elem.get(0);
  if (svgElem && svgElem.x && svgElem.x.baseVal) {
    return svgElem.x.baseVal.value;
  } else {
    return 0;
  }
}

function getSvgElemHeight(elem) {
  const svgElem = elem.get(0);
  if (svgElem && svgElem.height && svgElem.height.baseVal) {
    return svgElem.height.baseVal.value;
  } else {
    return 0;
  }
}

function buildLegendTicks(rangeFrom, rangeTo, maxValue, minValue) {
  const range = rangeTo - rangeFrom;
  const tickStepSize = tickStep(rangeFrom, rangeTo, 3);
  const ticksNum = Math.round(range / tickStepSize);
  let ticks = [];

  for (let i = 0; i < ticksNum; i++) {
    const current = tickStepSize * i;
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
  const diff = Math.abs(val - valueTo);
  return diff < step * 0.3;
}
