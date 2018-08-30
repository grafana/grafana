import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import * as d3 from 'd3';
import kbn from 'app/core/utils/kbn';
import { appEvents, contextSrv } from 'app/core/core';
import * as ticksUtils from 'app/core/utils/ticks';
import { HeatmapTooltip } from './heatmap_tooltip';
import { mergeZeroBuckets } from './heatmap_data_converter';
import { getColorScale, getOpacityScale } from './color_scale';

const MIN_CARD_SIZE = 1,
  CARD_PADDING = 1,
  CARD_ROUND = 0,
  DATA_RANGE_WIDING_FACTOR = 1.2,
  DEFAULT_X_TICK_SIZE_PX = 100,
  DEFAULT_Y_TICK_SIZE_PX = 50,
  X_AXIS_TICK_PADDING = 10,
  Y_AXIS_TICK_PADDING = 5,
  MIN_SELECTION_WIDTH = 2;

export default function rendering(scope, elem, attrs, ctrl) {
  return new HeatmapRenderer(scope, elem, attrs, ctrl);
}
export class HeatmapRenderer {
  width: number;
  height: number;
  yScale: any;
  xScale: any;
  chartWidth: number;
  chartHeight: number;
  chartTop: number;
  chartBottom: number;
  yAxisWidth: number;
  xAxisHeight: number;
  cardPadding: number;
  cardRound: number;
  cardWidth: number;
  cardHeight: number;
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
  constructor(private scope, private elem, attrs, private ctrl) {
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

    this.ctrl.events.on('render', this.onRender.bind(this));

    this.ctrl.tickValueFormatter = this.tickValueFormatter.bind(this);

    /////////////////////////////
    // Selection and crosshair //
    /////////////////////////////

    // Shared crosshair and tooltip
    appEvents.on('graph-hover', this.onGraphHover.bind(this), this.scope);

    appEvents.on('graph-hover-clear', this.onGraphHoverClear.bind(this), this.scope);

    // Register selection listeners
    this.$heatmap.on('mousedown', this.onMouseDown.bind(this));
    this.$heatmap.on('mousemove', this.onMouseMove.bind(this));
    this.$heatmap.on('mouseleave', this.onMouseLeave.bind(this));
  }

  onGraphHoverClear() {
    this.clearCrosshair();
  }

  onGraphHover(event) {
    this.drawSharedCrosshair(event.pos);
  }

  onRender() {
    this.render();
    this.ctrl.renderingCompleted();
  }

