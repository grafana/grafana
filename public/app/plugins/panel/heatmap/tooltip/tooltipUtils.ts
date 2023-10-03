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

// @TODO: display "~ 1 year/month"?
export const formatMilliseconds = (milliseconds: number) => {
  const conversions: TimeConversions = {
    year: 1000 * 60 * 60 * 24 * 365,
    month: 1000 * 60 * 60 * 24 * 30,
    week: 1000 * 60 * 60 * 24 * 7,
    day: 1000 * 60 * 60 * 24,
    hour: 1000 * 60 * 60,
    minute: 1000 * 60,
    second: 1000,
    millisecond: 1,
  };

  let unit: keyof TimeConversions = 'millisecond',
    value;
  for (unit in conversions) {
    if (milliseconds >= conversions[unit]) {
      value = Math.floor(milliseconds / conversions[unit]);
      break;
    }
  }

  const unitString = value === 1 ? unit : unit + 's';

  return `${value} ${unitString}`;
};

type TimeConversions = {
  year: number;
  month: number;
  week: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};
