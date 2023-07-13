import { Field, FieldType, formattedValueToString } from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { HeatmapData } from '../fields';

export const xDisp = (v: number, xField?: Field) => {
  if (xField?.display) {
    return formattedValueToString(xField.display(v));
  }
  if (xField?.type === FieldType.time) {
    const tooltipTimeFormat = 'YYYY-MM-DD HH:mm:ss';
    const dashboard = getDashboardSrv().getCurrent();
    return dashboard?.formatDate(v, tooltipTimeFormat);
  }
  return `${v}`;
};

export const getHoverCellColor = (data: HeatmapData, index: number) => {
  const colorPalette = data.heatmapColors?.palette!;
  const colorIndex = data.heatmapColors?.values[index];

  let cellColor: string | undefined = undefined;

  if (colorIndex != null) {
    cellColor = colorPalette[colorIndex];
  }

  return { cellColor, colorPalette };
};

export enum ColorIndicator {
  series = 'series',
  value = 'value',
  hexagon = 'hexagon',
  pie_1_4 = 'pie_1_4',
  pie_2_4 = 'pie_2_4',
  pie_3_4 = 'pie_3_4',
  marker_sm = 'marker_sm',
  marker_md = 'marker_md',
  marker_lg = 'marker_lg',
}

export enum LabelValuePlacement {
  hidden = 'hidden',
  leading = 'leading',
  trailing = 'trailing',
}

export type LabelValue = {
  label: string;
  value: string;
  color?: string;
  colorIndicator?: ColorIndicator;
};
