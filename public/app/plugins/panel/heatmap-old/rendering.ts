import * as d3 from 'd3';
import $ from 'jquery';
import { find, isEmpty, isNaN, isNil, isString, map, max, min, toNumber } from 'lodash';

import {
  dateTimeFormat,
  formattedValueToString,
  getValueFormat,
  LegacyGraphHoverClearEvent,
  LegacyGraphHoverEvent,
  PanelEvents,
  toUtc,
} from '@grafana/data';
import { graphTimeFormat } from '@grafana/ui';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/core';
import * as ticksUtils from 'app/core/utils/ticks';

import { getColorScale, getOpacityScale } from './color_scale';
import { mergeZeroBuckets } from './heatmap_data_converter';
import { HeatmapTooltip } from './heatmap_tooltip';

const MIN_CARD_SIZE = 1,
  CARD_PADDING = 1,
  CARD_ROUND = 0,
  DATA_RANGE_WIDING_FACTOR = 1.2,
  DEFAULT_X_TICK_SIZE_PX = 100,
  DEFAULT_Y_TICK_SIZE_PX = 22.5,
  X_AXIS_TICK_PADDING = 10,
  Y_AXIS_TICK_PADDING = 5,
  MIN_SELECTION_WIDTH = 2;

export default function rendering(scope: any, elem: any, attrs: any, ctrl: any) {
  return new HeatmapRenderer(scope, elem, attrs, ctrl);
}
export class HeatmapRenderer {
  width = 200;
  height = 200;
  yScale: any;
  xScale: any;
  chartWidth = 0;
  chartHeight = 0;
  chartTop = 0;
  chartBottom = 0;
  yAxisWidth = 0;
  xAxisHeight = 0;
  cardPadding = 0;
  cardRound = 0;
  cardWidth = 0;
  cardHeight = 0;
  colorScale: any;
  opacityScale: any;
  mouseUpHandler: any;
  data: any;
  panel: any;
  $heatmap: any;
  tooltip: HeatmapTooltip;
  heatmap: any;
  timeRange: any;

  selection: any;
  padding: any;
  margin: any;
  dataRangeWidingFactor: number;

  hoverEvent: LegacyGraphHoverEvent;

  constructor(private scope: any, private elem: any, attrs: any, private ctrl: any) {
    // $heatmap is JQuery object, but heatmap is D3
    this.$heatmap = this.elem.find('.heatmap-panel');
    this.tooltip = new HeatmapTooltip(this.$heatmap, this.scope);

    this.selection = {
      active: false,
      x1: -1,
      x2: -1,
    };

    this.padding = { left: 0, right: 0, top: 0, bottom: 0 };
    this.margin = { left: 25, right: 15, top: 10, bottom: 20 };
    this.dataRangeWidingFactor = DATA_RANGE_WIDING_FACTOR;
    this.ctrl.events.on(PanelEvents.render, this.onRender.bind(this));
    this.ctrl.tickValueFormatter = this.tickValueFormatter.bind(this);

    /////////////////////////////
    // Selection and crosshair //
    /////////////////////////////

    // Shared crosshair and tooltip
    this.ctrl.dashboard.events.on(LegacyGraphHoverEvent.type, this.onGraphHover.bind(this), this.scope);
    this.ctrl.dashboard.events.on(LegacyGraphHoverClearEvent.type, this.onGraphHoverClear.bind(this), this.scope);

    // Register selection listeners
    this.$heatmap.on('mousedown', this.onMouseDown.bind(this));
    this.$heatmap.on('mousemove', this.onMouseMove.bind(this));
    this.$heatmap.on('mouseleave', this.onMouseLeave.bind(this));

    this.hoverEvent = new LegacyGraphHoverEvent({ pos: {}, point: {}, panel: this.panel });
  }

  onGraphHoverClear() {
    this.clearCrosshair();
  }

  onGraphHover(event: { pos: any }) {
    this.drawSharedCrosshair(event.pos);
  }

