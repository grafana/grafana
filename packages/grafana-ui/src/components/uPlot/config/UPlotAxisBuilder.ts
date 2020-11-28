import { GrafanaTheme } from '@grafana/data';
import uPlot, { Axis } from 'uplot';
import { PlotConfigBuilder } from '../types';
import { measureText } from '../../../utils/measureText';
import { AxisPlacement } from '../config';

export interface AxisProps {
  scaleKey: string;
  theme: GrafanaTheme;
  label?: string;
  show?: boolean;
  size?: number;
  placement?: AxisPlacement;
  grid?: boolean;
  formatValue?: (v: any) => string;
  values?: any;
  isTime?: boolean;
}

export class UPlotAxisBuilder extends PlotConfigBuilder<AxisProps, Axis> {
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

    if (label !== undefined && label !== null && label.length > 0) {
      config.label = label;
      config.labelSize = 18;
    }

    if (values) {
      config.values = values;
    } else if (isTime) {
      config.values = timeAxisTickFormats;
    } else if (formatValue) {
      config.values = (u: uPlot, vals: any[]) => vals.map(v => formatValue(v));
    }

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

  let axisWidth = measureText(maxLength, 12).width + 18;
  return axisWidth;
}

/** Format time axis ticks */
/*eslint-disable */
const ms = 1;
const s  = 1e3;
const m  = s * 60;
const h  = m * 60;
const d  = h * 24;
const mo = d * 28;
const y  = d * 365;

const _ = null;

const timeAxisTickFormats = [
    [y,    "{YYYY}",                 _,  _,  _,  _,  _,  _,  1],
    [mo,   "{YYYY}-{MM}",            _,  _,  _,  _,  _,  _,  1],
    [d,    "{MM}/{DD}",              _,  _,  _,  _,  _,  _,  1],
    [h,    "{MM}/{DD} {HH}:{mm}",    _,  _,  _,  _,  _,  _,  1],
    [m,    "{HH}:{mm}",              _,  _,  _,  _,  _,  _,  1],
    [s,    "{HH}:{mm}:{ss}",         _,  _,  _,  _,  _,  _,  1],
    [ms,   "{HH}:{mm}:{ss}.{fff}",   _,  _,  _,  _,  _,  _,  1],
  ];
/*eslint-enable */

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
