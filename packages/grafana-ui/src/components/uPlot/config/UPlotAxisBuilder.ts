import uPlot, { Axis } from 'uplot';

import {
  dateTimeFormat,
  DecimalCount,
  GrafanaTheme2,
  guessDecimals,
  isBooleanUnit,
  roundDecimals,
  systemDateFormats,
  TimeZone,
} from '@grafana/data';
import { AxisPlacement, ScaleDistribution } from '@grafana/schema';

import { measureText } from '../../../utils/measureText';
import { PlotConfigBuilder } from '../types';

import { optMinMax } from './UPlotScaleBuilder';

export interface AxisProps {
  scaleKey: string;
  theme: GrafanaTheme2;
  label?: string;
  show?: boolean;
  size?: number | null;
  gap?: number;
  tickLabelRotation?: number;
  placement?: AxisPlacement;
  grid?: Axis.Grid;
  ticks?: Axis.Ticks;
  filter?: Axis.Filter;
  space?: Axis.Space;
  formatValue?: (v: any, decimals?: DecimalCount) => string;
  incrs?: Axis.Incrs;
  splits?: Axis.Splits;
  values?: Axis.Values;
  isTime?: boolean;
  timeZone?: TimeZone;
  color?: uPlot.Axis.Stroke;
  border?: uPlot.Axis.Border;
  decimals?: DecimalCount;
  distr?: ScaleDistribution;
}

export const UPLOT_AXIS_FONT_SIZE = 12;

// for panels with small heights, we increase tick density by reducing the minumum tick spacing
// all values in CSS pixels
const Y_TICK_SPACING_PANEL_HEIGHT = 150;
const Y_TICK_SPACING_NORMAL = 30;
const Y_TICK_SPACING_SMALL = 15;

const X_TICK_SPACING_NORMAL = 40;
const X_TICK_VALUE_GAP = 18;

const labelPad = 8;

export class UPlotAxisBuilder extends PlotConfigBuilder<AxisProps, Axis> {
  merge(props: AxisProps) {
    this.props.size = optMinMax('max', this.props.size, props.size);
    if (!this.props.label) {
      this.props.label = props.label;
    }
    if (this.props.placement === AxisPlacement.Auto) {
      this.props.placement = props.placement;
    }
  }

  getConfig(): Axis {
    let {
      scaleKey,
      label,
      show = true,
      placement = AxisPlacement.Auto,
      grid = { show: true },
      ticks,
      space,
      filter,
      gap = 5,
      formatValue,
      splits,
      values,
      incrs,
      isTime,
      timeZone,
      theme,
      tickLabelRotation,
      size,
      color,
      border,
      decimals,
      distr = ScaleDistribution.Linear,
    } = this.props;

    const font = `${UPLOT_AXIS_FONT_SIZE}px ${theme.typography.fontFamily}`;

    const gridColor = theme.isDark ? 'rgba(240, 250, 255, 0.09)' : 'rgba(0, 10, 23, 0.09)';

    // TODO: this is pretty flimsy now that scaleKey is composed from multiple parts :/
    if (isBooleanUnit(scaleKey)) {
      splits = [0, 1];
    }

    if (decimals === 0 && distr === ScaleDistribution.Linear) {
      filter = (u, splits) => splits.map((v) => (Number.isInteger(v) ? v : null));
    }

    let config: Axis = {
      scale: scaleKey,
      show,
      stroke: color ?? theme.colors.text.primary,
      side: getUPlotSideFromAxis(placement),
      font,
      size:
        size ??
        ((self, values, axisIdx) => {
          return calculateAxisSize(self, values, axisIdx);
        }),
      rotate: tickLabelRotation,
      gap,

      labelGap: 0,

      grid: {
        show: grid.show,
        stroke: gridColor,
        width: 1 / devicePixelRatio,
      },
      ticks: Object.assign(
        {
          show: true,
          stroke: border?.show ? (color ?? theme.colors.text.primary) : gridColor,
          width: 1 / devicePixelRatio,
          size: 4,
        },
        ticks
      ),
      splits,
      values,
      space:
        space ??
        ((self, axisIdx, scaleMin, scaleMax, plotDim) => {
          return calculateSpace(self, axisIdx, scaleMin, scaleMax, plotDim, formatValue);
        }),
      filter,
      incrs,
    };

    if (border?.show) {
      config.border = {
        stroke: color ?? theme.colors.text.primary,
        width: 1 / devicePixelRatio,
        ...border,
      };
    }

    if (label != null && label.length > 0) {
      config.label = label;
      config.labelSize = UPLOT_AXIS_FONT_SIZE + labelPad;
      config.labelFont = font;
      config.labelGap = labelPad;
    }

    if (values) {
      config.values = values;
    } else if (isTime) {
      config.values = formatTime;
    } else if (formatValue) {
      config.values = (u: uPlot, splits, axisIdx, tickSpace, tickIncr) => {
        let decimals = guessDecimals(roundDecimals(tickIncr, 6));
        return splits.map((v) => {
          if (v == null) {
            return null;
          } else {
            return formatValue!(v, decimals > 0 ? decimals : undefined);
          }
        });
      };
    }

    // store timezone
    (config as any).timeZone = timeZone;

    return config;
  }
}

