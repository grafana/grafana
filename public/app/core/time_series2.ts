import { getFlotTickDecimals } from 'app/core/utils/ticks';
import _ from 'lodash';
import { getValueFormat, ValueFormatter, stringToJsRegex, DecimalCount, formattedValueToString } from '@grafana/data';

function matchSeriesOverride(aliasOrRegex: string, seriesAlias: string) {
  if (!aliasOrRegex) {
    return false;
  }

  if (aliasOrRegex[0] === '/') {
    const regex = stringToJsRegex(aliasOrRegex);
    return seriesAlias.match(regex) != null;
  }

  return aliasOrRegex === seriesAlias;
}

function translateFillOption(fill: number) {
  return fill === 0 ? 0.001 : fill / 10;
}

function getFillGradient(amount: number) {
  if (!amount) {
    return null;
  }

  return {
    colors: [{ opacity: 0.0 }, { opacity: amount / 10 }],
  };
}

/**
 * Calculate decimals for legend and update values for each series.
 * @param data series data
 * @param panel
 * @param height
 */
export function updateLegendValues(data: TimeSeries[], panel: any, height: number) {
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

/**
 * @deprecated: This class should not be used in new panels
 *
 * Use DataFrame and helpers instead
 */
export default class TimeSeries {
  datapoints: any;
  id: string;
  // Represents index of original data frame in the quey response
  dataFrameIndex: number;
  // Represents index of field in the data frame
  fieldIndex: number;
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
  hiddenSeries: boolean;
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

  constructor(opts: any) {
    this.datapoints = opts.datapoints;
    this.label = opts.alias;
    this.id = opts.alias;
    this.alias = opts.alias;
    this.aliasEscaped = _.escape(opts.alias);
    this.color = opts.color;
    this.bars = { fillColor: opts.color };
    this.valueFormater = getValueFormat('none');
    this.stats = {};
    this.legend = true;
    this.unit = opts.unit;
    this.dataFrameIndex = opts.dataFrameIndex;
    this.fieldIndex = opts.fieldIndex;
    this.hasMsResolution = this.isMsResolutionNeeded();
  }

  applySeriesOverrides(overrides: any[]) {
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
      if (override.fillGradient !== void 0) {
        this.lines.fillColor = getFillGradient(override.fillGradient);
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
      if (override.hiddenSeries !== void 0) {
        this.hiddenSeries = override.hiddenSeries;
      }
    }
  }

  getFlotPairs(fillStyle: string) {
    const result = [];

    this.stats.total = 0;
    this.stats.max = -Number.MAX_VALUE;
    this.stats.min = Number.MAX_VALUE;
    this.stats.logmin = Number.MAX_VALUE;
    this.stats.avg = null;
    this.stats.current = null;
    this.stats.first = null;
    this.stats.delta = 0;
    this.stats.diff = null;
    this.stats.range = null;
    this.stats.timeStep = Number.MAX_VALUE;
    this.allIsNull = true;
    this.allIsZero = true;

    const ignoreNulls = fillStyle === 'connected';
    const nullAsZero = fillStyle === 'null as zero';
    let currentTime;
    let currentValue;
    let nonNulls = 0;
    let previousTime;
    let previousValue = 0;
    let previousDeltaUp = true;

    for (let i = 0; i < this.datapoints.length; i++) {
      currentValue = this.datapoints[i][0];
      currentTime = this.datapoints[i][1];

      // Due to missing values we could have different timeStep all along the series
      // so we have to find the minimum one (could occur with aggregators such as ZimSum)
      if (previousTime !== undefined) {
        const timeStep = currentTime - previousTime;
        if (timeStep < this.stats.timeStep) {
          this.stats.timeStep = timeStep;
        }
      }
      previousTime = currentTime;

      if (currentValue === null) {
        if (ignoreNulls) {
          continue;
        }
        if (nullAsZero) {
          currentValue = 0;
        }
      }

      if (currentValue !== null) {
        if (_.isNumber(currentValue)) {
          this.stats.total += currentValue;
          this.allIsNull = false;
          nonNulls++;
        }

        if (currentValue > this.stats.max) {
          this.stats.max = currentValue;
        }

        if (currentValue < this.stats.min) {
          this.stats.min = currentValue;
        }

        if (this.stats.first === null) {
          this.stats.first = currentValue;
        } else {
          if (previousValue > currentValue) {
            // counter reset
            previousDeltaUp = false;
            if (i === this.datapoints.length - 1) {
              // reset on last
              this.stats.delta += currentValue;
            }
          } else {
            if (previousDeltaUp) {
              this.stats.delta += currentValue - previousValue; // normal increment
            } else {
              this.stats.delta += currentValue; // account for counter reset
            }
            previousDeltaUp = true;
          }
        }
        previousValue = currentValue;

        if (currentValue < this.stats.logmin && currentValue > 0) {
          this.stats.logmin = currentValue;
        }

        if (currentValue !== 0) {
          this.allIsZero = false;
        }
      }

      result.push([currentTime, currentValue]);
    }

    if (this.stats.max === -Number.MAX_VALUE) {
      this.stats.max = null;
    }
    if (this.stats.min === Number.MAX_VALUE) {
      this.stats.min = null;
    }

    if (result.length && !this.allIsNull) {
      this.stats.avg = this.stats.total / nonNulls;
      this.stats.current = result[result.length - 1][1];
      if (this.stats.current === null && result.length > 1) {
        this.stats.current = result[result.length - 2][1];
      }
    }
    if (this.stats.max !== null && this.stats.min !== null) {
      this.stats.range = this.stats.max - this.stats.min;
    }
    if (this.stats.current !== null && this.stats.first !== null) {
      this.stats.diff = this.stats.current - this.stats.first;
    }

    this.stats.count = result.length;
    return result;
  }

  updateLegendValues(formater: ValueFormatter, decimals: DecimalCount, scaledDecimals: DecimalCount) {
    this.valueFormater = formater;
    this.decimals = decimals ?? 0;
    this.scaledDecimals = scaledDecimals ?? 0;
  }

  formatValue(value: number) {
    if (!_.isFinite(value)) {
      value = null; // Prevent NaN formatting
    }
    return formattedValueToString(this.valueFormater(value, this.decimals, this.scaledDecimals));
  }

  isMsResolutionNeeded() {
    for (let i = 0; i < this.datapoints.length; i++) {
      if (this.datapoints[i][1] !== null && this.datapoints[i][1] !== undefined) {
        const timestamp = this.datapoints[i][1].toString();
        if (timestamp.length === 13 && timestamp % 1000 !== 0) {
          return true;
        }
      }
    }
    return false;
  }

  hideFromLegend(options: any) {
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