  onRender() {
    this.render();
    this.ctrl.renderingCompleted();
  }

  setElementHeight() {
    try {
      let height = this.ctrl.height || this.panel.height || this.ctrl.row.height;
      if (isString(height)) {
        height = parseInt(height.replace('px', ''), 10);
      }

      height -= this.panel.legend.show ? 28 : 11; // bottom padding and space for legend

      this.$heatmap.css('height', height + 'px');

      return true;
    } catch (e) {
      // IE throws errors sometimes
      return false;
    }
  }

  getYAxisWidth(elem: any) {
    const panelYAxisWidth = this.getPanelYAxisWidth();
    if (panelYAxisWidth !== null) {
      return panelYAxisWidth + Y_AXIS_TICK_PADDING;
    }

    const axisText = elem.selectAll('.axis-y text').nodes();
    const maxTextWidth = max(
      map(axisText, (text) => {
        // Use SVG getBBox method
        return text.getBBox().width;
      })
    );

    return maxTextWidth;
  }

  getXAxisHeight(elem: any) {
    const axisLine = elem.select('.axis-x line');
    if (!axisLine.empty()) {
      const axisLinePosition = parseFloat(elem.select('.axis-x line').attr('y2'));
      const canvasWidth = parseFloat(elem.attr('height'));
      return canvasWidth - axisLinePosition;
    } else {
      // Default height
      return 30;
    }
  }

  addXAxis() {
    this.scope.xScale = this.xScale = d3
      .scaleTime()
      .domain([this.timeRange.from, this.timeRange.to])
      .range([0, this.chartWidth]);

    const ticks = this.chartWidth / DEFAULT_X_TICK_SIZE_PX;
    const format = graphTimeFormat(ticks, this.timeRange.from.valueOf(), this.timeRange.to.valueOf());
    const timeZone = this.ctrl.dashboard.getTimezone();
    const formatter = (date: d3.AxisDomain) =>
      dateTimeFormat(date.valueOf(), {
        format: format,
        timeZone: timeZone,
      });

    const xAxis = d3
      .axisBottom(this.xScale)
      .ticks(ticks)
      .tickFormat(formatter)
      .tickPadding(X_AXIS_TICK_PADDING)
      .tickSize(this.chartHeight);

    const posY = this.margin.top;
    const posX = this.yAxisWidth;
    this.heatmap
      .append('g')
      .attr('class', 'axis axis-x')
      .attr('transform', 'translate(' + posX + ',' + posY + ')')
      .call(xAxis);

    // Remove horizontal line in the top of axis labels (called domain in d3)
    this.heatmap.select('.axis-x').select('.domain').remove();
  }

  addYAxis() {
    let ticks = Math.ceil(this.chartHeight / DEFAULT_Y_TICK_SIZE_PX);
    let tickInterval = ticksUtils.tickStep(this.data.heatmapStats.min, this.data.heatmapStats.max, ticks);
    let { yMin, yMax } = this.wideYAxisRange(this.data.heatmapStats.min, this.data.heatmapStats.max, tickInterval);

    // Rewrite min and max if it have been set explicitly
    yMin = this.panel.yAxis.min !== null ? this.panel.yAxis.min : yMin;
    yMax = this.panel.yAxis.max !== null ? this.panel.yAxis.max : yMax;

    // Adjust ticks after Y range widening
    tickInterval = ticksUtils.tickStep(yMin, yMax, ticks);
    ticks = Math.ceil((yMax - yMin) / tickInterval);

    const decimalsAuto = ticksUtils.getPrecision(tickInterval);
    let decimals = this.panel.yAxis.decimals === null ? decimalsAuto : this.panel.yAxis.decimals;
    // Calculate scaledDecimals for log scales using tick size (as in jquery.flot.js)
    const flotTickSize = ticksUtils.getFlotTickSize(yMin, yMax, ticks, decimalsAuto);
    const scaledDecimals = ticksUtils.getScaledDecimals(decimals, flotTickSize);
    this.ctrl.decimals = decimals;
    this.ctrl.scaledDecimals = scaledDecimals;

    // Set default Y min and max if no data
    if (isEmpty(this.data.buckets)) {
      yMax = 1;
      yMin = -1;
      ticks = 3;
      decimals = 1;
    }

    this.data.yAxis = {
      min: yMin,
      max: yMax,
      ticks: ticks,
    };

    this.scope.yScale = this.yScale = d3.scaleLinear().domain([yMin, yMax]).range([this.chartHeight, 0]);

    const yAxis = d3
      .axisLeft(this.yScale)
      .ticks(ticks)
      .tickFormat(this.tickValueFormatter(decimals, scaledDecimals))
      .tickSizeInner(0 - this.width)
      .tickSizeOuter(0)
      .tickPadding(Y_AXIS_TICK_PADDING);

    this.heatmap.append('g').attr('class', 'axis axis-y').call(yAxis);

    // Calculate Y axis width first, then move axis into visible area
    const posY = this.margin.top;
    const posX = this.getYAxisWidth(this.heatmap) + Y_AXIS_TICK_PADDING;
    this.heatmap.select('.axis-y').attr('transform', 'translate(' + posX + ',' + posY + ')');

    // Remove vertical line in the right of axis labels (called domain in d3)
    this.heatmap.select('.axis-y').select('.domain').remove();
  }