/** @internal */
export const timeUnitSize = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  month: 28 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

/** Format time axis ticks */
export function formatTime(
  self: uPlot,
  splits: number[],
  axisIdx: number,
  foundSpace: number,
  foundIncr: number
): string[] {
  const axis = self.axes[axisIdx];
  const timeZone = 'timeZone' in axis && typeof axis.timeZone === 'string' ? axis.timeZone : undefined;
  const scale = self.scales.x;
  const range = (scale?.max ?? 0) - (scale?.min ?? 0);
  const yearRoundedToDay = Math.round(timeUnitSize.year / timeUnitSize.day) * timeUnitSize.day;
  const incrementRoundedToDay = Math.round(foundIncr / timeUnitSize.day) * timeUnitSize.day;

  let format = systemDateFormats.interval.year;

  if (foundIncr < timeUnitSize.second) {
    format = systemDateFormats.interval.millisecond;
  } else if (foundIncr <= timeUnitSize.minute) {
    format = systemDateFormats.interval.second;
  } else if (range <= timeUnitSize.day) {
    format = systemDateFormats.interval.minute;
  } else if (foundIncr <= timeUnitSize.day) {
    format = systemDateFormats.interval.hour;
  } else if (range < timeUnitSize.year) {
    format = systemDateFormats.interval.day;
  } else if (incrementRoundedToDay === yearRoundedToDay) {
    format = systemDateFormats.interval.year;
  } else if (foundIncr <= timeUnitSize.year) {
    format = systemDateFormats.interval.month;
  }

  return splits.map((v) => (v == null ? '' : dateTimeFormat(v, { format, timeZone })));
}

/* Minimum grid & tick spacing in CSS pixels */
function calculateSpace(
  self: uPlot,
  axisIdx: number,
  scaleMin: number,
  scaleMax: number,
  plotDim: number,
  formatValue?: (value: unknown) => string
): number {
  const axis = self.axes[axisIdx];
  const scale = self.scales[axis.scale!];

  // for axis left & right
  if (axis.side !== 2 || !scale) {
    return plotDim <= Y_TICK_SPACING_PANEL_HEIGHT ? Y_TICK_SPACING_SMALL : Y_TICK_SPACING_NORMAL;
  }

  const maxTicks = plotDim / X_TICK_SPACING_NORMAL;
  const increment = (scaleMax - scaleMin) / maxTicks;

  // not super great, since 0.000005 has many more chars than 1.0
  // it also doesn't work well with "short" or adaptive units, e.g. 7 K and 6.40 K
  const bigValue = Math.max(Math.abs(scaleMin), Math.abs(scaleMax));

  let sample = '';

  if (scale.time) {
    sample = formatTime(self, [bigValue], axisIdx, X_TICK_SPACING_NORMAL, increment)[0];
  } else if (formatValue != null) {
    sample = formatValue(bigValue);
  } else {
    return X_TICK_SPACING_NORMAL;
  }

  const valueWidth = measureText(sample, UPLOT_AXIS_FONT_SIZE).width;

  return valueWidth + X_TICK_VALUE_GAP;
}

/** height of x axis or width of y axis in CSS pixels alloted for values, gap & ticks, but excluding axis label */
function calculateAxisSize(self: uPlot, values: string[], axisIdx: number) {
  const axis = self.axes[axisIdx];

  let axisSize = axis.ticks!.size!;

  if (axis.side === 2) {
    axisSize += axis!.gap! + UPLOT_AXIS_FONT_SIZE;
  } else if (values?.length) {
    let maxTextWidth = values.reduce((acc, value) => Math.max(acc, measureText(value, UPLOT_AXIS_FONT_SIZE).width), 0);
    // limit y tick label width to 40% of visualization
    const textWidthWithLimit = Math.min(self.width * 0.4, maxTextWidth);
    // Not sure why this += and not normal assignment
    axisSize += axis!.gap! + axis!.labelGap! + textWidthWithLimit;
  }

  return Math.ceil(axisSize);
}

export function getUPlotSideFromAxis(axis: AxisPlacement) {
  switch (axis) {
    case AxisPlacement.Top:
      return 0;
    case AxisPlacement.Right:
      return 1;
    case AxisPlacement.Bottom:
      return 2;
    case AxisPlacement.Left:
  }

  return 3; // default everythign to the left
}
