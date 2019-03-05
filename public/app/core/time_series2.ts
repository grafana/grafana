import kbn from 'app/core/utils/kbn';
import { getFlotTickDecimals } from 'app/core/utils/ticks';
import _ from 'lodash';
import { getValueFormat, processTimeSeries, NullValueMode } from '@grafana/ui';

function matchSeriesOverride(aliasOrRegex, seriesAlias) {
  if (!aliasOrRegex) {
    return false;
  }

  if (aliasOrRegex[0] === '/') {
    const regex = kbn.stringToJsRegex(aliasOrRegex);
    return seriesAlias.match(regex) != null;
  }

  return aliasOrRegex === seriesAlias;
}

function translateFillOption(fill) {
  return fill === 0 ? 0.001 : fill / 10;
}

/**
 * Calculate decimals for legend and update values for each series.
 * @param data series data
 * @param panel
 * @param height
 */
export function updateLegendValues(data: TimeSeries[], panel, height) {
  for (let i = 0; i < data.length; i++) {
    const series = data[i];
    const yaxes = panel.yaxes;
    const seriesYAxis = series.yaxis || 1;
    const axis = yaxes[seriesYAxis - 1];
    const formatter = getValueFormat(axis.format);

    // decimal override
    if (_.isNumber(panel.decimals)) {
      series.updateLegendValues(formatter, panel.decimals, null);
    } else if (_.isNumber(axis.decimals)) {
      series.updateLegendValues(formatter, axis.decimals + 1, null);
    } else {
      // auto decimals
      // legend and tooltip gets one more decimal precision
      // than graph legend ticks
      const { datamin, datamax } = getDataMinMax(data);
      const { tickDecimals, scaledDecimals } = getFlotTickDecimals(datamin, datamax, axis, height);
      const tickDecimalsPlusOne = (tickDecimals || -1) + 1;
      series.updateLegendValues(formatter, tickDecimalsPlusOne, scaledDecimals + 2);
    }
  }
}

export function getDataMinMax(data: TimeSeries[]) {
  let datamin = null;
  let datamax = null;

  for (const series of data) {
    if (datamax === null || datamax < series.stats.max) {
      datamax = series.stats.max;
    }
    if (datamin === null || datamin > series.stats.min) {
      datamin = series.stats.min;
    }
  }

  return { datamin, datamax };
}

export default class TimeSeries {
  datapoints: any;
  id: string;
  label: string;
  alias: string;
  aliasEscaped: string;
  color: string;
  valueFormater: any;
  stats: any;
  legend: boolean;
  hideTooltip: boolean;
  allIsNull: boolean;
  allIsZero: boolean;
  decimals: number;
  scaledDecimals: number;
  hasMsResolution: boolean;
  isOutsideRange: boolean;

  lines: any;
  dashes: any;
  bars: any;
  points: any;
  yaxis: any;
  zindex: any;
  stack: any;
  nullPointMode: any;
  fillBelowTo: any;
  transform: any;
  flotpairs: any;
  unit: any;

  target: string;

  constructor(opts) {
    this.datapoints = opts.datapoints;
    this.label = opts.alias;
    this.id = opts.alias;
    this.alias = opts.alias;
    this.target = opts.alias;
    this.aliasEscaped = _.escape(opts.alias);
    this.color = opts.color;
    this.bars = { fillColor: opts.color };
    this.valueFormater = getValueFormat('none');
    this.stats = {};
    this.legend = true;
    this.unit = opts.unit;
    this.hasMsResolution = this.isMsResolutionNeeded();
  }

  applySeriesOverrides(overrides) {
    this.lines = {};
    this.dashes = {
      dashLength: [],
    };
    this.points = {};
    this.yaxis = 1;
    this.zindex = 0;
    this.nullPointMode = null;
    delete this.stack;
    delete this.bars.show;

    for (let i = 0; i < overrides.length; i++) {
      const override = overrides[i];
      if (!matchSeriesOverride(override.alias, this.alias)) {
        continue;
      }
      if (override.lines !== void 0) {
        this.lines.show = override.lines;
      }
      if (override.dashes !== void 0) {
        this.dashes.show = override.dashes;
        this.lines.lineWidth = 0;
      }
      if (override.points !== void 0) {
        this.points.show = override.points;
      }
      if (override.bars !== void 0) {
        this.bars.show = override.bars;
      }
      if (override.fill !== void 0) {
        this.lines.fill = translateFillOption(override.fill);
      }
      if (override.stack !== void 0) {
        this.stack = override.stack;
      }
      if (override.linewidth !== void 0) {
        this.lines.lineWidth = this.dashes.show ? 0 : override.linewidth;
        this.dashes.lineWidth = override.linewidth;
      }
      if (override.dashLength !== void 0) {
        this.dashes.dashLength[0] = override.dashLength;
      }
      if (override.spaceLength !== void 0) {
        this.dashes.dashLength[1] = override.spaceLength;
      }
      if (override.nullPointMode !== void 0) {
        this.nullPointMode = override.nullPointMode;
      }
      if (override.pointradius !== void 0) {
        this.points.radius = override.pointradius;
      }
      if (override.steppedLine !== void 0) {
        this.lines.steps = override.steppedLine;
      }
      if (override.zindex !== void 0) {
        this.zindex = override.zindex;
      }
      if (override.fillBelowTo !== void 0) {
        this.fillBelowTo = override.fillBelowTo;
      }
      if (override.color !== void 0) {
        this.setColor(override.color);
      }
      if (override.transform !== void 0) {
        this.transform = override.transform;
      }
      if (override.legend !== void 0) {
        this.legend = override.legend;
      }
      if (override.hideTooltip !== void 0) {
        this.hideTooltip = override.hideTooltip;
      }

      if (override.yaxis !== void 0) {
        this.yaxis = override.yaxis;
      }
    }
  }

  getFlotPairs(fillStyle) {
    let mode = NullValueMode.Null;
    if (fillStyle === 'connected') {
      mode = NullValueMode.Ignore;
    } else if (fillStyle === 'null as zero') {
      mode = NullValueMode.AsZero;
    }

    const viewModel = processTimeSeries({
      timeSeries: [this],
      nullValueMode: mode,
    })[0];

    this.stats = viewModel.stats;
    this.allIsNull = viewModel.allIsNull;
    this.allIsZero = viewModel.allIsZero;
    this.color = viewModel.color;
    // ignore the .label
    return viewModel.data;
  }

  updateLegendValues(formater, decimals, scaledDecimals) {
    this.valueFormater = formater;
    this.decimals = decimals;
    this.scaledDecimals = scaledDecimals;
  }

  formatValue(value) {
    if (!_.isFinite(value)) {
      value = null; // Prevent NaN formatting
    }
    return this.valueFormater(value, this.decimals, this.scaledDecimals);
  }

  isMsResolutionNeeded() {
    for (let i = 0; i < this.datapoints.length; i++) {
      if (this.datapoints[i][1] !== null) {
        const timestamp = this.datapoints[i][1].toString();
        if (timestamp.length === 13 && timestamp % 1000 !== 0) {
          return true;
        }
      }
    }
    return false;
  }

  hideFromLegend(options) {
    if (options.hideEmpty && this.allIsNull) {
      return true;
    }
    // ignore series excluded via override
    if (!this.legend) {
      return true;
    }

    // ignore zero series
    if (options.hideZero && this.allIsZero) {
      return true;
    }

    return false;
  }

  setColor(color: string) {
    this.color = color;
    this.bars.fillColor = color;
  }
}