  // Wide Y values range and anjust to bucket size
  wideYAxisRange(min: number, max: number, tickInterval: number) {
    const yWiding = (max * (this.dataRangeWidingFactor - 1) - min * (this.dataRangeWidingFactor - 1)) / 2;
    let yMin, yMax;

    if (tickInterval === 0) {
      yMax = max * this.dataRangeWidingFactor;
      yMin = min - min * (this.dataRangeWidingFactor - 1);
    } else {
      yMax = Math.ceil((max + yWiding) / tickInterval) * tickInterval;
      yMin = Math.floor((min - yWiding) / tickInterval) * tickInterval;
    }

    // Don't wide axis below 0 if all values are positive
    if (min >= 0 && yMin < 0) {
      yMin = 0;
    }

    return { yMin, yMax };
  }

  addLogYAxis() {
    const logBase = this.panel.yAxis.logBase;
    let { yMin, yMax } = this.adjustLogRange(this.data.heatmapStats.minLog, this.data.heatmapStats.max, logBase);

    yMin =
      this.panel.yAxis.min && this.panel.yAxis.min !== '0' ? this.adjustLogMin(this.panel.yAxis.min, logBase) : yMin;
    yMax = this.panel.yAxis.max !== null ? this.adjustLogMax(this.panel.yAxis.max, logBase) : yMax;

    // Set default Y min and max if no data
    if (isEmpty(this.data.buckets)) {
      yMax = Math.pow(logBase, 2);
      yMin = 1;
    }

    this.scope.yScale = this.yScale = d3
      .scaleLog()
      .base(this.panel.yAxis.logBase)
      .domain([yMin, yMax])
      .range([this.chartHeight, 0]);

    const domain = this.yScale.domain();
    const tickValues = this.logScaleTickValues(domain, logBase);

    const decimalsAuto = ticksUtils.getPrecision(yMin);
    const decimals = this.panel.yAxis.decimals || decimalsAuto;

    // Calculate scaledDecimals for log scales using tick size (as in jquery.flot.js)
    const flotTickSize = ticksUtils.getFlotTickSize(yMin, yMax, tickValues.length, decimalsAuto);
    const scaledDecimals = ticksUtils.getScaledDecimals(decimals, flotTickSize);
    this.ctrl.decimals = decimals;
    this.ctrl.scaledDecimals = scaledDecimals;

    this.data.yAxis = {
      min: yMin,
      max: yMax,
      ticks: tickValues.length,
    };

    const yAxis = d3
      .axisLeft(this.yScale)
      .tickValues(tickValues)
      .tickFormat(this.tickValueFormatter(decimals, scaledDecimals))
      .tickSizeInner(0 - this.width)
      .tickSizeOuter(0)
      .tickPadding(Y_AXIS_TICK_PADDING);

    this.heatmap.append('g').attr('class', 'axis axis-y').call(yAxis);

    // Calculate Y axis width first, then move axis into visible area
    const posY = this.margin.top;
    const posX = this.getYAxisWidth(this.heatmap) + Y_AXIS_TICK_PADDING;
    this.heatmap.select('.axis-y').attr('transform', 'translate(' + posX + ',' + posY + ')');

    // Set first tick as pseudo 0
    if (yMin < 1) {
      this.heatmap.select('.axis-y').select('.tick text').text('0');
    }

    // Remove vertical line in the right of axis labels (called domain in d3)
    this.heatmap.select('.axis-y').select('.domain').remove();
  }

