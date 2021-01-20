import { dateTimeFormat, GrafanaTheme, systemDateFormats, TimeZone } from '@grafana/data';
import uPlot, { Axis } from 'uplot';
import { PlotConfigBuilder } from '../types';
import { measureText } from '../../../utils/measureText';
import { AxisPlacement } from '../config';
import { optMinMax } from './UPlotScaleBuilder';

export interface AxisProps {
  scaleKey: string;
  theme: GrafanaTheme;
  label?: string;
  show?: boolean;
  size?: number | null;
  placement?: AxisPlacement;
  grid?: boolean;
  formatValue?: (v: any) => string;
  values?: any;
  isTime?: boolean;
  timeZone?: TimeZone;
}

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
    const {
      scaleKey,
      label,
      show = true,
      placement = AxisPlacement.Auto,
      grid = true,
      formatValue,
      values,
      isTime,
      timeZone,
      theme,
    } = this.props;

    const gridColor = theme.isDark ? theme.palette.gray25 : theme.palette.gray90;

    let config: Axis = {
      scale: scaleKey,
      show,
      stroke: theme.colors.text,
      side: getUPlotSideFromAxis(placement),
      font: `12px 'Roboto'`,
      labelFont: `12px 'Roboto'`,
      size: this.props.size ?? calculateAxisSize,
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

    if (label !== undefined && label !== null && label.length > 0) {
      config.label = label;
      config.labelSize = 18;
    }

    if (values) {
      config.values = values;
    } else if (isTime) {
      config.values = formatTime;
    } else if (formatValue) {
      config.values = (u: uPlot, vals: any[]) => vals.map((v) => formatValue(v));
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
    return 55;
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

  return measureText(maxLength, 12).width + 18;
}

/** Format time axis ticks */
function formatTime(self: uPlot, splits: number[], axisIdx: number, foundSpace: number, foundIncr: number): string[] {
  const timeZone = (self.axes[axisIdx] as any).timeZone;
  const scale = self.scales.x;
  const range = ((scale?.max ?? 0) - (scale?.min ?? 0)) / 1e3;
  const oneDay = 86400;
  const oneYear = 31536000;

  foundIncr /= 1e3;

  let format = systemDateFormats.interval.minute;

  if (foundIncr < 1) {
    format = systemDateFormats.interval.second.replace('ss', 'ss.SS');
  } else if (foundIncr <= 45) {
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

  return splits.map((v) => dateTimeFormat(v, { format, timeZone }));
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
