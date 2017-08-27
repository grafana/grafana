///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import kbn from 'app/core/utils/kbn';
import {appEvents, contextSrv} from 'app/core/core';
import {tickStep, getScaledDecimals, getFlotTickSize} from 'app/core/utils/ticks';
import d3 from 'd3';
import {HeatmapTooltip} from './heatmap_tooltip';
import {mergeZeroBuckets} from './heatmap_data_converter';

let MIN_CARD_SIZE = 1,
    CARD_PADDING = 1,
    CARD_ROUND = 0,
    DATA_RANGE_WIDING_FACTOR = 1.2,
    DEFAULT_X_TICK_SIZE_PX = 100,
    DEFAULT_Y_TICK_SIZE_PX = 50,
    X_AXIS_TICK_PADDING = 10,
    Y_AXIS_TICK_PADDING = 5,
    MIN_SELECTION_WIDTH = 2;

export default function link(scope, elem, attrs, ctrl) {
  let data, timeRange, panel, heatmap;

  // $heatmap is JQuery object, but heatmap is D3
  let $heatmap = elem.find('.heatmap-panel');
  let tooltip = new HeatmapTooltip($heatmap, scope);

  let width, height,
      yScale, xScale,
      chartWidth, chartHeight,
      chartTop, chartBottom,
      yAxisWidth, xAxisHeight,
      cardPadding, cardRound,
      cardWidth, cardHeight,
      colorScale, opacityScale,
      mouseUpHandler;

  let selection = {
    active: false,
    x1: -1,
    x2: -1
  };

  let padding = {left: 0, right: 0, top: 0, bottom: 0},
      margin = {left: 25, right: 15, top: 10, bottom: 20},
      dataRangeWidingFactor = DATA_RANGE_WIDING_FACTOR;

  ctrl.events.on('render', () => {
    render();
    ctrl.renderingCompleted();
  });

  function setElementHeight() {
    try {
      var height = ctrl.height || panel.height || ctrl.row.height;
      if (_.isString(height)) {
        height = parseInt(height.replace('px', ''), 10);
      }

      height -= 5; // padding
      height -= panel.title ? 24 : 9; // subtract panel title bar

      $heatmap.css('height', height + 'px');

      return true;
    } catch (e) { // IE throws errors sometimes
      return false;
    }
  }

  function getYAxisWidth(elem) {
    let axis_text = elem.selectAll(".axis-y text").nodes();
    let max_text_width = _.max(_.map(axis_text, text => {
      let el = $(text);
      // Use JQuery outerWidth() to compute full element width
      return el.outerWidth();
    }));

    return max_text_width;
  }

  function getXAxisHeight(elem) {
    let axis_line = elem.select(".axis-x line");
    if (!axis_line.empty()) {
      let axis_line_position = parseFloat(elem.select(".axis-x line").attr("y2"));
      let canvas_width = parseFloat(elem.attr("height"));
      return canvas_width - axis_line_position;
    } else {
      // Default height
      return 30;
    }
  }

  function addXAxis() {
    scope.xScale = xScale = d3.scaleTime()
      .domain([timeRange.from, timeRange.to])
      .range([0, chartWidth]);

    let ticks = chartWidth / DEFAULT_X_TICK_SIZE_PX;
    let grafanaTimeFormatter = grafanaTimeFormat(ticks, timeRange.from, timeRange.to);
    let timeFormat;
    let dashboardTimeZone = ctrl.dashboard.getTimezone();
    if (dashboardTimeZone === 'utc') {
      timeFormat = d3.utcFormat(grafanaTimeFormatter);
    } else {
      timeFormat = d3.timeFormat(grafanaTimeFormatter);
    }

    let xAxis = d3.axisBottom(xScale)
      .ticks(ticks)
      .tickFormat(timeFormat)
      .tickPadding(X_AXIS_TICK_PADDING)
      .tickSize(chartHeight);

    let posY = margin.top;
    let posX = yAxisWidth;
    heatmap.append("g")
      .attr("class", "axis axis-x")
      .attr("transform", "translate(" + posX + "," + posY + ")")
      .call(xAxis);

    // Remove horizontal line in the top of axis labels (called domain in d3)
    heatmap.select(".axis-x").select(".domain").remove();
  }

  function addYAxis() {
    let ticks = Math.ceil(chartHeight / DEFAULT_Y_TICK_SIZE_PX);
    let tick_interval = tickStep(data.heatmapStats.min, data.heatmapStats.max, ticks);
    let {y_min, y_max} = wideYAxisRange(data.heatmapStats.min, data.heatmapStats.max, tick_interval);

    // Rewrite min and max if it have been set explicitly
    y_min = panel.yAxis.min !== null ? panel.yAxis.min : y_min;
    y_max = panel.yAxis.max !== null ? panel.yAxis.max : y_max;

    // Adjust ticks after Y range widening
    tick_interval = tickStep(y_min, y_max, ticks);
    ticks = Math.ceil((y_max - y_min) / tick_interval);

    let decimalsAuto = getPrecision(tick_interval);
    let decimals = panel.yAxis.decimals === null ? decimalsAuto : panel.yAxis.decimals;
    // Calculate scaledDecimals for log scales using tick size (as in jquery.flot.js)
    let flot_tick_size = getFlotTickSize(y_min, y_max, ticks, decimalsAuto);
    let scaledDecimals = getScaledDecimals(decimals, flot_tick_size);
    ctrl.decimals = decimals;
    ctrl.scaledDecimals = scaledDecimals;

    // Set default Y min and max if no data
    if (_.isEmpty(data.buckets)) {
      y_max = 1;
      y_min = -1;
      ticks = 3;
      decimals = 1;
    }

    data.yAxis = {
      min: y_min,
      max: y_max,
      ticks: ticks
    };

    scope.yScale = yScale = d3.scaleLinear()
      .domain([y_min, y_max])
      .range([chartHeight, 0]);

    let yAxis = d3.axisLeft(yScale)
      .ticks(ticks)
      .tickFormat(tickValueFormatter(decimals, scaledDecimals))
      .tickSizeInner(0 - width)
      .tickSizeOuter(0)
      .tickPadding(Y_AXIS_TICK_PADDING);

    heatmap.append("g")
      .attr("class", "axis axis-y")
      .call(yAxis);

    // Calculate Y axis width first, then move axis into visible area
    let posY = margin.top;
    let posX = getYAxisWidth(heatmap) + Y_AXIS_TICK_PADDING;
    heatmap.select(".axis-y").attr("transform", "translate(" + posX + "," + posY + ")");

    // Remove vertical line in the right of axis labels (called domain in d3)
    heatmap.select(".axis-y").select(".domain").remove();
  }

  // Wide Y values range and anjust to bucket size
  function wideYAxisRange(min, max, tickInterval) {
    let y_widing = (max * (dataRangeWidingFactor - 1) - min * (dataRangeWidingFactor - 1)) / 2;
    let y_min, y_max;

    if (tickInterval === 0) {
      y_max = max * dataRangeWidingFactor;
      y_min = min - min * (dataRangeWidingFactor - 1);
      tickInterval = (y_max - y_min) / 2;
    } else {
      y_max = Math.ceil((max + y_widing) / tickInterval) * tickInterval;
      y_min = Math.floor((min - y_widing) / tickInterval) * tickInterval;
    }

    // Don't wide axis below 0 if all values are positive
    if (min >= 0 && y_min < 0) {
      y_min = 0;
    }

    return {y_min, y_max};
  }

  function addLogYAxis() {
    let log_base = panel.yAxis.logBase;
    let {y_min, y_max} = adjustLogRange(data.heatmapStats.minLog, data.heatmapStats.max, log_base);

    y_min = panel.yAxis.min && panel.yAxis.min !== '0' ? adjustLogMin(panel.yAxis.min, log_base) : y_min;
    y_max = panel.yAxis.max !== null ? adjustLogMax(panel.yAxis.max, log_base) : y_max;

    // Set default Y min and max if no data
    if (_.isEmpty(data.buckets)) {
      y_max = Math.pow(log_base, 2);
      y_min = 1;
    }

    scope.yScale = yScale = d3.scaleLog()
      .base(panel.yAxis.logBase)
      .domain([y_min, y_max])
      .range([chartHeight, 0]);

    let domain = yScale.domain();
    let tick_values = logScaleTickValues(domain, log_base);

    let decimalsAuto = getPrecision(y_min);
    let decimals = panel.yAxis.decimals || decimalsAuto;

    // Calculate scaledDecimals for log scales using tick size (as in jquery.flot.js)
    let flot_tick_size = getFlotTickSize(y_min, y_max, tick_values.length, decimalsAuto);
    let scaledDecimals = getScaledDecimals(decimals, flot_tick_size);
    ctrl.decimals = decimals;
    ctrl.scaledDecimals = scaledDecimals;

    data.yAxis = {
      min: y_min,
      max: y_max,
      ticks: tick_values.length
    };

    let yAxis = d3.axisLeft(yScale)
      .tickValues(tick_values)
      .tickFormat(tickValueFormatter(decimals, scaledDecimals))
      .tickSizeInner(0 - width)
      .tickSizeOuter(0)
      .tickPadding(Y_AXIS_TICK_PADDING);

    heatmap.append("g")
      .attr("class", "axis axis-y")
      .call(yAxis);

    // Calculate Y axis width first, then move axis into visible area
    let posY = margin.top;
    let posX = getYAxisWidth(heatmap) + Y_AXIS_TICK_PADDING;
    heatmap.select(".axis-y").attr("transform", "translate(" + posX + "," + posY + ")");

    // Set first tick as pseudo 0
    if (y_min < 1) {
      heatmap.select(".axis-y").select(".tick text").text("0");
    }

    // Remove vertical line in the right of axis labels (called domain in d3)
    heatmap.select(".axis-y").select(".domain").remove();
  }

  // Adjust data range to log base
  function adjustLogRange(min, max, logBase) {
    let y_min, y_max;

    y_min = data.heatmapStats.minLog;
    if (data.heatmapStats.minLog > 1 || !data.heatmapStats.minLog) {
      y_min = 1;
    } else {
      y_min = adjustLogMin(data.heatmapStats.minLog, logBase);
    }

    // Adjust max Y value to log base
    y_max = adjustLogMax(data.heatmapStats.max, logBase);

    return {y_min, y_max};
  }

  function adjustLogMax(max, base) {
    return Math.pow(base, Math.ceil(logp(max, base)));
  }

  function adjustLogMin(min, base) {
    return Math.pow(base, Math.floor(logp(min, base)));
  }

  function logScaleTickValues(domain, base) {
    let domainMin = domain[0];
    let domainMax = domain[1];
    let tickValues = [];

    if (domainMin < 1) {
      let under_one_ticks = Math.floor(logp(domainMin, base));
      for (let i = under_one_ticks; i < 0; i++) {
        let tick_value = Math.pow(base, i);
        tickValues.push(tick_value);
      }
    }

    let ticks = Math.ceil(logp(domainMax, base));
    for (let i = 0; i <= ticks; i++) {
      let tick_value = Math.pow(base, i);
      tickValues.push(tick_value);
    }

    return tickValues;
  }

  function tickValueFormatter(decimals, scaledDecimals = null) {
    let format = panel.yAxis.format;
    return function(value) {
      return kbn.valueFormats[format](value, decimals, scaledDecimals);
    };
  }

  function fixYAxisTickSize() {
    heatmap.select(".axis-y")
      .selectAll(".tick line")
      .attr("x2", chartWidth);
  }

  function addAxes() {
    chartHeight = height - margin.top - margin.bottom;
    chartTop = margin.top;
    chartBottom = chartTop + chartHeight;

    if (panel.yAxis.logBase === 1) {
      addYAxis();
    } else {
      addLogYAxis();
    }

    yAxisWidth = getYAxisWidth(heatmap) + Y_AXIS_TICK_PADDING;
    chartWidth = width - yAxisWidth - margin.right;
    fixYAxisTickSize();

    addXAxis();
    xAxisHeight = getXAxisHeight(heatmap);

    if (!panel.yAxis.show) {
      heatmap.select(".axis-y").selectAll("line").style("opacity", 0);
    }

    if (!panel.xAxis.show) {
      heatmap.select(".axis-x").selectAll("line").style("opacity", 0);
    }
  }

  function addHeatmapCanvas() {
    let heatmap_elem = $heatmap[0];

    width = Math.floor($heatmap.width()) - padding.right;
    height = Math.floor($heatmap.height()) - padding.bottom;

    cardPadding = panel.cards.cardPadding !== null ? panel.cards.cardPadding : CARD_PADDING;
    cardRound = panel.cards.cardRound !== null ? panel.cards.cardRound : CARD_ROUND;

    if (heatmap) {
      heatmap.remove();
    }

    heatmap = d3.select(heatmap_elem)
      .append("svg")
      .attr("width", width)
      .attr("height", height);
  }

  function addHeatmap() {
    addHeatmapCanvas();
    addAxes();

    if (panel.yAxis.logBase !== 1) {
      let log_base = panel.yAxis.logBase;
      let domain = yScale.domain();
      let tick_values = logScaleTickValues(domain, log_base);
      data.buckets = mergeZeroBuckets(data.buckets, _.min(tick_values));
    }

    let cardsData = data.cards;
    let maxValueAuto = data.cardStats.max;
    let maxValue = panel.color.max || maxValueAuto;
    let minValue = panel.color.min || 0;

    colorScale = getColorScale(maxValue, minValue);
    setOpacityScale(maxValue);
    setCardSize();

    let cards = heatmap.selectAll(".heatmap-card").data(cardsData);
    cards.append("title");
    cards = cards.enter().append("rect")
    .attr("x", getCardX)
    .attr("width", getCardWidth)
    .attr("y", getCardY)
    .attr("height", getCardHeight)
    .attr("rx", cardRound)
    .attr("ry", cardRound)
    .attr("class", "bordered heatmap-card")
    .style("fill", getCardColor)
    .style("stroke", getCardColor)
    .style("stroke-width", 0)
    .style("opacity", getCardOpacity);

    let $cards = $heatmap.find(".heatmap-card");
    $cards.on("mouseenter", (event) => {
      tooltip.mouseOverBucket = true;
      highlightCard(event);
    })
    .on("mouseleave", (event) => {
      tooltip.mouseOverBucket = false;
      resetCardHighLight(event);
    });
  }

  function highlightCard(event) {
    let color = d3.select(event.target).style("fill");
    let highlightColor = d3.color(color).darker(2);
    let strokeColor = d3.color(color).brighter(4);
    let current_card = d3.select(event.target);
    tooltip.originalFillColor = color;
    current_card.style("fill", highlightColor)
    .style("stroke", strokeColor)
    .style("stroke-width", 1);
  }

  function resetCardHighLight(event) {
    d3.select(event.target).style("fill", tooltip.originalFillColor)
    .style("stroke", tooltip.originalFillColor)
    .style("stroke-width", 0);
  }

  function getColorScale(maxValue, minValue = 0) {
    let colorScheme = _.find(ctrl.colorSchemes, {value: panel.color.colorScheme});
    let colorInterpolator = d3[colorScheme.value];
    let colorScaleInverted = colorScheme.invert === 'always' ||
      (colorScheme.invert === 'dark' && !contextSrv.user.lightTheme);

    let start = colorScaleInverted ? maxValue : minValue;
    let end = colorScaleInverted ? minValue : maxValue;

    return d3.scaleSequential(colorInterpolator).domain([start, end]);
  }

  function setOpacityScale(maxValue) {
    if (panel.color.colorScale === 'linear') {
      opacityScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([0, 1]);
    } else if (panel.color.colorScale === 'sqrt') {
      opacityScale = d3.scalePow().exponent(panel.color.exponent)
      .domain([0, maxValue])
      .range([0, 1]);
    }
  }

  function setCardSize() {
    let xGridSize = Math.floor(xScale(data.xBucketSize) - xScale(0));
    let yGridSize = Math.floor(yScale(yScale.invert(0) - data.yBucketSize));

    if (panel.yAxis.logBase !== 1) {
      let base = panel.yAxis.logBase;
      let splitFactor = data.yBucketSize || 1;
      yGridSize = Math.floor((yScale(1) - yScale(base)) / splitFactor);
    }

    cardWidth = xGridSize - cardPadding * 2;
    cardHeight = yGridSize ? yGridSize - cardPadding * 2 : 0;
  }

  function getCardX(d) {
    let x;
    if (xScale(d.x) < 0) {
      // Cut card left to prevent overlay
      x = yAxisWidth + cardPadding;
    } else {
      x = xScale(d.x) + yAxisWidth + cardPadding;
    }

    return x;
  }

  function getCardWidth(d) {
    let w;
    if (xScale(d.x) < 0) {
      // Cut card left to prevent overlay
      let cutted_width = xScale(d.x) + cardWidth;
      w = cutted_width > 0 ? cutted_width : 0;
    } else if (xScale(d.x) + cardWidth > chartWidth) {
      // Cut card right to prevent overlay
      w = chartWidth - xScale(d.x) - cardPadding;
    } else {
      w = cardWidth;
    }

    // Card width should be MIN_CARD_SIZE at least
    w = Math.max(w, MIN_CARD_SIZE);
    return w;
  }

  function getCardY(d) {
    let y = yScale(d.y) + chartTop - cardHeight - cardPadding;
    if (panel.yAxis.logBase !== 1 && d.y === 0) {
      y = chartBottom - cardHeight - cardPadding;
    } else {
      if (y < chartTop) {
        y = chartTop;
      }
    }

    return y;
  }

  function getCardHeight(d) {
    let y = yScale(d.y) + chartTop - cardHeight - cardPadding;
    let h = cardHeight;

    if (panel.yAxis.logBase !== 1 && d.y === 0) {
      return cardHeight;
    }

    // Cut card height to prevent overlay
    if (y < chartTop) {
      h = yScale(d.y) - cardPadding;
    } else if (yScale(d.y) > chartBottom) {
      h = chartBottom - y;
    } else if (y + cardHeight > chartBottom) {
      h = chartBottom - y;
    }

    // Height can't be more than chart height
    h = Math.min(h, chartHeight);
    // Card height should be MIN_CARD_SIZE at least
    h = Math.max(h, MIN_CARD_SIZE);

    return h;
  }

  function getCardColor(d) {
    if (panel.color.mode === 'opacity') {
      return panel.color.cardColor;
    } else {
      return colorScale(d.count);
    }
  }

  function getCardOpacity(d) {
    if (panel.color.mode === 'opacity') {
      return opacityScale(d.count);
    } else {
      return 1;
    }
  }

  /////////////////////////////
  // Selection and crosshair //
  /////////////////////////////

  // Shared crosshair and tooltip
  appEvents.on('graph-hover', event => {
    drawSharedCrosshair(event.pos);
  }, scope);

  appEvents.on('graph-hover-clear', () => {
    clearCrosshair();
  }, scope);

  function onMouseDown(event) {
    selection.active = true;
    selection.x1 = event.offsetX;

    mouseUpHandler = function() {
      onMouseUp();
    };

    $(document).one("mouseup", mouseUpHandler);
  }

  function onMouseUp() {
    $(document).unbind("mouseup", mouseUpHandler);
    mouseUpHandler = null;
    selection.active = false;

    let selectionRange = Math.abs(selection.x2 - selection.x1);
    if (selection.x2 >= 0 && selectionRange > MIN_SELECTION_WIDTH) {
      let timeFrom = xScale.invert(Math.min(selection.x1, selection.x2) - yAxisWidth);
      let timeTo = xScale.invert(Math.max(selection.x1, selection.x2) - yAxisWidth);

      ctrl.timeSrv.setTime({
        from: moment.utc(timeFrom),
        to: moment.utc(timeTo)
      });
    }

    clearSelection();
  }

  function onMouseLeave() {
    appEvents.emit('graph-hover-clear');
    clearCrosshair();
  }

  function onMouseMove(event) {
    if (!heatmap) { return; }

    if (selection.active) {
      // Clear crosshair and tooltip
      clearCrosshair();
      tooltip.destroy();

      selection.x2 = limitSelection(event.offsetX);
      drawSelection(selection.x1, selection.x2);
    } else {
      emitGraphHoverEvet(event);
      drawCrosshair(event.offsetX);
      tooltip.show(event, data);
    }
  }

  function emitGraphHoverEvet(event) {
    let x = xScale.invert(event.offsetX - yAxisWidth).valueOf();
    let y = yScale.invert(event.offsetY);
    let pos = {
      pageX: event.pageX,
      pageY: event.pageY,
      x: x, x1: x,
      y: y, y1: y,
      panelRelY: null
    };

    // Set minimum offset to prevent showing legend from another panel
    pos.panelRelY = Math.max(event.offsetY / height, 0.001);

    // broadcast to other graph panels that we are hovering
    appEvents.emit('graph-hover', {pos: pos, panel: panel});
  }

  function limitSelection(x2) {
    x2 = Math.max(x2, yAxisWidth);
    x2 = Math.min(x2, chartWidth + yAxisWidth);
    return x2;
  }

  function drawSelection(posX1, posX2) {
    if (heatmap) {
      heatmap.selectAll(".heatmap-selection").remove();
      let selectionX = Math.min(posX1, posX2);
      let selectionWidth = Math.abs(posX1 - posX2);

      if (selectionWidth > MIN_SELECTION_WIDTH) {
        heatmap.append("rect")
        .attr("class", "heatmap-selection")
        .attr("x", selectionX)
        .attr("width", selectionWidth)
        .attr("y", chartTop)
        .attr("height", chartHeight);
      }
    }
  }

  function clearSelection() {
    selection.x1 = -1;
    selection.x2 = -1;

    if (heatmap) {
      heatmap.selectAll(".heatmap-selection").remove();
    }
  }

  function drawCrosshair(position) {
    if (heatmap) {
      heatmap.selectAll(".heatmap-crosshair").remove();

      let posX = position;
      posX = Math.max(posX, yAxisWidth);
      posX = Math.min(posX, chartWidth + yAxisWidth);

      heatmap.append("g")
      .attr("class", "heatmap-crosshair")
      .attr("transform", "translate(" + posX + ",0)")
      .append("line")
      .attr("x1", 1)
      .attr("y1", chartTop)
      .attr("x2", 1)
      .attr("y2", chartBottom)
      .attr("stroke-width", 1);
    }
  }

  function drawSharedCrosshair(pos) {
    if (heatmap && ctrl.dashboard.graphTooltip !== 0) {
      let posX = xScale(pos.x) + yAxisWidth;
      drawCrosshair(posX);
    }
  }

  function clearCrosshair() {
    if (heatmap) {
      heatmap.selectAll(".heatmap-crosshair").remove();
    }
  }

  function render() {
    data = ctrl.data;
    panel = ctrl.panel;
    timeRange = ctrl.range;

    if (!setElementHeight() || !data) {
      return;
    }

    // Draw default axes and return if no data
    if (_.isEmpty(data.buckets)) {
      addHeatmapCanvas();
      addAxes();
      return;
    }

    addHeatmap();
    scope.yAxisWidth = yAxisWidth;
    scope.xAxisHeight = xAxisHeight;
    scope.chartHeight = chartHeight;
    scope.chartWidth = chartWidth;
    scope.chartTop = chartTop;
  }

  // Register selection listeners
  $heatmap.on("mousedown", onMouseDown);
  $heatmap.on("mousemove", onMouseMove);
  $heatmap.on("mouseleave", onMouseLeave);
}

function grafanaTimeFormat(ticks, min, max) {
  if (min && max && ticks) {
    let range = max - min;
    let secPerTick = (range/ticks) / 1000;
    let oneDay = 86400000;
    let oneYear = 31536000000;

    if (secPerTick <= 45) {
      return "%H:%M:%S";
    }
    if (secPerTick <= 7200 || range <= oneDay) {
      return "%H:%M";
    }
    if (secPerTick <= 80000) {
      return "%m/%d %H:%M";
    }
    if (secPerTick <= 2419200 || range <= oneYear) {
      return "%m/%d";
    }
    return "%Y-%m";
  }

  return "%H:%M";
}

function logp(value, base) {
  return Math.log(value) / Math.log(base);
}

function getPrecision(num) {
  let str = num.toString();
  let dot_index = str.indexOf(".");
  if (dot_index === -1) {
    return 0;
  } else {
    return str.length - dot_index - 1;
  }
}