  addYAxisFromBuckets() {
    const tsBuckets = this.data.tsBuckets;
    let ticks = Math.ceil(this.chartHeight / DEFAULT_Y_TICK_SIZE_PX);

    this.scope.yScale = this.yScale = d3
      .scaleLinear()
      .domain([0, tsBuckets.length - 1])
      .range([this.chartHeight, 0]);

    const tickValues = map(tsBuckets, (b, i) => i);
    const decimalsAuto = max(map(tsBuckets, ticksUtils.getStringPrecision));
    const decimals = this.panel.yAxis.decimals === null ? decimalsAuto : this.panel.yAxis.decimals;
    this.ctrl.decimals = decimals;

    const tickValueFormatter = this.tickValueFormatter.bind(this);
    function tickFormatter(yAxisWidth: number | null) {
      return function (valIndex: d3.AxisDomain) {
        let valueFormatted = tsBuckets[valIndex.valueOf()];
        if (!isNaN(toNumber(valueFormatted)) && valueFormatted !== '') {
          // Try to format numeric tick labels
          valueFormatted = tickValueFormatter(decimals)(toNumber(valueFormatted));
        } else if (valueFormatted && typeof valueFormatted === 'string' && valueFormatted !== '') {
          if (yAxisWidth) {
            const scale = 0.15; // how to have a better calculation for this
            const trimmed = valueFormatted.substring(0, Math.floor(yAxisWidth * scale));
            const postfix = trimmed.length < valueFormatted.length ? '...' : '';
            valueFormatted = `${trimmed}${postfix}`;
          }
        }
        return valueFormatted;
      };
    }
    const tsBucketsFormatted = map(tsBuckets, (v, i) => tickFormatter(null)(i));
    this.data.tsBucketsFormatted = tsBucketsFormatted;

    const yAxis = d3
      .axisLeft(this.yScale)
      .tickFormat(tickFormatter(this.getPanelYAxisWidth()))
      .tickSizeInner(0 - this.width)
      .tickSizeOuter(0)
      .tickPadding(Y_AXIS_TICK_PADDING);
    if (tickValues && tickValues.length <= ticks) {
      yAxis.tickValues(tickValues);
    } else {
      yAxis.ticks(ticks);
    }

    this.heatmap.append('g').attr('class', 'axis axis-y').call(yAxis);

    // Calculate Y axis width first, then move axis into visible area
    const posY = this.margin.top;
    const posX = this.getYAxisWidth(this.heatmap) + Y_AXIS_TICK_PADDING;
    this.heatmap.select('.axis-y').attr('transform', 'translate(' + posX + ',' + posY + ')');

    if (this.panel.yBucketBound === 'middle' && tickValues && tickValues.length) {
      // Shift Y axis labels to the middle of bucket
      const tickShift = 0 - this.chartHeight / (tickValues.length - 1) / 2;
      this.heatmap.selectAll('.axis-y text').attr('transform', 'translate(' + 0 + ',' + tickShift + ')');
    }

    // Remove vertical line in the right of axis labels (called domain in d3)
    this.heatmap.select('.axis-y').select('.domain').remove();
  }

