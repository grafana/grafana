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
import { AxisPlacement } from '@grafana/schema';

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
}

export const UPLOT_AXIS_FONT_SIZE = 12;
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
  /* Minimum grid & tick spacing in CSS pixels */
  calculateSpace(self: uPlot, axisIdx: number, scaleMin: number, scaleMax: number, plotDim: number): number {
    const axis = self.axes[axisIdx];
    const scale = self.scales[axis.scale!];

    // for axis left & right
    if (axis.side !== 2 || !scale) {
      return 30;
    }

    const defaultSpacing = 40;

    if (scale.time) {
      const maxTicks = plotDim / defaultSpacing;
      const increment = (scaleMax - scaleMin) / maxTicks;
      const sample = formatTime(self, [scaleMin], axisIdx, defaultSpacing, increment);
      const width = measureText(sample[0], UPLOT_AXIS_FONT_SIZE).width + 18;
      return width;
    }

    return defaultSpacing;
  }

  /** height of x axis or width of y axis in CSS pixels alloted for values, gap & ticks, but excluding axis label */
  calculateAxisSize(self: uPlot, values: string[], axisIdx: number) {
    const axis = self.axes[axisIdx];

    let axisSize = axis.ticks!.size!;

    if (axis.side === 2) {
      axisSize += axis!.gap! + UPLOT_AXIS_FONT_SIZE;
    } else if (values?.length) {
      let maxTextWidth = values.reduce(
        (acc, value) => Math.max(acc, measureText(value, UPLOT_AXIS_FONT_SIZE).width),
        0
      );
      // limit y tick label width to 40% of visualization
      const textWidthWithLimit = Math.min(self.width * 0.4, maxTextWidth);
      // Not sure why this += and not normal assignment
      axisSize += axis!.gap! + axis!.labelGap! + textWidthWithLimit;
    }

    return Math.ceil(axisSize);
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
      isTime,
      timeZone,
      theme,
      tickLabelRotation,
      size,
      color,
      border,
      decimals,
    } = this.props;

    const font = `${UPLOT_AXIS_FONT_SIZE}px ${theme.typography.fontFamily}`;

    const gridColor = theme.isDark ? 'rgba(240, 250, 255, 0.09)' : 'rgba(0, 10, 23, 0.09)';

    if (isBooleanUnit(scaleKey)) {
      splits = [0, 1];
    }

    if (decimals === 0) {
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
          return this.calculateAxisSize(self, values, axisIdx);
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
          stroke: gridColor,
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
          return this.calculateSpace(self, axisIdx, scaleMin, scaleMax, plotDim);
        }),
      filter,
    };

    if (border != null) {
      config.border = border;
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
        return splits.map((v) => formatValue!(v, decimals > 0 ? decimals : undefined));
      };
    }

    // store timezone
    (config as any).timeZone = timeZone;

    return config;
  }
}

const timeUnitSize = {
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
  const timeZone = (self.axes[axisIdx] as any).timeZone;
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