  setElementHeight() {
    try {
      let height = this.ctrl.height || this.panel.height || this.ctrl.row.height;
      if (_.isString(height)) {
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

  getYAxisWidth(elem) {
    const axis_text = elem.selectAll('.axis-y text').nodes();
    const max_text_width = _.max(
      _.map(axis_text, text => {
        // Use SVG getBBox method
        return text.getBBox().width;
      })
    );

    return max_text_width;
  }

  getXAxisHeight(elem) {
    const axis_line = elem.select('.axis-x line');
    if (!axis_line.empty()) {
      const axis_line_position = parseFloat(elem.select('.axis-x line').attr('y2'));
      const canvas_width = parseFloat(elem.attr('height'));
      return canvas_width - axis_line_position;
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
    const grafanaTimeFormatter = ticksUtils.grafanaTimeFormat(ticks, this.timeRange.from, this.timeRange.to);
    let timeFormat;
    const dashboardTimeZone = this.ctrl.dashboard.getTimezone();
    if (dashboardTimeZone === 'utc') {
      timeFormat = d3.utcFormat(grafanaTimeFormatter);
    } else {
      timeFormat = d3.timeFormat(grafanaTimeFormatter);
    }

    const xAxis = d3
      .axisBottom(this.xScale)
      .ticks(ticks)
      .tickFormat(timeFormat)
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
    this.heatmap
      .select('.axis-x')
      .select('.domain')
      .remove();
  }

  addYAxis() {
    let ticks = Math.ceil(this.chartHeight / DEFAULT_Y_TICK_SIZE_PX);
    let tick_interval = ticksUtils.tickStep(this.data.heatmapStats.min, this.data.heatmapStats.max, ticks);
    let { y_min, y_max } = this.wideYAxisRange(this.data.heatmapStats.min, this.data.heatmapStats.max, tick_interval);

    // Rewrite min and max if it have been set explicitly
    y_min = this.panel.yAxis.min !== null ? this.panel.yAxis.min : y_min;
    y_max = this.panel.yAxis.max !== null ? this.panel.yAxis.max : y_max;

    // Adjust ticks after Y range widening
    tick_interval = ticksUtils.tickStep(y_min, y_max, ticks);
    ticks = Math.ceil((y_max - y_min) / tick_interval);

    const decimalsAuto = ticksUtils.getPrecision(tick_interval);
    let decimals = this.panel.yAxis.decimals === null ? decimalsAuto : this.panel.yAxis.decimals;
    // Calculate scaledDecimals for log scales using tick size (as in jquery.flot.js)
    const flot_tick_size = ticksUtils.getFlotTickSize(y_min, y_max, ticks, decimalsAuto);
    const scaledDecimals = ticksUtils.getScaledDecimals(decimals, flot_tick_size);
    this.ctrl.decimals = decimals;
    this.ctrl.scaledDecimals = scaledDecimals;

    // Set default Y min and max if no data
    if (_.isEmpty(this.data.buckets)) {
      y_max = 1;
      y_min = -1;
      ticks = 3;
      decimals = 1;
    }

    this.data.yAxis = {
      min: y_min,
      max: y_max,
      ticks: ticks,
    };

    this.scope.yScale = this.yScale = d3
      .scaleLinear()
      .domain([y_min, y_max])
      .range([this.chartHeight, 0]);

    const yAxis = d3
      .axisLeft(this.yScale)
      .ticks(ticks)
      .tickFormat(this.tickValueFormatter(decimals, scaledDecimals))
      .tickSizeInner(0 - this.width)
      .tickSizeOuter(0)
      .tickPadding(Y_AXIS_TICK_PADDING);

    this.heatmap
      .append('g')
      .attr('class', 'axis axis-y')
      .call(yAxis);

    // Calculate Y axis width first, then move axis into visible area
    const posY = this.margin.top;
    const posX = this.getYAxisWidth(this.heatmap) + Y_AXIS_TICK_PADDING;
    this.heatmap.select('.axis-y').attr('transform', 'translate(' + posX + ',' + posY + ')');

    // Remove vertical line in the right of axis labels (called domain in d3)
    this.heatmap
      .select('.axis-y')
      .select('.domain')
      .remove();
  }

  // Wide Y values range and anjust to bucket size
  wideYAxisRange(min, max, tickInterval) {
    const y_widing = (max * (this.dataRangeWidingFactor - 1) - min * (this.dataRangeWidingFactor - 1)) / 2;
    let y_min, y_max;

    if (tickInterval === 0) {
      y_max = max * this.dataRangeWidingFactor;
      y_min = min - min * (this.dataRangeWidingFactor - 1);
      tickInterval = (y_max - y_min) / 2;
    } else {
      y_max = Math.ceil((max + y_widing) / tickInterval) * tickInterval;
      y_min = Math.floor((min - y_widing) / tickInterval) * tickInterval;
    }

    // Don't wide axis below 0 if all values are positive
    if (min >= 0 && y_min < 0) {
      y_min = 0;
    }

    return { y_min, y_max };
  }

  addLogYAxis() {
    const log_base = this.panel.yAxis.logBase;
    let { y_min, y_max } = this.adjustLogRange(this.data.heatmapStats.minLog, this.data.heatmapStats.max, log_base);

    y_min =
      this.panel.yAxis.min && this.panel.yAxis.min !== '0' ? this.adjustLogMin(this.panel.yAxis.min, log_base) : y_min;
    y_max = this.panel.yAxis.max !== null ? this.adjustLogMax(this.panel.yAxis.max, log_base) : y_max;

    // Set default Y min and max if no data
    if (_.isEmpty(this.data.buckets)) {
      y_max = Math.pow(log_base, 2);
      y_min = 1;
    }

    this.scope.yScale = this.yScale = d3
      .scaleLog()
      .base(this.panel.yAxis.logBase)
      .domain([y_min, y_max])
      .range([this.chartHeight, 0]);

    const domain = this.yScale.domain();
    const tick_values = this.logScaleTickValues(domain, log_base);

    const decimalsAuto = ticksUtils.getPrecision(y_min);
    const decimals = this.panel.yAxis.decimals || decimalsAuto;

    // Calculate scaledDecimals for log scales using tick size (as in jquery.flot.js)
    const flot_tick_size = ticksUtils.getFlotTickSize(y_min, y_max, tick_values.length, decimalsAuto);
    const scaledDecimals = ticksUtils.getScaledDecimals(decimals, flot_tick_size);
    this.ctrl.decimals = decimals;
    this.ctrl.scaledDecimals = scaledDecimals;

    this.data.yAxis = {
      min: y_min,
      max: y_max,
      ticks: tick_values.length,
    };

    const yAxis = d3
      .axisLeft(this.yScale)
      .tickValues(tick_values)
      .tickFormat(this.tickValueFormatter(decimals, scaledDecimals))
      .tickSizeInner(0 - this.width)
      .tickSizeOuter(0)
      .tickPadding(Y_AXIS_TICK_PADDING);

    this.heatmap
      .append('g')
      .attr('class', 'axis axis-y')
      .call(yAxis);

    // Calculate Y axis width first, then move axis into visible area
    const posY = this.margin.top;
    const posX = this.getYAxisWidth(this.heatmap) + Y_AXIS_TICK_PADDING;
    this.heatmap.select('.axis-y').attr('transform', 'translate(' + posX + ',' + posY + ')');

    // Set first tick as pseudo 0
    if (y_min < 1) {
      this.heatmap
        .select('.axis-y')
        .select('.tick text')
        .text('0');
    }

    // Remove vertical line in the right of axis labels (called domain in d3)
    this.heatmap
      .select('.axis-y')
      .select('.domain')
      .remove();
  }

  addYAxisFromBuckets() {
    const tsBuckets = this.data.tsBuckets;

    this.scope.yScale = this.yScale = d3
      .scaleLinear()
      .domain([0, tsBuckets.length - 1])
      .range([this.chartHeight, 0]);

    const tick_values = _.map(tsBuckets, (b, i) => i);
    const decimalsAuto = _.max(_.map(tsBuckets, ticksUtils.getStringPrecision));
    const decimals = this.panel.yAxis.decimals === null ? decimalsAuto : this.panel.yAxis.decimals;
    this.ctrl.decimals = decimals;

    const tickValueFormatter = this.tickValueFormatter.bind(this);
    function tickFormatter(valIndex) {
      let valueFormatted = tsBuckets[valIndex];
      if (!_.isNaN(_.toNumber(valueFormatted)) && valueFormatted !== '') {
        // Try to format numeric tick labels
        valueFormatted = tickValueFormatter(decimals)(_.toNumber(valueFormatted));
      }
      return valueFormatted;
    }

    const tsBucketsFormatted = _.map(tsBuckets, (v, i) => tickFormatter(i));
    this.data.tsBucketsFormatted = tsBucketsFormatted;

    const yAxis = d3
      .axisLeft(this.yScale)
      .tickValues(tick_values)
      .tickFormat(tickFormatter)
      .tickSizeInner(0 - this.width)
      .tickSizeOuter(0)
      .tickPadding(Y_AXIS_TICK_PADDING);

    this.heatmap
      .append('g')
      .attr('class', 'axis axis-y')
      .call(yAxis);

    // Calculate Y axis width first, then move axis into visible area
    const posY = this.margin.top;
    const posX = this.getYAxisWidth(this.heatmap) + Y_AXIS_TICK_PADDING;
    this.heatmap.select('.axis-y').attr('transform', 'translate(' + posX + ',' + posY + ')');

    // Remove vertical line in the right of axis labels (called domain in d3)
    this.heatmap
      .select('.axis-y')
      .select('.domain')
      .remove();
  }

  // Adjust data range to log base
  adjustLogRange(min, max, logBase) {
    let y_min, y_max;

    y_min = this.data.heatmapStats.minLog;
    if (this.data.heatmapStats.minLog > 1 || !this.data.heatmapStats.minLog) {
      y_min = 1;
    } else {
      y_min = this.adjustLogMin(this.data.heatmapStats.minLog, logBase);
    }

    // Adjust max Y value to log base
    y_max = this.adjustLogMax(this.data.heatmapStats.max, logBase);

    return { y_min, y_max };
  }

  adjustLogMax(max, base) {
    return Math.pow(base, Math.ceil(ticksUtils.logp(max, base)));
  }

  adjustLogMin(min, base) {
    return Math.pow(base, Math.floor(ticksUtils.logp(min, base)));
  }

  logScaleTickValues(domain, base) {
    const domainMin = domain[0];
    const domainMax = domain[1];
    const tickValues = [];

    if (domainMin < 1) {
      const under_one_ticks = Math.floor(ticksUtils.logp(domainMin, base));
      for (let i = under_one_ticks; i < 0; i++) {
        const tick_value = Math.pow(base, i);
        tickValues.push(tick_value);
      }
    }

    const ticks = Math.ceil(ticksUtils.logp(domainMax, base));
    for (let i = 0; i <= ticks; i++) {
      const tick_value = Math.pow(base, i);
      tickValues.push(tick_value);
    }

    return tickValues;
  }

  tickValueFormatter(decimals, scaledDecimals = null) {
    const format = this.panel.yAxis.format;
    return function(value) {
      try {
        return format !== 'none' ? kbn.valueFormats[format](value, decimals, scaledDecimals) : value;
      } catch (err) {
        console.error(err.message || err);
        return value;
      }
    };
  }

  fixYAxisTickSize() {
    this.heatmap
      .select('.axis-y')
      .selectAll('.tick line')
      .attr('x2', this.chartWidth);
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
      this.heatmap
        .select('.axis-y')
        .selectAll('line')
        .style('opacity', 0);
    }

    if (!this.panel.xAxis.show) {
      this.heatmap
        .select('.axis-x')
        .selectAll('line')
        .style('opacity', 0);
    }
  }

  addHeatmapCanvas() {
    const heatmap_elem = this.$heatmap[0];

    this.width = Math.floor(this.$heatmap.width()) - this.padding.right;
    this.height = Math.floor(this.$heatmap.height()) - this.padding.bottom;

    this.cardPadding = this.panel.cards.cardPadding !== null ? this.panel.cards.cardPadding : CARD_PADDING;
    this.cardRound = this.panel.cards.cardRound !== null ? this.panel.cards.cardRound : CARD_ROUND;

    if (this.heatmap) {
      this.heatmap.remove();
    }

    this.heatmap = d3
      .select(heatmap_elem)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height);
  }

  addHeatmap() {
    this.addHeatmapCanvas();
    this.addAxes();

    if (this.panel.yAxis.logBase !== 1 && this.panel.dataFormat !== 'tsbuckets') {
      const log_base = this.panel.yAxis.logBase;
      const domain = this.yScale.domain();
      const tick_values = this.logScaleTickValues(domain, log_base);
      this.data.buckets = mergeZeroBuckets(this.data.buckets, _.min(tick_values));
    }

    const cardsData = this.data.cards;
    const maxValueAuto = this.data.cardStats.max;
    const maxValue = this.panel.color.max || maxValueAuto;
    const minValue = this.panel.color.min || 0;

    const colorScheme = _.find(this.ctrl.colorSchemes, {
      value: this.panel.color.colorScheme,
    });
    this.colorScale = getColorScale(colorScheme, contextSrv.user.lightTheme, maxValue, minValue);
    this.opacityScale = getOpacityScale(this.panel.color, maxValue);
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
      .on('mouseenter', event => {
        this.tooltip.mouseOverBucket = true;
        this.highlightCard(event);
      })
      .on('mouseleave', event => {
        this.tooltip.mouseOverBucket = false;
        this.resetCardHighLight(event);
      });
  }

  highlightCard(event) {
    const color = d3.select(event.target).style('fill');
    const highlightColor = d3.color(color).darker(2);
    const strokeColor = d3.color(color).brighter(4);
    const current_card = d3.select(event.target);
    this.tooltip.originalFillColor = color;
    current_card
      .style('fill', highlightColor.toString())
      .style('stroke', strokeColor.toString())
      .style('stroke-width', 1);
  }

  resetCardHighLight(event) {
    d3
      .select(event.target)
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

    this.cardWidth = xGridSize - this.cardPadding * 2;
    this.cardHeight = yGridSize ? yGridSize - this.cardPadding * 2 : 0;
  }

  getCardX(d) {
    let x;
    if (this.xScale(d.x) < 0) {
      // Cut card left to prevent overlay
      x = this.yAxisWidth + this.cardPadding;
    } else {
      x = this.xScale(d.x) + this.yAxisWidth + this.cardPadding;
    }

    return x;
  }

  getCardWidth(d) {
    let w;
    if (this.xScale(d.x) < 0) {
      // Cut card left to prevent overlay
      const cutted_width = this.xScale(d.x) + this.cardWidth;
      w = cutted_width > 0 ? cutted_width : 0;
    } else if (this.xScale(d.x) + this.cardWidth > this.chartWidth) {
      // Cut card right to prevent overlay
      w = this.chartWidth - this.xScale(d.x) - this.cardPadding;
    } else {
      w = this.cardWidth;
    }

    // Card width should be MIN_CARD_SIZE at least
    w = Math.max(w, MIN_CARD_SIZE);
    return w;
  }

  getCardY(d) {
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

  getCardHeight(d) {
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

  getCardColor(d) {
    if (this.panel.color.mode === 'opacity') {
      return this.panel.color.cardColor;
    } else {
      return this.colorScale(d.count);
    }
  }

  getCardOpacity(d) {
    if (this.panel.color.mode === 'opacity') {
      return this.opacityScale(d.count);
    } else {
      return 1;
    }
  }

  getEventOffset(event) {
    const elemOffset = this.$heatmap.offset();
    const x = Math.floor(event.clientX - elemOffset.left);
    const y = Math.floor(event.clientY - elemOffset.top);
    return { x, y };
  }

  onMouseDown(event) {
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
        from: moment.utc(timeFrom),
        to: moment.utc(timeTo),
      });
    }

    this.clearSelection();
  }

  onMouseLeave() {
    appEvents.emit('graph-hover-clear');
    this.clearCrosshair();
  }

  onMouseMove(event) {
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

  getEventPos(event, offset) {
    const x = this.xScale.invert(offset.x - this.yAxisWidth).valueOf();
    const y = this.yScale.invert(offset.y - this.chartTop);
    const pos = {
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

  emitGraphHoverEvent(pos) {
    // Set minimum offset to prevent showing legend from another panel
    pos.panelRelY = Math.max(pos.offset.y / this.height, 0.001);
    // broadcast to other graph panels that we are hovering
    appEvents.emit('graph-hover', { pos: pos, panel: this.panel });
  }

  limitSelection(x2) {
    x2 = Math.max(x2, this.yAxisWidth);
    x2 = Math.min(x2, this.chartWidth + this.yAxisWidth);
    return x2;
  }

  drawSelection(posX1, posX2) {
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

  drawCrosshair(position) {
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

  drawSharedCrosshair(pos) {
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
    if (_.isEmpty(this.data.buckets)) {
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
}