  // Adjust data range to log base
  adjustLogRange(min: number, max: number, logBase: number) {
    let yMin = this.data.heatmapStats.minLog;
    if (this.data.heatmapStats.minLog > 1 || !this.data.heatmapStats.minLog) {
      yMin = 1;
    } else {
      yMin = this.adjustLogMin(this.data.heatmapStats.minLog, logBase);
    }

    // Adjust max Y value to log base
    const yMax = this.adjustLogMax(this.data.heatmapStats.max, logBase);

    return { yMin, yMax };
  }

  adjustLogMax(max: number, base: number) {
    return Math.pow(base, Math.ceil(ticksUtils.logp(max, base)));
  }

  adjustLogMin(min: number, base: number) {
    return Math.pow(base, Math.floor(ticksUtils.logp(min, base)));
  }

  logScaleTickValues(domain: any[], base: number) {
    const domainMin = domain[0];
    const domainMax = domain[1];
    const tickValues = [];

    if (domainMin < 1) {
      const underOneTicks = Math.floor(ticksUtils.logp(domainMin, base));
      for (let i = underOneTicks; i < 0; i++) {
        const tickValue = Math.pow(base, i);
        tickValues.push(tickValue);
      }
    }

    const ticks = Math.ceil(ticksUtils.logp(domainMax, base));
    for (let i = 0; i <= ticks; i++) {
      const tickValue = Math.pow(base, i);
      tickValues.push(tickValue);
    }

    return tickValues;
  }

  tickValueFormatter(decimals: number, scaledDecimals: any = null) {
    const format = this.panel.yAxis.format;
    return (value: any) => {
      try {
        if (format !== 'none') {
          const v = getValueFormat(format)(value, decimals, scaledDecimals);
          return formattedValueToString(v);
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : err);
      }
      return value;
    };
  }

  fixYAxisTickSize() {
    this.heatmap.select('.axis-y').selectAll('.tick line').attr('x2', this.chartWidth);
  }

  addAxes() {
    this.chartHeight = this.height - this.margin.top - this.margin.bottom;
    this.chartTop = this.margin.top;
    this.chartBottom = this.chartTop + this.chartHeight;
    if (this.panel.dataFormat === 'tsbuckets') {
      this.addYAxisFromBuckets();
    } else {
      if (this.panel.yAxis.logBase === 1) {
        this.addYAxis();
      } else {
        this.addLogYAxis();
      }
    }

    this.yAxisWidth = this.getYAxisWidth(this.heatmap) + Y_AXIS_TICK_PADDING;
    this.chartWidth = this.width - this.yAxisWidth - this.margin.right;
    this.fixYAxisTickSize();

    this.addXAxis();
    this.xAxisHeight = this.getXAxisHeight(this.heatmap);

    if (!this.panel.yAxis.show) {
      this.heatmap.select('.axis-y').selectAll('line').style('opacity', 0);
    }

    if (!this.panel.xAxis.show) {
      this.heatmap.select('.axis-x').selectAll('line').style('opacity', 0);
    }
  }

  addHeatmapCanvas() {
    const heatmapElem = this.$heatmap[0];

    this.width = Math.floor(this.$heatmap.width()) - this.padding.right;
    this.height = Math.floor(this.$heatmap.height()) - this.padding.bottom;

    this.cardPadding = this.panel.cards.cardPadding !== null ? this.panel.cards.cardPadding : CARD_PADDING;
    this.cardRound = this.panel.cards.cardRound !== null ? this.panel.cards.cardRound : CARD_ROUND;

    if (this.heatmap) {
      this.heatmap.remove();
    }

    this.heatmap = d3.select(heatmapElem).append('svg').attr('width', this.width).attr('height', this.height);
  }

