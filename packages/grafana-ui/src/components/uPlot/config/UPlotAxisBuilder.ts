import { dateTimeFormat, GrafanaTheme, systemDateFormats, TimeZone } from '@grafana/data';
import uPlot from 'uplot';
import { AxisSide, PlotConfigBuilder } from '../types';
import { measureText } from '../../../utils/measureText';

export interface AxisProps {
  scaleKey: string;
  theme: GrafanaTheme;
  label?: string;
  stroke?: string;
  show?: boolean;
  size?: number;
  side?: AxisSide;
  grid?: boolean;
  formatValue?: (v: any) => string;
  values?: any;
  isTime?: boolean;
  timeZone?: TimeZone;
}

export class UPlotAxisBuilder extends PlotConfigBuilder<AxisProps, uPlot.Axis> {
  getConfig(): uPlot.Axis {
    const {
      scaleKey,
      label,
      show = true,
      side = 3,
      grid = true,
      formatValue,
      values,
      isTime,
      timeZone,
      theme,
    } = this.props;
    const stroke = this.props.stroke || theme.colors.text;
    const gridColor = theme.isDark ? theme.palette.gray25 : theme.palette.gray90;

    let config: uPlot.Axis = {
      scale: scaleKey,
      label,
      show,
      stroke,
      side,
      font: '12px Roboto',
      size: calculateAxisSize,
      grid: {
        show: grid,
        stroke: gridColor,
        width: 1 / devicePixelRatio,
      },
      ticks: {
        show: true,
        stroke: gridColor,
        width: 1 / devicePixelRatio,
      },
      values: values,
      space: calculateSpace,
    };

    if (values) {
      config.values = values;
    } else if (isTime) {
      config.values = formatTime;
    } else if (formatValue) {
      config.values = (u: uPlot, vals: any[]) => vals.map(v => formatValue(v));
    }

    // store timezone
    (config as any).timeZone = timeZone;

    return config;
  }
}

/* Minimum grid & tick spacing in CSS pixels */
function calculateSpace(self: uPlot, axisIdx: number, scaleMin: number, scaleMax: number, plotDim: number): number {
  const axis = self.axes[axisIdx];

  // For x-axis (bottom) we need bigger spacing between labels
  if (axis.side === 2) {
    return 60;
  }

  return 30;
}

/** height of x axis or width of y axis in CSS pixels alloted for values, gap & ticks, but excluding axis label */
function calculateAxisSize(self: uPlot, values: string[], axisIdx: number) {
  const axis = self.axes[axisIdx];
  if (axis.side === 2) {
    return 33;
  }

  if (values === null || !values.length) {
    return 0;
  }

  let maxLength = values[0];
  for (let i = 0; i < values.length; i++) {
    if (values[i].length > maxLength.length) {
      maxLength = values[i];
    }
  }

  return measureText(maxLength, 12).width - 8;
}

/** Format time axis ticks */
function formatTime(self: uPlot, splits: number[], axisIdx: number, foundSpace: number, foundIncr: number): string[] {
  const timeZone = (self.axes[axisIdx] as any).timeZone;
  const scale = self.scales.x;
  const range = (scale?.max ?? 0) - (scale?.min ?? 0);
  const oneDay = 86400;
  const oneYear = 31536000;

  let format = systemDateFormats.interval.minute;

  if (foundIncr <= 45) {
    format = systemDateFormats.interval.second;
  } else if (foundIncr <= 7200 || range <= oneDay) {
    format = systemDateFormats.interval.minute;
  } else if (foundIncr <= 80000) {
    format = systemDateFormats.interval.hour;
  } else if (foundIncr <= 2419200 || range <= oneYear) {
    format = systemDateFormats.interval.day;
  } else if (foundIncr <= 31536000) {
    format = systemDateFormats.interval.month;
  }

  return splits.map(v => dateTimeFormat(v * 1000, { format, timeZone }));
}
