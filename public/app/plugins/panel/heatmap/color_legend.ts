///<reference path="../../../headers/common.d.ts" />
import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import d3 from 'd3';
import {contextSrv} from 'app/core/core';

let module = angular.module('grafana.directives');
module.directive('colorLegend', function() {
  return {
    restrict: 'E',
    template: '<div class="heatmap-color-legend"><svg width="19em" height="2em"></svg></div>',
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
          let colorScheme = _.find(ctrl.colorSchemes, {value: panel.color.colorScheme});
          let colorScale = getColorScale(colorScheme, legendWidth);
          drawColorLegend(elem, colorScale);
        } else if (panel.color.mode === 'opacity') {
          let colorOptions = panel.color;
          drawOpacityLegend(elem, colorOptions);
        }
      }
    }
  };
});

module.directive('heatmapLegend', function() {
  return {
    restrict: 'E',
    template: '<div class="heatmap-color-legend"><svg width="19em" height="2em"></svg></div>',
    link: function(scope, elem, attrs) {
      let ctrl = scope.ctrl;
      let panel = scope.ctrl.panel;

      ctrl.events.on('render', function() {
        if (!_.isEmpty(ctrl.data)) {
          let legendElem = $(elem).find('svg');
          let legendWidth = Math.floor(legendElem.outerWidth());

          if (panel.color.mode === 'spectrum') {
            let colorScheme = _.find(ctrl.colorSchemes, {value: panel.color.colorScheme});
            let colorScale = getColorScale(colorScheme, legendWidth);
            drawColorLegend(elem, colorScale);
          } else if (panel.color.mode === 'opacity') {
            let colorOptions = panel.color;
            drawOpacityLegend(elem, colorOptions);
          }
        }
      });
    }
  };
});

function drawColorLegend(elem, colorScale) {
  let legendElem = $(elem).find('svg');
  legendElem.find("rect").remove();

  let legendWidth = Math.floor(legendElem.outerWidth());
  let legendHeight = legendElem.attr("height");

  let rangeStep = 2;
  let valuesRange = d3.range(0, legendWidth, rangeStep);

  let legend = d3.select(legendElem.get(0));
  var legendRects = legend.selectAll(".heatmap-color-legend-rect").data(valuesRange);

  legendRects.enter().append("rect")
  .attr("x", d => d)
  .attr("y", 0)
  .attr("width", rangeStep + 1) // Overlap rectangles to prevent gaps
  .attr("height", legendHeight)
  .attr("stroke-width", 0)
  .attr("fill", d => colorScale(d));
}

function clearLegend(elem) {
  let legendElem = $(elem).find('svg');
  legendElem.find("rect").remove();
}

function drawOpacityLegend(elem, options) {
  let legendElem = $(elem).find('svg');
  clearLegend(elem);

  let legend = d3.select(legendElem.get(0));
  let legendWidth = Math.floor(legendElem.outerWidth());
  let legendHeight = legendElem.attr("height");

  let legendOpacityScale;
  if (options.colorScale === 'linear') {
    legendOpacityScale = d3.scaleLinear()
    .domain([0, legendWidth])
    .range([0, 1]);
  } else if (options.colorScale === 'sqrt') {
    legendOpacityScale = d3.scalePow().exponent(options.exponent)
    .domain([0, legendWidth])
    .range([0, 1]);
  }

  let rangeStep = 1;
  let valuesRange = d3.range(0, legendWidth, rangeStep);
  var legendRects = legend.selectAll(".heatmap-opacity-legend-rect").data(valuesRange);

  legendRects.enter().append("rect")
  .attr("x", d => d)
  .attr("y", 0)
  .attr("width", rangeStep)
  .attr("height", legendHeight)
  .attr("stroke-width", 0)
  .attr("fill", options.cardColor)
  .style("opacity", d => legendOpacityScale(d));
}

function getColorScale(colorScheme, maxValue, minValue = 0) {
  let colorInterpolator = d3[colorScheme.value];
  let colorScaleInverted = colorScheme.invert === 'always' ||
    (colorScheme.invert === 'dark' && !contextSrv.user.lightTheme);

  let start = colorScaleInverted ? maxValue : minValue;
  let end = colorScaleInverted ? minValue : maxValue;

  return d3.scaleSequential(colorInterpolator).domain([start, end]);
}