  addHeatmap() {
    this.addHeatmapCanvas();
    this.addAxes();

    if (this.panel.yAxis.logBase !== 1 && this.panel.dataFormat !== 'tsbuckets') {
      const logBase = this.panel.yAxis.logBase;
      const domain = this.yScale.domain();
      const tickValues = this.logScaleTickValues(domain, logBase);
      this.data.buckets = mergeZeroBuckets(this.data.buckets, min(tickValues)!);
    }

    const cardsData = this.data.cards;
    const cardStats = this.data.cardStats;
    const maxValueAuto = cardStats.max;
    const minValueAuto = Math.max(cardStats.min, 0);
    const maxValue = isNil(this.panel.color.max) ? maxValueAuto : this.panel.color.max;
    const minValue = isNil(this.panel.color.min) ? minValueAuto : this.panel.color.min;
    const colorScheme: any = find(this.ctrl.colorSchemes, {
      value: this.panel.color.colorScheme,
    });
    this.colorScale = getColorScale(colorScheme, contextSrv.user.lightTheme, maxValue, minValue);
    this.opacityScale = getOpacityScale(this.panel.color, maxValue, minValue);
    this.setCardSize();

    let cards = this.heatmap.selectAll('.heatmap-card').data(cardsData);
    cards.append('title');
    cards = cards
      .enter()
      .append('rect')
      .attr('x', this.getCardX.bind(this))
      .attr('width', this.getCardWidth.bind(this))
      .attr('y', this.getCardY.bind(this))
      .attr('height', this.getCardHeight.bind(this))
      .attr('rx', this.cardRound)
      .attr('ry', this.cardRound)
      .attr('class', 'bordered heatmap-card')
      .style('fill', this.getCardColor.bind(this))
      .style('stroke', this.getCardColor.bind(this))
      .style('stroke-width', 0)
      .style('opacity', this.getCardOpacity.bind(this));

    const $cards = this.$heatmap.find('.heatmap-card');
    $cards
      .on('mouseenter', (event: any) => {
        this.tooltip.mouseOverBucket = true;
        this.highlightCard(event);
      })
      .on('mouseleave', (event: any) => {
        this.tooltip.mouseOverBucket = false;
        this.resetCardHighLight(event);
      });
  }

  highlightCard(event: any) {
    const color = d3.select(event.target).style('fill');
    const highlightColor = d3.color(color)!.darker(2);
    const strokeColor = d3.color(color)!.brighter(4);
    const currentCard = d3.select(event.target);
    this.tooltip.originalFillColor = color;
    currentCard
      .style('fill', highlightColor.toString())
      .style('stroke', strokeColor.toString())
      .style('stroke-width', 1);
  }

  resetCardHighLight(event: any) {
    d3.select(event.target)
      .style('fill', this.tooltip.originalFillColor)
      .style('stroke', this.tooltip.originalFillColor)
      .style('stroke-width', 0);
  }

  setCardSize() {
    const xGridSize = Math.floor(this.xScale(this.data.xBucketSize) - this.xScale(0));
    let yGridSize = Math.floor(this.yScale(this.yScale.invert(0) - this.data.yBucketSize));

    if (this.panel.yAxis.logBase !== 1) {
      const base = this.panel.yAxis.logBase;
      const splitFactor = this.data.yBucketSize || 1;
      yGridSize = Math.floor((this.yScale(1) - this.yScale(base)) / splitFactor);
    }

    const cardWidth = xGridSize - this.cardPadding * 2;
    this.cardWidth = Math.max(cardWidth, MIN_CARD_SIZE);
    this.cardHeight = yGridSize ? yGridSize - this.cardPadding * 2 : 0;
  }

  getCardX(d: { x: any }) {
    let x;
    if (this.xScale(d.x) < 0) {
      // Cut card left to prevent overlay
      x = this.yAxisWidth + this.cardPadding;
    } else {
      x = this.xScale(d.x) + this.yAxisWidth + this.cardPadding;
    }

    return x;
  }

  getCardWidth(d: { x: any }) {
    let w = this.cardWidth;
    if (this.xScale(d.x) < 0) {
      // Cut card left to prevent overlay
      w = this.xScale(d.x) + this.cardWidth;
    } else if (this.xScale(d.x) + this.cardWidth > this.chartWidth) {
      // Cut card right to prevent overlay
      w = this.chartWidth - this.xScale(d.x) - this.cardPadding;
    }

    // Card width should be MIN_CARD_SIZE at least, but cut cards shouldn't be displayed
    w = w > 0 ? Math.max(w, MIN_CARD_SIZE) : 0;
    return w;
  }

  getCardY(d: { y: number }) {
    let y = this.yScale(d.y) + this.chartTop - this.cardHeight - this.cardPadding;
    if (this.panel.yAxis.logBase !== 1 && d.y === 0) {
      y = this.chartBottom - this.cardHeight - this.cardPadding;
    } else {
      if (y < this.chartTop) {
        y = this.chartTop;
      }
    }

    return y;
  }

  getCardHeight(d: { y: number }) {
    const y = this.yScale(d.y) + this.chartTop - this.cardHeight - this.cardPadding;
    let h = this.cardHeight;

    if (this.panel.yAxis.logBase !== 1 && d.y === 0) {
      return this.cardHeight;
    }

    // Cut card height to prevent overlay
    if (y < this.chartTop) {
      h = this.yScale(d.y) - this.cardPadding;
    } else if (this.yScale(d.y) > this.chartBottom) {
      h = this.chartBottom - y;
    } else if (y + this.cardHeight > this.chartBottom) {
      h = this.chartBottom - y;
    }

    // Height can't be more than chart height
    h = Math.min(h, this.chartHeight);
    // Card height should be MIN_CARD_SIZE at least
    h = Math.max(h, MIN_CARD_SIZE);

    return h;
  }

  getCardColor(d: { count: any }) {
    if (this.panel.color.mode === 'opacity') {
      return config.theme2.visualization.getColorByName(this.panel.color.cardColor);
    } else {
      return this.colorScale(d.count);
    }
  }

  getCardOpacity(d: { count: any }) {
    if (this.panel.color.mode === 'opacity') {
      return this.opacityScale(d.count);
    } else {
      return 1;
    }
  }

  getEventOffset(event: any) {
    const elemOffset = this.$heatmap.offset();
    const x = Math.floor(event.clientX - elemOffset.left);
    const y = Math.floor(event.clientY - elemOffset.top);
    return { x, y };
  }

  onMouseDown(event: any) {
    const offset = this.getEventOffset(event);
    this.selection.active = true;
    this.selection.x1 = offset.x;

    this.mouseUpHandler = () => {
      this.onMouseUp();
    };

    $(document).one('mouseup', this.mouseUpHandler.bind(this));
  }

  onMouseUp() {
    $(document).unbind('mouseup', this.mouseUpHandler.bind(this));
    this.mouseUpHandler = null;
    this.selection.active = false;

    const selectionRange = Math.abs(this.selection.x2 - this.selection.x1);
    if (this.selection.x2 >= 0 && selectionRange > MIN_SELECTION_WIDTH) {
      const timeFrom = this.xScale.invert(Math.min(this.selection.x1, this.selection.x2) - this.yAxisWidth);
      const timeTo = this.xScale.invert(Math.max(this.selection.x1, this.selection.x2) - this.yAxisWidth);

      this.ctrl.timeSrv.setTime({
        from: toUtc(timeFrom),
        to: toUtc(timeTo),
      });
    }

    this.clearSelection();
  }

  onMouseLeave() {
    this.ctrl.dashboard.events.publish(new LegacyGraphHoverClearEvent());
    this.clearCrosshair();
  }

  onMouseMove(event: any) {
    if (!this.heatmap) {
      return;
    }

    const offset = this.getEventOffset(event);
    if (this.selection.active) {
      // Clear crosshair and tooltip
      this.clearCrosshair();
      this.tooltip.destroy();

      this.selection.x2 = this.limitSelection(offset.x);
      this.drawSelection(this.selection.x1, this.selection.x2);
    } else {
      const pos = this.getEventPos(event, offset);
      this.drawCrosshair(offset.x);
      this.tooltip.show(pos, this.data);
      this.emitGraphHoverEvent(pos);
    }
  }

  getEventPos(event: { pageX: any; pageY: any }, offset: { x: any; y: any }) {
    const x = this.xScale.invert(offset.x - this.yAxisWidth).valueOf();
    const y = this.yScale.invert(offset.y - this.chartTop);
    const pos: any = {
      pageX: event.pageX,
      pageY: event.pageY,
      x: x,
      x1: x,
      y: y,
      y1: y,
      panelRelY: null,
      offset,
    };

    return pos;
  }

  emitGraphHoverEvent(pos: { panelRelY: number; offset: { y: number } }) {
    // Set minimum offset to prevent showing legend from another panel
    pos.panelRelY = Math.max(pos.offset.y / this.height, 0.001);
    // broadcast to other graph panels that we are hovering
    this.hoverEvent.payload.pos = pos;
    this.hoverEvent.payload.panel = this.panel;
    this.hoverEvent.payload.point['time'] = (pos as any).x;
    this.ctrl.dashboard.events.publish(this.hoverEvent);
  }

  limitSelection(x2: number) {
    x2 = Math.max(x2, this.yAxisWidth);
    x2 = Math.min(x2, this.chartWidth + this.yAxisWidth);
    return x2;
  }

  drawSelection(posX1: number, posX2: number) {
    if (this.heatmap) {
      this.heatmap.selectAll('.heatmap-selection').remove();
      const selectionX = Math.min(posX1, posX2);
      const selectionWidth = Math.abs(posX1 - posX2);

      if (selectionWidth > MIN_SELECTION_WIDTH) {
        this.heatmap
          .append('rect')
          .attr('class', 'heatmap-selection')
          .attr('x', selectionX)
          .attr('width', selectionWidth)
          .attr('y', this.chartTop)
          .attr('height', this.chartHeight);
      }
    }
  }

  clearSelection() {
    this.selection.x1 = -1;
    this.selection.x2 = -1;

    if (this.heatmap) {
      this.heatmap.selectAll('.heatmap-selection').remove();
    }
  }

  drawCrosshair(position: number) {
    if (this.heatmap) {
      this.heatmap.selectAll('.heatmap-crosshair').remove();

      let posX = position;
      posX = Math.max(posX, this.yAxisWidth);
      posX = Math.min(posX, this.chartWidth + this.yAxisWidth);

      this.heatmap
        .append('g')
        .attr('class', 'heatmap-crosshair')
        .attr('transform', 'translate(' + posX + ',0)')
        .append('line')
        .attr('x1', 1)
        .attr('y1', this.chartTop)
        .attr('x2', 1)
        .attr('y2', this.chartBottom)
        .attr('stroke-width', 1);
    }
  }

  drawSharedCrosshair(pos: { x: any }) {
    if (this.heatmap && this.ctrl.dashboard.graphTooltip !== 0) {
      const posX = this.xScale(pos.x) + this.yAxisWidth;
      this.drawCrosshair(posX);
    }
  }

  clearCrosshair() {
    if (this.heatmap) {
      this.heatmap.selectAll('.heatmap-crosshair').remove();
    }
  }

  render() {
    this.data = this.ctrl.data;
    this.panel = this.ctrl.panel;
    this.timeRange = this.ctrl.range;

    if (!this.setElementHeight() || !this.data) {
      return;
    }

    // Draw default axes and return if no data
    if (isEmpty(this.data.buckets)) {
      this.addHeatmapCanvas();
      this.addAxes();
      return;
    }

    this.addHeatmap();
    this.scope.yAxisWidth = this.yAxisWidth;
    this.scope.xAxisHeight = this.xAxisHeight;
    this.scope.chartHeight = this.chartHeight;
    this.scope.chartWidth = this.chartWidth;
    this.scope.chartTop = this.chartTop;
  }

  private getPanelYAxisWidth(): number | null {
    if (!this.panel.yAxis.width) {
      return null;
    }

    return isNaN(this.panel.yAxis.width) ? null : parseInt(this.panel.yAxis.width, 10);
  }
}
